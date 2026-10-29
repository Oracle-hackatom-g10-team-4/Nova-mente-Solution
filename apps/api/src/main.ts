import 'reflect-metadata';
import {timingSafeEqual} from 'node:crypto';
import {join} from 'node:path';
import {Module} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import type {NestExpressApplication} from '@nestjs/platform-express';
import type {Request,Response} from 'express';
import {ZodError} from 'zod';
import {token,tenant} from './context.js';
import {CommandReceipts} from './commands/receipts.js';
import {commandMiddleware} from './commands/http.js';
import {boundedInteger} from './configuration.js';
import {ConnectionsController} from './modules/connections.controller.js';
import {LibraryController} from './modules/library.controller.js';
import {LearningController} from './modules/learning.controller.js';
import {CommunityController} from './modules/community.controller.js';
import {MemoryController} from './modules/memory.controller.js';
import {InternalController} from './modules/internal.controller.js';
import {DocumentsController} from './modules/documents.controller.js';
import {TrailsController} from './modules/trails.controller.js';

@Module({controllers:[ConnectionsController,LibraryController,LearningController,CommunityController,MemoryController,InternalController,TrailsController,DocumentsController]})
class AtlasModule {}
const app=await NestFactory.create<NestExpressApplication>(AtlasModule,{logger:['error','warn']});
app.useBodyParser('json',{limit:'128kb'});
const receipts=new CommandReceipts(join(process.env.ATLAS_DATA_DIR||'../../data','commands.sqlite3'),boundedInteger('ATLAS_COMMAND_MAX_ROWS',20000,100,1000000),boundedInteger('ATLAS_COMMAND_TTL_SECONDS',604800,60,2592000),boundedInteger('ATLAS_COMMAND_MAX_BYTES',67108864,1048576,1073741824));
const rateLimit=boundedInteger('ATLAS_RATE_LIMIT_PER_MINUTE',120,30,10000);
setInterval(()=>{try{receipts.expire();}catch{console.warn('Manutenção do registro de comandos indisponível.');}},60000).unref();
const windows=new Map<string,{start:number;count:number}>();
app.use((req:Request,res:Response,next:()=>void)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
  const received=Buffer.from(req.headers.authorization||'');const expected=Buffer.from(`Bearer ${token}`);
  if(req.path!=='/v1/internal/agent-tool'&&(received.length!==expected.length||!timingSafeEqual(received,expected))){res.status(401).json({message:'Acesso interno não autorizado.'});return;}
  const key=req.ip||'local';const current=windows.get(key);const time=Date.now();
  if(!current||time-current.start>60000){windows.set(key,{start:time,count:1});}else if(++current.count>rateLimit){res.status(429).json({message:'Muitas solicitações. Aguarde um minuto.'});return;}
  next();
});
app.use(commandMiddleware(receipts,tenant));
app.useGlobalFilters({catch(error:unknown,host){const res=host.switchToHttp().getResponse<Response>();const err=error as {status?:number;getStatus?:()=>number;message?:string;code?:string};const status=error instanceof ZodError||err.code==='INPUT_INVALID'?400:err.code==='FORBIDDEN'?403:err.code==='UNAUTHENTICATED'?401:err.getStatus?.()||err.status||503;res.status(status).json({message:error instanceof ZodError?'Confira os campos enviados.':status<500?err.message:'O serviço não pôde concluir a operação. Fontes e dados anteriores foram preservados.'});}});
await app.listen(Number(process.env.API_PORT||4000),process.env.ATLAS_BIND_ADDRESS||'127.0.0.1');
console.log('Atlas API pronta. Somente workspace local; segredos permanecem no servidor.');
