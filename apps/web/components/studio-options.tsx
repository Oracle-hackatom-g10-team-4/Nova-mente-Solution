'use client';
import type {Agent,AgentId,Profile,Format,Method,RagMode,GenerationInput} from '@atlas/contracts';
import {Sparkles,ChevronDown} from 'lucide-react';
const profiles={beginner:'Iniciante',developer:'Desenvolvedor',architect:'Arquiteto',executive:'Executivo'};
const formats={tutorial:'Guia prático',flashcards:'Flashcards',quiz:'Quiz ativo',summary:'Resumo executivo'};
const methods={auto:'Escolha automática',socratic:'Socrático',feynman:'Feynman',first_principles:'Primeiros princípios',warburg:'Warburg'};
function Choices<T extends string>({label,value,options,onChange}:{label:string;value:T;options:Record<T,string>;onChange:(v:T)=>void}){
  return <fieldset className="choice-group"><legend>{label}</legend><div className="choice-grid">{Object.entries<string>(options).map(([key,name])=><button type="button" key={key} onClick={()=>onChange(key as T)} aria-pressed={value===key} className={value===key?'choice selected':'choice'}>{name}</button>)}</div></fieldset>;
}
type Props={agents:Agent[];agent:AgentId|'auto';onAgent:(v:AgentId|'auto')=>void;profile:Profile;onProfile:(v:Profile)=>void;format:Format;onFormat:(v:Format)=>void;sector:GenerationInput['sector'];onSector:(v:GenerationInput['sector'])=>void;method:Method;onMethod:(v:Method)=>void;rag:RagMode;onRag:(v:RagMode)=>void};
export default function StudioOptions(p:Props){
  return <div className="studio-options">
    <p className="automatic-route"><Sparkles size={18}/><span><strong>{p.agent==='auto'?'Escolher tutor por mim':'Você escolheu seu tutor'}</strong><small>O Atlas usa seu objetivo para escolher quem pode ajudar. Você pode ajustar abaixo.</small></span></p>
    <details className="advanced"><summary>Personalizar este estudo <ChevronDown size={13}/></summary>
      <div className="matrix"><Choices label="Seu momento" value={p.profile} options={profiles} onChange={p.onProfile}/><Choices label="Como quer aprender?" value={p.format} options={formats} onChange={p.onFormat}/><Choices label="Contexto de aplicação" value={p.sector} options={{general:'Geral',fintech:'Fintech',health:'Saúde',ecommerce:'E-commerce'}} onChange={p.onSector}/></div>
      <div className="advanced-grid">
        <label>Tutor<select value={p.agent} onChange={e=>p.onAgent(e.target.value as AgentId|'auto')}><option value="auto">Escolher por mim</option>{p.agents.map(a=><option key={a.id} value={a.id}>{a.name} · {a.role}</option>)}</select></label>
        <label>Método<select value={p.method} onChange={e=>p.onMethod(e.target.value as Method)}>{Object.entries(methods).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
        <label>Recuperação<select value={p.rag} onChange={e=>p.onRag(e.target.value as RagMode)}><option value="auto">Escolha automática</option><option value="hybrid">Híbrida</option><option value="vector">Vetorial</option><option value="lm">Contexto documental</option></select></label>
      </div>
    </details>
  </div>;
}
