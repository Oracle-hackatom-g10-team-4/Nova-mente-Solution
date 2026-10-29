import {Controller,Get,Post,Req,Param} from '@nestjs/common';
import type {Request} from 'express';
import {z} from 'zod';
import {publicGenerationSchema} from '../orchestration/routing.js';
import {generationSchema} from '../policy.js';
import {cognition,brains} from '../context.js';

@Controller('v1')
export class LearningController {
  @Post('generations') async generate(@Req() req:Request){
    const input=publicGenerationSchema.parse(req.body);
    return brains.respond('generate',input);
  }
  @Post('chat') async chat(@Req() req:Request){
    const body=z.object({agent_id:generationSchema.shape.agent_id,message:z.string().trim().min(3).max(2000),document_ids:generationSchema.shape.document_ids,method:generationSchema.shape.method}).strict().parse(req.body);
    const request=generationSchema.parse({document_ids:body.document_ids,goal:body.message,agent_id:body.agent_id,method:body.method});
    return brains.respond('chat',request);
  }
  @Get('progress') async progress(){return cognition('progress');}
  @Post('quiz/:id/attempt') async attempt(@Param('id') id:string,@Req() req:Request){return cognition(`quiz/${encodeURIComponent(id)}/attempt`,'POST',z.object({item_id:z.string().max(100),option_id:z.string().max(100),event_id:z.string().max(100)}).strict().parse(req.body));}
}
