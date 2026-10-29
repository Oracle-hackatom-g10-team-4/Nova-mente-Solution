import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TypeSafeClient} from '@typesafe-ai/sdk';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {publicGenerationSchema,routeAgent} from '../src/orchestration/routing.js';
import {createBrains} from '../src/orchestration/brains.js';
import {createActionEngines} from '../src/orchestration/actions.js';
import {fallbackDecision} from '../src/policy.js';
const id='doc_'+'a'.repeat(20);
const input=publicGenerationSchema.parse({document_ids:[id],goal:'Explique como os conceitos se conectam'});

function isolated(run:()=>Promise<void>,key=''){
  const before={...process.env};const dir=mkdtempSync(join(tmpdir(),'atlas-routing-'));
  process.env.ATLAS_CREDENTIALS_FILE=join(dir,'absent.enc');process.env.TYPESAFE_API_KEY=key;delete process.env.TYPESAFE_API_KEY_FILE;
  return run().finally(()=>{for(const name of Object.keys(process.env))if(!(name in before))delete process.env[name];Object.assign(process.env,before);rmSync(dir,{recursive:true,force:true});});
}

test('automatic routing has an explicit local fallback, and manual overrides bypass the judge',async t=>isolated(async()=>{
  const sdk=t.mock.method(TypeSafeClient.prototype,'systemOne',async()=>{throw new Error('must not be called');});
  assert.equal(input.agent_id,'auto');
  assert.deepEqual((await routeAgent(input)).agent_source,'policy');
  assert.equal((await routeAgent({...input,format:'quiz'})).agent_id,'prisma');
  assert.equal((await routeAgent({...input,agent_id:'soma'})).agent_source,'manual');
  assert.equal(sdk.mock.callCount(),0);
}));

test('Jev selects only a bounded native agent and gets a short deadline with no retries',async t=>isolated(async()=>{
  t.mock.method(TypeSafeClient.prototype,'systemOne',async(request:any,options:any)=>{
    assert.equal(request.state.objective,input.goal);assert.equal('documents' in request.state,false);
    assert.equal(options.timeout,2500);assert.equal(options.retry.maxRetries,0);
    return {answers:{agent:{choice:'lumi'}}};
  });
  assert.equal((await routeAgent(input)).agent_id,'lumi');assert.equal((await routeAgent(input)).agent_source,'typesafe');
},'test-only-decision-key'));

test('provider failure and an invalid suggested ID cannot grant a capability or pretend remote success',async t=>isolated(async()=>{
  const sdk=t.mock.method(TypeSafeClient.prototype,'systemOne',async()=>{throw new Error('provider outage');});
  assert.equal((await routeAgent(input)).agent_source,'policy');
  sdk.mock.mockImplementation(async()=>({answers:{agent:{choice:'admin'}}}));
  assert.equal((await routeAgent(input)).agent_source,'policy');
},'test-only-decision-key'));

test('automatic routing validates sources before consulting memory or the decision model',async()=>{
  const calls:string[]=[];
  const actions=createActionEngines('alice',{async cognition(path){calls.push(path);return [];},async search(){throw Error('unused');},async judge(){throw Error('unused');}});
  const brains=createBrains('alice',actions,async()=>{throw Error('must not run');},async()=>{throw Error('must not route');});
  await assert.rejects(brains.respond('generate',input));assert.deepEqual(calls,['documents']);
});

test('the resolved agent is the actual principal sent to Invokta and is persisted in the decision',async()=>{
  let sent:any;
  const actions=createActionEngines('alice',{async cognition(path,_method,body){
    if(path==='documents')return [{id,characters:100}];
    if(path==='dreamer/status')return {consent:false,active_version:0,active_policy:null};
    sent=body;return {id:'pkg_routing',status:'ready',conteudo_adaptado:{itens:[]}};
  },async search(){throw Error('unused');},async judge(){throw Error('unused');}});
  const brains=createBrains('alice',actions,async(request,size)=>fallbackDecision(request,size),async()=>({agent_id:'prisma',agent_source:'typesafe',agent_reason:'Bounded classifier choice'}));
  await brains.respond('generate',input);assert.equal(sent.agent_id,'prisma');assert.equal(sent.decision.agent_id,'prisma');assert.equal(sent.decision.agent_source,'typesafe');
});
