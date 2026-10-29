import {Controller,Get,Delete,Param,Res} from '@nestjs/common';
import {z} from 'zod';
import type {Response} from 'express';
import {cognition} from '../context.js';
const idSchema=z.string().regex(/^doc_[a-f0-9]{20}$/);

@Controller('v1/documents')
export class DocumentsController {
  @Get(':id/deletion') preview(@Param('id') id:string){return cognition(`documents/${idSchema.parse(id)}/deletion`);}
  @Get(':id/removal') status(@Param('id') id:string){return cognition(`documents/${idSchema.parse(id)}/removal`);}
  @Delete(':id') async remove(@Param('id') id:string,@Res({passthrough:true}) response:Response){
    const result=await cognition(`documents/${idSchema.parse(id)}`,'DELETE');
    response.status(result.status==='deleted'?200:202);return result;
  }
}
