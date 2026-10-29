import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Module} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';

// Exercise the real HTTP controller and Express status, with only cognition stubbed.
test('document HTTP adapter preserves pending 202 and completed 200',async t=>{
  const before={...process.env};
  process.env.ATLAS_ENV_FILE='/dev/null';
  process.env.ATLAS_APP_MODE='local';
  process.env.COGNITION_URL='http://cognition.test.invalid';
  process.env.ATLAS_INTERNAL_TOKEN='test-only-document-http-token-123456789';
  const {DocumentsController}=await import('../src/modules/documents.controller.js');
  @Module({controllers:[DocumentsController]}) class TestModule{}
  const app=await NestFactory.create(TestModule,{logger:false});
  const fetchOriginal=globalThis.fetch;
  let state='cleanup_pending';
  let appUrl='';
  t.mock.method(globalThis,'fetch',async(url:any,options:any)=>{
    if(String(url).startsWith('http://cognition.test.invalid/v1/documents/'))return new Response(JSON.stringify({document_id:'doc_'+'a'.repeat(20),status:state,impact:{}}),{status:state==='deleted'?200:202,headers:{'content-type':'application/json'}});
    if(appUrl&&String(url).startsWith(appUrl+'/'))return fetchOriginal(url,options);
    throw new Error('Unexpected outbound request in isolated HTTP test.');
  });
  try{
    await app.listen(0,'127.0.0.1');
    appUrl=await app.getUrl();
    const url=appUrl+'/v1/documents/doc_'+'a'.repeat(20);
    const pending=await fetch(url,{method:'DELETE'});assert.equal(pending.status,202);assert.equal((await pending.json() as any).status,'cleanup_pending');
    state='deleted';const done=await fetch(url,{method:'DELETE'});assert.equal(done.status,200);
  }finally{
    await app.close();
    for(const name of Object.keys(process.env))if(!(name in before))delete process.env[name];
    Object.assign(process.env,before);
  }
});
