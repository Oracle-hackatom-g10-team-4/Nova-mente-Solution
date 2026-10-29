import {personas,catalogVersion} from './catalog.js';
import type {Generation} from '../policy.js';
import {publicGenerationSchema,routeAgent,type RoutingInput} from './routing.js';
import {decide,generationSchema} from '../policy.js';
import {brainCapabilities,brainPrincipal,type ActionEngines} from './actions.js';

export const brains=Object.freeze(personas.map(brain=>Object.freeze({...brain,version:catalogVersion,capabilities:brainCapabilities})));

/** Atlas brain = domain decision loop; Eve remains the LLM/handoff runtime. */
export function createBrains(tenant:string,actions:ActionEngines,decision:typeof decide=decide,route:typeof routeAgent=routeAgent) {
  async function respond(kind:'generate'|'chat',request:RoutingInput|Generation,signal?:AbortSignal) {
    const requested=publicGenerationSchema.parse(request);
    const reader=brainPrincipal(tenant,requested.agent_id==='auto'?'nilo':requested.agent_id);
    const {documents}=await actions.invoke('atlas.sources',{},reader,signal);
    const selected=documents.filter((doc:{id:string})=>requested.document_ids.includes(doc.id));
    if(selected.length!==new Set(requested.document_ids).size)throw Object.assign(new Error('Uma fonte selecionada não pertence a este workspace.'),{status:404});
    const state=await actions.invoke('atlas.memory.status',{},reader,signal);
    const memory=state.consent?state.active_policy:null;
    const routing=await route(requested,signal);
    const input=generationSchema.parse({...requested,agent_id:routing.agent_id});
    const principal=brainPrincipal(tenant,input.agent_id);
    const choice={...await decision(input,selected.reduce((n:number,doc:{characters:number})=>n+doc.characters,0),memory),...routing};
    return actions.invoke(kind==='chat'?'atlas.chat':'atlas.generate',{...input,decision:choice},principal,signal);
  }
  return {catalog:()=>brains,respond};
}
