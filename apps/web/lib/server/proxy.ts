import {NextRequest,NextResponse} from 'next/server';

const MAX_FILE=10*1024*1024;
const MAX_BODY=MAX_FILE+64*1024;
export const routes:Record<string,RegExp[]>={
  GET:[/^connections$/,/^bootstrap$/,/^documents$/,/^documents\/[\w-]+\/(source|deletion|removal)$/,/^packages\/[\w-]+$/,/^trails(?:\/[\w-]+)?$/,/^progress$/,/^groups$/,/^groups\/[\w-]+\/messages$/,/^dreamer\/status$/],
  POST:[/^connections\/(generation|embeddings)\/test$/,/^connections\/(generation|embeddings|decision|search)$/,/^documents$/,/^generations$/,/^chat$/,/^quiz\/[\w-]+\/attempt$/,/^trails(?:\/[\w-]+\/steps\/[\w-]+\/(generate|complete))?$/,/^groups$/,/^groups\/[\w-]+\/messages$/,/^dreamer\/(consent|cycles|rollback)$/],
  DELETE:[/^connections\/(generation|embeddings|decision|search)$/,/^documents\/[\w-]+$/,/^dreamer\/memory$/],
};
export class ProxyError extends Error {
  constructor(public readonly status:number,message:string){super(message);}
}
export function authorizeOrigin(request:NextRequest):void {
  const origin=request.headers.get('origin');
  if(request.method==='GET'||!origin)return;
  let allowed=false;
  try{
    const parsed=new URL(origin);
    allowed=parsed.origin===origin&&!parsed.username&&!parsed.password&&parsed.host===request.headers.get('host')&&parsed.protocol===request.nextUrl.protocol;
  }catch{}
  if(!allowed)throw new ProxyError(403,'Origem não autorizada.');
}
export function targetURL(path:string):URL {
  const base=new URL(process.env.ATLAS_API_URL||'http://127.0.0.1:4000');
  if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw new Error('Invalid server URL');
  return new URL(`/v1/${path}`,base);
}
export function requestHeaders(request:NextRequest):Headers {
  const token=process.env.ATLAS_INTERNAL_TOKEN;
  if(!token)throw new ProxyError(503,'O serviço precisa de configuração no servidor.');
  const headers=new Headers({Authorization:`Bearer ${token}`,Accept:'application/json'});
  const key=request.headers.get('Idempotency-Key');
  if(key){
    if(!/^[a-zA-Z0-9_-]{16,100}$/.test(key))throw new ProxyError(400,'Identificador de operação inválido.');
    headers.set('Idempotency-Key',key);
  }
  return headers;
}
async function boundedBytes(stream:ReadableStream<Uint8Array>,max:number):Promise<Uint8Array> {
  const reader=stream.getReader();const chunks:Uint8Array[]=[];let size=0;
  while(true){
    const chunk=await reader.read();if(chunk.done)break;
    size+=chunk.value.length;
    if(size>max){await reader.cancel();throw new ProxyError(413,'O conteúdo excede o limite de tamanho.');}
    chunks.push(chunk.value);
  }
  const result=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}
  return result;
}
async function validateUpload(contentType:string,body:Uint8Array):Promise<void> {
  let form:FormData;
  try{form=await new Request('http://localhost',{method:'POST',headers:{'Content-Type':contentType},body:body as BodyInit}).formData();}
  catch{throw new ProxyError(400,'O envio do arquivo está incompleto ou inválido.');}
  const files=form.getAll('file');
  if(files.length!==1||!(files[0] instanceof File))throw new ProxyError(400,'Selecione um único arquivo.');
  if(files[0].size>MAX_FILE)throw new ProxyError(413,'O arquivo deve ter até 10 MiB.');
}
async function validateContent(path:string,contentType:string,body:Uint8Array):Promise<void> {
  const expected=path==='documents'?'multipart/form-data; boundary=':'application/json';
  if(!contentType.startsWith(expected))throw new ProxyError(415,'Formato de solicitação inválido.');
  if(path==='documents')await validateUpload(contentType,body);
  else if(body.length>64*1024)throw new ProxyError(413,'A solicitação excede o limite de tamanho.');
}
export async function requestBody(request:NextRequest,path:string,headers:Headers):Promise<Uint8Array|undefined> {
  if(request.method==='GET'||!request.body)return;
  if(Number(request.headers.get('content-length')||0)>MAX_BODY)throw new ProxyError(413,'O arquivo deve ter até 10 MiB.');
  const body=await boundedBytes(request.body,MAX_BODY);
  if(request.method==='DELETE'&&body.byteLength===0)return;
  const contentType=request.headers.get('content-type')||'';
  await validateContent(path,contentType,body);
  headers.set('Content-Type',contentType);
  return body;
}
export function timeout(path:string):number {
  return ['generations','chat','dreamer/cycles'].includes(path)||path.endsWith('/generate')?120000:30000;
}
export async function publicResponse(response:Response):Promise<NextResponse> {
  if(!response.ok){
    const messages:Record<number,string>={400:'Confira os dados, as fontes e os pré-requisitos da etapa.',404:'O conteúdo não foi encontrado.',409:'Confira o estado da operação ou conclua a etapa anterior antes de continuar.',413:'O arquivo deve ter até 10 MiB.',415:'Use um arquivo PDF, Markdown ou TXT.',422:'Confira se a fonte contém texto.',429:'O serviço está ocupado. Aguarde um instante e tente novamente.'};
    throw new ProxyError(response.status>=500?502:response.status,messages[response.status]||'O serviço não conseguiu concluir a solicitação. Tente novamente.');
  }
  if(response.status===204)return new NextResponse(null,{status:204});
  const headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  if(response.headers.get('Idempotency-Replayed'))headers.set('Idempotency-Replayed','true');
  const body=response.body?await boundedBytes(response.body,2*1024*1024):null;
  return new NextResponse(body as BodyInit|null,{status:response.status,headers});
}
