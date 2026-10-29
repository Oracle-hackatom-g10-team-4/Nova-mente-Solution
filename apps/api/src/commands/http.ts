import type {Request,Response,NextFunction} from 'express';
import type {CommandReceipts} from './receipts.js';

const tracked=/^\/v1\/(generations|chat|groups(?:\/[\w-]+\/messages)?|quiz\/[\w-]+\/attempt|trails(?:\/[\w-]+\/steps\/[\w-]+\/(generate|complete))?|dreamer\/(cycles|consent|rollback))$/;
function decodePart(part:string):string {
  let value:string;
  try{value=decodeURIComponent(part);}catch{throw Object.assign(new Error('Caminho inválido.'),{status:400});}
  if(!/^[a-zA-Z0-9_-]*$/.test(value)||value.length>100)throw Object.assign(new Error('Segmento de caminho inválido.'),{status:400});
  return value;
}
export function commandPath(path:string):string {
  const parts=path.replace(/\/+$/,'').split('/').map(decodePart);
  const domain=parts[2]?.toLowerCase();
  const parameterPositions:Record<string,number[]>= {documents:[3],groups:[3],quiz:[3],trails:[3,5]};
  const parameters=parameterPositions[domain||'']||[];
  return parts.map((part,index)=>parameters.includes(index)?part:part.toLowerCase()).join('/');
}
function attachResponse(res:Response,receipts:CommandReceipts,tenant:string,operation:string,key:string):void {
  const json=res.json.bind(res);
  res.json=(body:unknown)=>{
    try{receipts.complete(tenant,operation,key,res.statusCode,body);return json(body);}
    catch{res.status(503);return json({message:'Não foi possível confirmar o resultado. Confira o estado antes de uma nova operação.'});}
  };
}
function execute(req:Request,res:Response,next:NextFunction,receipts:CommandReceipts,tenant:string):void {
  const path=commandPath(req.path);
  const erase=req.method==='DELETE'&&(path==='/v1/dreamer/memory'||/^\/v1\/documents\/doc_[a-f0-9]{20}$/.test(path));
  const isCommand=req.method==='POST'&&tracked.test(path);
  const key=req.get('Idempotency-Key');
  if((!isCommand&&!erase)||!key){
    if(erase)receipts.forget(tenant);
    next();return;
  }
  const operation=`${req.method}:${path}`;
  const reservation=receipts.reserve(tenant,operation,key,req.body);
  if(reservation.kind==='replay'){
    res.setHeader('Idempotency-Replayed','true');res.status(reservation.status).json(reservation.body);return;
  }
  if(erase)receipts.forget(tenant,{operation,key});
  attachResponse(res,receipts,tenant,operation,key);next();
}
/** Legacy clients without IDs remain compatible; public auth/reconciliation is P01/P02. */
export function commandMiddleware(receipts:CommandReceipts,tenant:string){
  return (req:Request,res:Response,next:NextFunction)=>{
    try{execute(req,res,next,receipts,tenant);}
    catch(error){
      const failure=error as {status?:number;message?:string};
      res.status(failure.status||503).json({message:failure.status?failure.message:'Registro de comandos indisponível.'});
    }
  };
}
