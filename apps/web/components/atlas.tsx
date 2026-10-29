'use client';

import {useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode} from 'react';
import {AnimatePresence, motion, MotionConfig, useReducedMotion} from 'motion/react';
import {animate} from 'animejs';
import * as Dialog from '@radix-ui/react-dialog';
import {ThemeProvider, createTheme, CircularProgress, LinearProgress} from '@mui/material';
import Image from 'next/image';
import {ArrowDownToLine, ArrowRight, BookMarked, BookOpen, Briefcase, Building2, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Code2, Focus, GitBranch, GraduationCap, Layers3, ListChecks, Menu, MessageSquare, Network, PenLine, Plus, RotateCcw, ScrollText, Search, Send, ShieldCheck, Sparkles, Trash2, Upload, Users, Wand2, X, BrainCircuit, FileText, ExternalLink, Leaf, Settings2, type LucideIcon} from 'lucide-react';
import type {Agent, AgentId, Bootstrap, Citation, Document, DreamStatus, EducationalPackage, Format, GenerationInput, Group, GroupMessage, LearningItem, Method, Profile, Progress, RagMode} from '@atlas/contracts';
import {api, post} from '@/lib/api';
import {progressDisplay} from '@/lib/progress';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useAtlasIdentity} from '@/lib/atlas-identity';
import {AtlasLogo, AtlasOrb} from './atlas-orb';
import AtlasCustomizer from './atlas-customizer';
import Trails from './trails';
import StudioOptions from './studio-options';
import SourceRemoval,{PendingRemovals} from './source-removal';

const theme = createTheme({palette:{mode:'dark', primary:{main:'#ff6700', contrastText:'#08090a'}, background:{default:'var(--canvas)', paper:'var(--surface)'}}, typography:{fontFamily:'var(--sans)'}, shape:{borderRadius:6}});
const nav = [
  {group:'Aprendizagem', id:'chat', label:'Canais dos agentes', icon:MessageSquare}, {group:'Aprendizagem', id:'studio', label:'Estúdio de adaptação', icon:Wand2}, {group:'Aprendizagem', id:'atlas', label:'Atlas de conhecimento', icon:Network}, {group:'Aprendizagem', id:'practice', label:'Oficina & prática', icon:Layers3}, {group:'Aprendizagem', id:'trails', label:'Trilhas de estudo', icon:ListChecks}, {group:'Workspace', id:'community', label:'Grupos de estudo', icon:Users}, {group:'Workspace', id:'memory', label:'Memória & Dreamer', icon:BrainCircuit}
] as const;
type Tab = typeof nav[number]['id'];
const profileOptions: Record<Profile,{label:string; icon:LucideIcon; hint:string}> = {
  beginner:{label:'Iniciante', icon:GraduationCap, hint:'Passo a passo'},
  developer:{label:'Desenvolvedor', icon:Code2, hint:'Com exemplos'},
  architect:{label:'Arquiteto', icon:Building2, hint:'Visão de sistema'},
  executive:{label:'Executivo', icon:Briefcase, hint:'Decisão rápida'},
};
const formatOptions: Record<Format,{label:string; icon:LucideIcon; hint:string}> = {
  tutorial:{label:'Guia prático', icon:BookMarked, hint:'Explicação guiada'},
  flashcards:{label:'Flashcards', icon:Layers3, hint:'Revisão ativa'},
  quiz:{label:'Quiz ativo', icon:ListChecks, hint:'Teste com feedback'},
  summary:{label:'Resumo executivo', icon:ScrollText, hint:'Síntese objetiva'},
};
const profileLabels: Record<Profile,string> = {beginner:'Iniciante', developer:'Desenvolvedor', architect:'Arquiteto', executive:'Executivo'};
const formatLabels: Record<Format,string> = {tutorial:'Guia prático', flashcards:'Flashcards', quiz:'Quiz ativo', summary:'Resumo executivo'};
const methodLabels: Record<Method,string> = {auto:'Escolha automática', socratic:'Socrático', feynman:'Feynman', first_principles:'Primeiros princípios', warburg:'Warburg'};
const cycleLabels: Record<string,string> = {canceled:'Ciclo cancelado', cancelled:'Ciclo cancelado', queued:'Ciclo enfileirado', evaluating:'Avaliação em andamento', awaiting_consent:'Aguardando consentimento', awaiting_events:'Aguardando eventos consentidos', awaiting_evaluation:'Aguardando avaliação', rejected:'Proposta rejeitada', promoted:'Política promovida', failed:'Falha no ciclo'};
type Source = {id:string; title:string; pages:{number:number; text:string}[]};
type Attempt = {correct:boolean; feedback:string; xp_awarded:number; progress:Progress};

const agentMarks: Record<AgentId, string> = {
  nilo: '/brand/agent-nilo.png',
  lumi: '/brand/agent-lumi.png',
  prisma: '/brand/agent-prisma.png',
  fio: '/brand/agent-fio.png',
  soma: '/brand/agent-soma.png',
};

function AgentMark({id, color, small=false, custom=false}:{id:AgentId; color?:string; small?:boolean; custom?:boolean}) {
  if (custom && color) return <AtlasOrb color={color} />;
  const size = small ? 32 : 42;
  const src = agentMarks[id];
  if (src) {
    return <Image src={src} width={size} height={size} alt="" aria-hidden="true" className="agent-mark" />;
  }
  return <AtlasOrb color={color || '#ff7043'} />;
}
function Modal({open,onOpenChange,title,description,children}:{open:boolean; onOpenChange:(v:boolean)=>void; title:string; description:string; children:ReactNode}) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content"><div className="row between"><Dialog.Title>{title}</Dialog.Title><Dialog.Close className="icon-button" aria-label="Fechar"><X size={18}/></Dialog.Close></div><Dialog.Description>{description}</Dialog.Description>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
function Choices<T extends string>({label,value,options,onChange}:{label:string;value:T; options:Record<T,string>;onChange:(v:T)=>void}) {
  return <fieldset className="choice-group"><legend>{label}</legend><div className="choice-grid">{Object.entries<string>(options).map(([key,name])=><button type="button" key={key} onClick={()=>onChange(key as T)} aria-pressed={value===key} className={value===key?'choice selected':'choice'}>{name}</button>)}</div></fieldset>;
}
function IconChoices<T extends string>({label,value,options,onChange}:{label:string;value:T; options:Record<T,{label:string; icon:LucideIcon; hint:string}>;onChange:(v:T)=>void}) {
  return <fieldset className="choice-group choice-group-rich"><legend>{label}</legend><div className="choice-grid rich">{(Object.entries(options) as [T,{label:string; icon:LucideIcon; hint:string}][]).map(([key,option])=>{const Icon=option.icon;return <button type="button" key={key} onClick={()=>onChange(key)} aria-pressed={value===key} className={value===key?'choice choice-rich selected':'choice choice-rich'}><Icon size={15} strokeWidth={1.75} aria-hidden="true"/><span className="choice-copy"><strong>{option.label}</strong><small>{option.hint}</small></span></button>;})}</div></fieldset>;
}
function StudioStep({index,title,hint,action,children}:{index:string; title:string; hint:string; action?:ReactNode; children:ReactNode}) {
  return <section className="studio-step"><header className="studio-step-head"><span className="studio-step-index" aria-hidden="true">{index}</span><div className="studio-step-copy"><h2>{title}</h2><p>{hint}</p></div>{action}</header>{children}</section>;
}
function docKind(title:string){if(/\.pdf$/i.test(title)||title.toLowerCase().includes('pdf'))return 'PDF';if(/\.(md|markdown)$/i.test(title))return 'MD';if(/\.txt$/i.test(title))return 'TXT';return 'DOC';}

export default function Atlas() {
  const settingsHref=usePathname().startsWith('/workspace')?'/workspace/settings':'/studio/settings';
  const [boot,setBoot]=useState<Bootstrap|null>(null);
  const identity=useAtlasIdentity();
  const [customizeOpen,setCustomizeOpen]=useState(false);
  useEffect(()=>{if(identity)setAgentId(identity.agentId);},[identity]);
  const [tab,setTab]=useState<Tab>('studio');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const [agentId,setAgentId]=useState<AgentId>('nilo');
  const [studioAgent,setStudioAgent]=useState<AgentId|'auto'>('auto');
  const [removing,setRemoving]=useState<Document|null>(null);
  const [selected,setSelected]=useState<string[]>([]);
  const [source,setSource]=useState<Source|null>(null);
  const [sourceError,setSourceError]=useState('');
  const [sourceLoading,setSourceLoading]=useState(false);
  const [page,setPage]=useState(1);
  const [citation,setCitation]=useState<Citation|null>(null);
  const [readerOpen,setReaderOpen]=useState(false);
  const [readerTab,setReaderTab]=useState<'source'|'details'>('source');
  const [menuOpen,setMenuOpen]=useState(false);
  const [focus,setFocus]=useState(false);
  const [calm,setCalm]=useState(false);
  const [uploadOpen,setUploadOpen]=useState(false);
  const [searchOpen,setSearchOpen]=useState(false);
  const [query,setQuery]=useState('');
  const [goal,setGoal]=useState('');
  const [profile,setProfile]=useState<Profile>('beginner');
  const [format,setFormat]=useState<Format>('tutorial');
  const [sector,setSector]=useState<GenerationInput['sector']>('general');
  const [method,setMethod]=useState<Method>('auto');
  const [rag,setRag]=useState<RagMode>('auto');
  const [pkg,setPkg]=useState<EducationalPackage|null>(null);
  const [packages,setPackages]=useState<EducationalPackage[]>([]);
  const [chatInput,setChatInput]=useState('');
  const [chats,setChats]=useState<{agentId:AgentId; question:string; response:EducationalPackage}[]>([]);
  const [dream,setDream]=useState<DreamStatus|null>(null);
  const [dreamError,setDreamError]=useState('');
  const [eraseOpen,setEraseOpen]=useState(false);
  const [groupId,setGroupId]=useState('');
  const [groupOpen,setGroupOpen]=useState(false);
  const [groupName,setGroupName]=useState('');
  const [groupTopic,setGroupTopic]=useState('');
  const [messages,setMessages]=useState<GroupMessage[]>([]);
  const [groupInput,setGroupInput]=useState('');
  const [groupLoading,setGroupLoading]=useState(false);
  const [groupError,setGroupError]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);
  const completion=useRef<HTMLDivElement>(null);
  const sourceRequest=useRef(0);
  const rebuildRequest=useRef<GenerationInput|null>(null);
  const reduce=useReducedMotion();
  const agents=boot?.agents.map(a=>identity && identity.agentId===a.id?{...a,name:identity.name,color:identity.color}:a);
  const agent=agents?.find(a=>a.id===agentId);
  const activeDoc=boot?.documents.find(d=>d.id===selected[0]);

  const openSource=useCallback(async (id:string, cited?:Citation)=>{
    const request=++sourceRequest.current;
    setSourceLoading(true); setSourceError(''); setCitation(cited||null); setPage(cited?.page||1);
    try {const value=await api<Source>(`documents/${encodeURIComponent(id)}/source`); if(request===sourceRequest.current) setSource(value);}
    catch(err) {if(request===sourceRequest.current) {setSource(null);setSourceError((err as Error).message);}}
    finally {if(request===sourceRequest.current)setSourceLoading(false);}
  },[]);
  const load=useCallback(async ()=>{
    setLoading(true); setError('');
    try {const value=await api<Bootstrap>('bootstrap');setBoot(value);setSelected(previous=>previous.length?previous:value.documents.slice(0,1).map(d=>d.id)); if(value.documents[0]) void openSource(value.documents[0].id);}
    catch(err){setError((err as Error).message);}finally{setLoading(false);}
  },[openSource]);
  const loadDream=useCallback(async ()=>{setDreamError('');try{setDream(await api<DreamStatus>('dreamer/status'));}catch(err){setDreamError((err as Error).message);}},[]);
  useEffect(()=>{void load();void loadDream();setReaderOpen(window.innerWidth>1250);},[load,loadDream]);
  useEffect(()=>{if(!dream?.cycles.some(cycle=>['queued','evaluating'].includes(cycle.status)))return;const timer=window.setInterval(()=>void loadDream(),3000);return()=>window.clearInterval(timer);},[dream,loadDream]);
  useEffect(()=>{const listener=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key==='k'){event.preventDefault();setSearchOpen(value=>!value);}};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);},[]);
  useEffect(()=>{if(tab==='practice')api<Progress>('progress').then(progress=>setBoot(previous=>previous?{...previous,progress}:previous)).catch(err=>setError(err.message));if(tab==='community')api<Group[]>('groups').then(groups=>setBoot(previous=>previous?{...previous,groups}:previous)).catch(err=>setError(err.message));},[tab]);
  useEffect(()=>{
    if(!groupId){setMessages([]);return;}
    let cancelled=false;setGroupLoading(true);setGroupError('');
    api<GroupMessage[]>(`groups/${groupId}/messages`).then(value=>{if(!cancelled)setMessages(value);}).catch(err=>{if(!cancelled)setGroupError(err.message);}).finally(()=>{if(!cancelled)setGroupLoading(false);});
    return()=>{cancelled=true;};
  },[groupId]);
  function navigate(value:Tab){setTab(value);setMenuOpen(false);setError('');}
  async function action(name:string,fn:()=>Promise<void>){setBusy(name);setError('');try{await fn();}catch(err){setError((err as Error).message);}finally{setBusy('');}}
  function acceptPackage(value:EducationalPackage){setPkg(value);setPackages(previous=>[value,...previous]);if(value.conteudo_adaptado.itens[0]?.citations[0]){const c=value.conteudo_adaptado.itens[0].citations[0];void openSource(c.document_id,c);}if(!reduce&&!calm&&!document.hidden&&completion.current)animate(completion.current,{opacity:[.5,1],duration:450,ease:'outQuad'});void loadDream();}
  async function generate(event:FormEvent){event.preventDefault();await action('generate',async()=>{const value=await post<EducationalPackage>('generations',{document_ids:selected,goal,profile,format,sector,agent_id:studioAgent,method,rag_mode:rag} satisfies GenerationInput);acceptPackage(value);});}
  async function upload(file?:File){if(!file)return;if(file.size>10*1024*1024){setError('O arquivo deve ter até 10 MiB.');return;}if(!/\.(pdf|md|markdown|txt)$/i.test(file.name)){setError('Escolha um PDF, Markdown ou TXT.');return;}await action('upload',async()=>{const body=new FormData();body.append('file',file);const doc=await api<Document>('documents',{method:'POST',body});setBoot(previous=>previous?{...previous,documents:[doc,...previous.documents.filter(d=>d.id!==doc.id)]}:previous);setSelected([doc.id]);await openSource(doc.id);setUploadOpen(false);});if(fileRef.current)fileRef.current.value='';}
  async function refreshAfterRemoval(regenerate=false){
    sourceRequest.current++;setBoot(previous=>previous?{...previous,documents:previous.documents.filter(doc=>doc.id!==removing?.id)}:previous);setSource(null);setCitation(null);setChats([]);setPackages([]);setPkg(null);
    const value=await api<Bootstrap>('bootstrap');setBoot(value);await loadDream();
    const remaining=selected.filter(id=>value.documents.some(doc=>doc.id===id));
    const ids=remaining.length?remaining:value.documents.slice(0,1).map(doc=>doc.id);
    setSelected(ids);
    if(ids[0])void openSource(ids[0]);
    const original=rebuildRequest.current;
    if(!regenerate||!original)return;
    const allowed=original.document_ids.filter(id=>value.documents.some(doc=>doc.id===id));
    if(!allowed.length)return;
    try{setBusy('generate');acceptPackage(await post<EducationalPackage>('generations',{...original,document_ids:allowed}));}
    catch(e){setError('Fonte removida. Não foi possível refazer o material: '+(e as Error).message);}
  }
  function cite(value:Citation){void openSource(value.document_id,value);setReaderTab('source');setReaderOpen(true);}
  async function attempt(packageId:string,item:LearningItem,option:string):Promise<Attempt>{const result=await post<Attempt>(`quiz/${packageId}/attempt`,{item_id:item.id,option_id:option,event_id:crypto.randomUUID()});setBoot(previous=>previous?{...previous,progress:result.progress}:previous);void loadDream();return result;}
  function exportPackage(){if(!pkg)return;const url=URL.createObjectURL(new Blob([JSON.stringify(pkg,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`atlas-${pkg.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function sendChat(event:FormEvent){event.preventDefault();const message=chatInput.trim();if(!message)return;await action('chat',async()=>{const response=await post<EducationalPackage>('chat',{agent_id:agentId,message,document_ids:selected,method:'auto'});setChats(previous=>[...previous,{agentId,question:message,response}]);setChatInput('');acceptPackage(response);});}
  async function updateDream(endpoint:string,value:unknown){await action('dream',async()=>{await post(`dreamer/${endpoint}`,value);await loadDream();});}
  const currentPage=source?.pages.find(p=>p.number===page);
  const {level,xp,percent:levelPercent}=progressDisplay(boot?.progress);
  const heading={trails:'Um caminho para o que você quer aprender.',studio:'Do documento à compreensão.',chat:`Uma conversa com ${agent?.name||'seu tutor'}.`,atlas:'Ideias que encontram suas fontes.',practice:'Conhecimento pede prática.',community:'Aprender também é compartilhar.',memory:'Uma memória sob seu controle.'}[tab];
  const subtitle={trails:'Etapas com suas fontes, seu tutor e progresso salvo. Um próximo passo de cada vez.',studio:'Escolha suas fontes e diga o que quer aprender. O Atlas encontra seu tutor; você pode personalizar se quiser.',chat:agent?.description||'Selecione um tutor e converse a partir das suas fontes.',atlas:'Explore relações documentais verificáveis, uma citação de cada vez.',practice:'Revise o que você criou e teste sua compreensão, no seu ritmo.',community:'Crie um grupo local e mantenha a conversa em um só lugar.',memory:'Você decide o que lembrar. Cada mudança deixa um registro.'}[tab];

  return <ThemeProvider theme={theme}><MotionConfig reducedMotion={calm?'always':'user'}><div className={`atlas-app ${focus?'focus-mode':''} ${calm?'calm-mode':''}`}>
    <a className="skip-link" href="#workspace">Ir ao conteúdo</a>
    <aside className="sidebar desktop-sidebar">
      <Sidebar/>
    </aside>
    <div className="workspace-shell">
      <header className="topbar"><div className="row"><button className="icon-button mobile-menu" aria-label="Abrir navegação" onClick={()=>setMenuOpen(true)}><Menu size={18}/></button><span className="breadcrumb">Workspace <span>/</span> <strong>{nav.find(n=>n.id===tab)?.label}</strong></span></div><div className="row top-actions"><span className="edition-label"><span className="tiny-square"/> Atelier</span><button className={`icon-button ${focus?'active':''}`} aria-label={focus?'Sair do modo foco':'Ativar modo foco'} onClick={()=>setFocus(!focus)} title="Modo foco"><Focus size={17}/></button><button className="button source-toggle" onClick={()=>setReaderOpen(!readerOpen)}><BookOpen size={15}/><span>Fontes</span></button></div></header>
      <div className="capability-bar"><span className={`status-dot ${boot?.capabilities.llm==='remote'?'online':''}`}/>{boot?boot.capabilities.llm==='extractive_demo'?'Modo local: trechos das fontes':'Geração remota configurada':'Conectando ao seu workspace'}<span className="capability-detail">{boot?`${boot.capabilities.storage==='oci'?'Armazenamento OCI':'Armazenamento local'} · ${boot.capabilities.embeddings==='local_hash_demo'?'Busca lexical de demonstração':'Embeddings remotos'}`:'Verificando capacidades'}</span></div>
      <div className="workspace-body">
      <main id="workspace" className="main-area" tabIndex={-1}>
        <div className="editorial-head"><div className="page-context"><span className="section-rule"/>{tab==='studio'?'Estúdio de aprendizagem':nav.find(n=>n.id===tab)?.label}</div><h1>{heading}</h1><p>{subtitle}</p></div>
        {error&&!uploadOpen&&!groupOpen&&!eraseOpen&&<div className="notice error" role="alert"><CircleHelp size={17}/><span>{error}</span>{!boot&&<button className="text-button" onClick={()=>void load()}>Tentar novamente</button>}<button className="icon-button" onClick={()=>setError('')} aria-label="Dispensar erro"><X size={15}/></button></div>}
        {loading?<div className="loading-state"><CircularProgress size={24}/><p>Abrindo suas fontes…</p></div>:!boot?<div className="empty-state"><BookOpen size={30}/><h2>Seu workspace está aguardando conexão.</h2><p>Inicie os serviços do Atlas e tente novamente para acessar seus documentos.</p><button className="button" onClick={()=>void load()}><RotateCcw size={15}/>Tentar novamente</button></div>:<>
        <PendingRemovals jobs={boot.pending_removals} paused={!!removing} onComplete={()=>void refreshAfterRemoval()}/>
        {tab==='studio'&&<>
          <form onSubmit={generate} className="studio-form">
            <div className="section-heading"><h2><FileText size={16}/> Suas fontes</h2><button type="button" className="text-button" onClick={()=>setUploadOpen(true)}><Plus size={14}/>Adicionar fonte</button></div>
            <div className="document-strip">{boot.documents.map(doc=><div className={`document-chip ${selected.includes(doc.id)?'selected':''}`} key={doc.id}><label><input type="checkbox" checked={selected.includes(doc.id)} onChange={event=>{setSelected(previous=>event.target.checked?[...previous,doc.id]:previous.filter(id=>id!==doc.id));if(event.target.checked)void openSource(doc.id);}}/><FileText size={16}/><span><strong>{doc.title}</strong><small>{doc.pages} {doc.pages===1?'página':'páginas'} · v{doc.version}</small></span></label><button type="button" className="icon-button" title="Abrir fonte" aria-label={`Abrir fonte ${doc.title}`} onClick={()=>{void openSource(doc.id);setReaderOpen(true);}}><ExternalLink size={13}/></button><button type="button" className="icon-button" disabled={!!busy} aria-label={`Remover fonte ${doc.title}`} onClick={()=>{rebuildRequest.current=rebuildInput(pkg,doc.id);setRemoving(doc);}}><Trash2 size={14}/></button></div>)}{!boot.documents.length&&<button type="button" className="upload-inline" onClick={()=>setUploadOpen(true)}><Upload size={18}/>Adicione sua primeira fonte</button>}</div>
            <StudioOptions agents={agents||[]} agent={studioAgent} onAgent={setStudioAgent} profile={profile} onProfile={setProfile} format={format} onFormat={setFormat} sector={sector} onSector={setSector} method={method} onMethod={setMethod} rag={rag} onRag={setRag}/>
            <div className="goal-composer"><label htmlFor="goal">O que você quer compreender?</label><textarea id="goal" value={goal} onChange={e=>setGoal(e.target.value)} minLength={3} maxLength={2000} required placeholder="Ex.: explique os conceitos principais e como eles se conectam…" rows={2}/><div className="row between"><span className="composer-hint"><ShieldCheck size={13}/>A partir das fontes selecionadas</span><button className="button primary" disabled={studyDisabled(busy,selected,goal,boot.pending_removals)}>{busy==='generate'?<CircularProgress size={15} color="inherit"/>:<Sparkles size={15}/>}Criar meu material<ArrowRight size={15}/></button></div></div>
          </form>
          <div ref={completion}>{pkg?<PackageView pkg={pkg} cite={cite} attempt={attempt} onExport={exportPackage}/>:<div className="artifact-placeholder"><div className="artifact-glyph"><Wand2 size={22} strokeWidth={1.5}/></div><div><h3>Seu próximo aprendizado começa aqui.</h3><p>Depois de criar, o material e as citações aparecem neste espaço.</p></div></div>}</div>
        </>}
        {tab==='chat'&&<div className="chat-view"><div className="agent-thread-heading"><AgentMark id={agentId} color={agent?.color||'#74D8F7'} custom={identity?.agentId===agentId}/><div><h2>{agent?.name}</h2><p>{agent?.role}</p></div><span className="tag">{selected.length} {selected.length===1?'fonte selecionada':'fontes selecionadas'}</span></div>{chats.filter(c=>c.agentId===agentId).length===0&&<div className="chat-welcome"><span className="serif">Por onde começamos?</span><p>Faça uma pergunta sobre suas fontes. Você pode trocar de tutor na barra lateral.</p><button className="button" onClick={()=>setChatInput('Quais são as ideias principais deste documento?')}>Quais são as ideias principais?</button></div>}{chats.filter(c=>c.agentId===agentId).map((chat,i)=><div className="chat-exchange" key={i}><div className="question">{chat.question}</div><PackageView pkg={chat.response} cite={cite} attempt={attempt}/></div>)}<form className="chat-composer" onSubmit={sendChat}><label className="sr-only" htmlFor="chat-message">Mensagem para {agent?.name}</label><input id="chat-message" value={chatInput} onChange={e=>setChatInput(e.target.value)} minLength={3} maxLength={2000} placeholder={`Pergunte a ${agent?.name} sobre suas fontes…`} required/><button className="icon-button primary" aria-label="Enviar mensagem" disabled={!!busy||!selected.length}>{busy==='chat'?<CircularProgress size={17} color="inherit"/>:<Send size={17}/>}</button></form><p className="muted small">{boot.capabilities.llm==='extractive_demo'?'Sem LLM configurado: o tutor retorna trechos reais das fontes.':'O tutor responde com geração remota e referências às fontes.'}</p></div>}
        {tab==='atlas'&&<DocumentGraph documents={boot.documents} packages={packages} onDocument={id=>{void openSource(id);setReaderOpen(true);}}/>}
        {tab==='trails'&&<Trails documentIds={selected} profile={profile} agentId={agentId} renderMaterial={value=><PackageView pkg={value} cite={cite} attempt={attempt}/>}/>}
        {tab==='practice'&&<div className="practice-view"><div className="progress-panel"><Leaf size={28}/><div><h2>{boot.progress.completed} {boot.progress.completed===1?'atividade concluída':'atividades concluídas'}</h2><p>Um passo de cada vez. Respostas verificadas pelo servidor alimentam seu progresso.</p></div><span className="xp-label">{xp} XP</span></div>{packages.filter(p=>p.conteudo_adaptado.itens.some(item=>item.type==='quiz'||item.type==='flashcards')).length?packages.filter(p=>p.conteudo_adaptado.itens.some(item=>item.type==='quiz'||item.type==='flashcards')).map(p=><PackageView key={p.id} pkg={p} cite={cite} attempt={attempt}/>):<div className="empty-state"><Layers3 size={30}/><h2>Dê uma nova volta pelo que aprendeu.</h2><p>Crie um quiz ou flashcards no estúdio para praticar com suas próprias fontes.</p><div className="row"><button className="button primary" onClick={()=>{setFormat('quiz');navigate('studio');}}>Criar um quiz</button><button className="button" onClick={()=>{setFormat('flashcards');navigate('studio');}}>Criar flashcards</button></div></div>}</div>}
        {tab==='community'&&<div className="community-view"><div className="notice"><Users size={17}/><span>Grupos deste workspace local. Sua biblioteca privada não é compartilhada automaticamente.</span></div><div className="section-heading"><h2>Seus grupos</h2><button className="button" onClick={()=>setGroupOpen(true)}><Plus size={15}/>Criar grupo</button></div><div className="group-layout"><div className="group-list">{boot.groups.map(group=><button className={`group-card ${groupId===group.id?'selected':''}`} key={group.id} onClick={()=>setGroupId(group.id)}><Users size={18}/><strong>{group.name}</strong><span>{group.topic}</span></button>)}{!boot.groups.length&&<p className="muted">Crie o primeiro grupo para iniciar uma conversa.</p>}</div><div className="group-chat">{groupId?<><div className="group-chat-title">{boot.groups.find(g=>g.id===groupId)?.name}</div>{groupLoading?<CircularProgress size={20}/>:groupError?<div role="alert" className="notice error">{groupError}</div>:<div className="group-messages">{!messages.length&&<p className="muted">A conversa começa com a sua primeira mensagem.</p>}{messages.map(message=><div className="group-message" key={message.id}><div><strong>{message.author}</strong><time>{new Date(message.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time></div><p>{message.text}</p></div>)}</div>}<form className="chat-composer" onSubmit={event=>{event.preventDefault();void action('group-message',async()=>{const result=await post<GroupMessage>(`groups/${groupId}/messages`,{text:groupInput});setMessages(previous=>[...previous,result]);setGroupInput('');});}}><input aria-label="Mensagem ao grupo" required maxLength={2000} value={groupInput} onChange={e=>setGroupInput(e.target.value)} placeholder="Compartilhe uma ideia…"/><button className="icon-button primary" aria-label="Enviar ao grupo" disabled={!!busy||!groupInput.trim()}><Send size={16}/></button></form></>:<div className="empty-state"><MessageSquare size={26}/><h3>Um espaço para pensar junto.</h3><p>Selecione ou crie um grupo.</p></div>}</div></div></div>}
        {tab==='memory'&&<div className="dream-view">{dreamError&&<div className="notice error" role="alert">{dreamError}<button className="text-button" onClick={()=>void loadDream()}>Tentar novamente</button></div>}{!dream&&!dreamError?<CircularProgress size={24}/>:dream&&<><div className="memory-consent"><div className="row"><BrainCircuit size={26}/><div><h2>Memória de aprendizagem</h2><p>Permita registrar eventos de aprendizagem para consolidar preferências pedagógicas neste workspace.</p></div></div><button className={`switch ${dream.consent?'enabled':''}`} role="switch" aria-checked={dream.consent} aria-label="Consentir memória de aprendizagem" disabled={!!busy} onClick={()=>void updateDream('consent',{enabled:!dream.consent})}><span/></button></div><p className="muted small">{dream.consent?'Memória autorizada. Você pode desligar e apagar os registros quando quiser.':'Memória desligada. Novos eventos não serão registrados para consolidação.'} A memória coletiva não é ativada por este consentimento.</p><div className="memory-summary"><div><span>Política ativa</span><strong>v{dream.active_version}</strong></div><div><span>Eventos consentidos</span><strong>{dream.events}</strong></div><div><span>Ciclos registrados</span><strong>{dream.cycles.length}</strong></div></div><div className="section-heading"><h2>Ciclos do Dreamer</h2><button className="button" disabled={!!busy||!dream.consent} onClick={()=>void updateDream('cycles',{})}>{busy==='dream'?<CircularProgress size={15}/>:<GitBranch size={15}/>}Iniciar ciclo</button></div><p className="muted">Cada ciclo propõe uma revisão pedagógica, compara baseline e candidato e registra o resultado. Sem gerador e avaliador configurados, a proposta aguarda avaliação e não é promovida.</p>{dream.cycles.length?<div className="timeline">{dream.cycles.map(cycle=><article key={cycle.id}><span className="timeline-dot"/><div className="row between"><strong>{cycleLabels[cycle.status]||cycle.status}</strong><time>{new Date(cycle.created_at).toLocaleDateString('pt-BR')}</time></div><p>{cycle.reason}</p><span className="mono muted small">{cycle.id}</span></article>)}</div>:<div className="empty-inline">Nenhum ciclo registrado. Autorize a memória e inicie um ciclo quando desejar.</div>}<div className="section-heading"><h2>Versões de política</h2></div>{dream.policies.map(policy=><div className="policy-row" key={policy.version}><div><strong>Versão {policy.version} {policy.version===dream.active_version&&<span className="tag">Ativa</span>}</strong><p>{policyInstruction(policy.instruction)}</p><span className="muted small">{policy.status}</span></div>{policy.version!==dream.active_version&&policy.status==='archived'&&<button className="button" disabled={!!busy} onClick={()=>void updateDream('rollback',{version:policy.version})}><RotateCcw size={14}/>Restaurar</button>}</div>)}{dream.active_version>0&&<button className="button" disabled={!!busy} onClick={()=>void updateDream('rollback',{version:0})}><RotateCcw size={14}/>Restaurar política inicial</button>}<div className="danger-zone"><div><h3>Apagar memórias</h3><p>Exclua eventos e memórias consentidas deste workspace.</p></div><button className="button danger" onClick={()=>setEraseOpen(true)}><Trash2 size={14}/>Apagar memórias</button></div></>}</div>}
        </>}
        <footer className="workspace-footer"><span><span className="tiny-square"/>Atlas by NovaMente</span><span>Aprenda com calma. Confira na fonte.</span></footer>
      </main>
      <aside className={`reader desktop-reader ${readerOpen?'reader-open':''}`} aria-label="Inspeção de fonte"><Reader/></aside>
      </div>
    </div>
    <Modal open={customizeOpen} onOpenChange={setCustomizeOpen} title="Seu Atlas, do seu jeito" description="Personalize a identidade visual de um tutor neste navegador. Métodos e memória continuam sob seu controle."><AtlasCustomizer inStudio onComplete={()=>setCustomizeOpen(false)}/></Modal>
    <Modal open={menuOpen} onOpenChange={setMenuOpen} title="Seu workspace" description="Navegação e tutores do Atlas"><div className="mobile-sidebar-content"><Sidebar/></div></Modal>
    <SourceRemoval document={removing} onClose={()=>setRemoving(null)} onBusy={value=>setBusy(value?'delete-source':'')} onRemoved={refreshAfterRemoval} canRegenerate={canRebuild(pkg,boot?.documents,removing)}/>
    <Modal open={uploadOpen} onOpenChange={setUploadOpen} title="Adicione uma fonte" description="PDF com texto, Markdown ou TXT. Até 10 MiB. O original permanece no armazenamento configurado do workspace."><button className="dropzone" disabled={!!busy} onClick={()=>fileRef.current?.click()} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();void upload(event.dataTransfer.files[0]);}}><Upload size={28}/><strong>{busy==='upload'?'Extraindo e indexando…':'Escolha um arquivo ou arraste até aqui'}</strong><span>Suas fontes, com páginas e referências preservadas.</span>{busy==='upload'&&<CircularProgress size={20}/>}</button><input ref={fileRef} type="file" accept=".pdf,.md,.markdown,.txt" className="sr-only" onChange={event=>void upload(event.target.files?.[0])}/>{error&&<p className="error-text" role="alert">{error}</p>}</Modal>
    <Modal open={searchOpen} onOpenChange={setSearchOpen} title="Encontre sua fonte" description="Busque pelo título de documentos no seu workspace."><div className="search-input"><Search size={17}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} aria-label="Buscar documentos" placeholder="Nome do documento…"/></div><div className="search-results">{boot?.documents.filter(d=>d.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(doc=><button className="search-result" key={doc.id} onClick={()=>{setSelected([doc.id]);void openSource(doc.id);navigate('studio');setSearchOpen(false);}}><FileText size={17}/><span>{doc.title}<small>{doc.pages} páginas</small></span><ArrowRight size={15}/></button>)}{!boot?.documents.length&&<p className="muted">Adicione uma fonte para começar.</p>}</div></Modal>
    <Modal open={groupOpen} onOpenChange={setGroupOpen} title="Crie um grupo de estudo" description="Um espaço de conversa persistente neste workspace local."><form className="modal-form" onSubmit={event=>{event.preventDefault();void action('create-group',async()=>{const group=await post<Group>('groups',{name:groupName,topic:groupTopic});setBoot(previous=>previous?{...previous,groups:[...previous.groups,group]}:previous);setGroupId(group.id);setGroupOpen(false);setGroupName('');setGroupTopic('');});}}><label>Nome do grupo<input required minLength={2} maxLength={60} value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="Ex.: Clube de arquitetura"/></label><label>O que vamos estudar?<input required minLength={3} maxLength={200} value={groupTopic} onChange={e=>setGroupTopic(e.target.value)} placeholder="Tema do grupo"/></label><button className="button primary" disabled={!!busy}>Criar grupo</button>{error&&<p role="alert" className="error-text">{error}</p>}</form></Modal>
    <Modal open={eraseOpen} onOpenChange={setEraseOpen} title="Apagar memórias deste workspace?" description="Os eventos e memórias de aprendizagem serão excluídos. Seus documentos e materiais permanecem na biblioteca."><div className="row end"><button className="button" onClick={()=>setEraseOpen(false)}>Cancelar</button><button className="button danger" disabled={!!busy} onClick={()=>void action('erase',async()=>{await api('dreamer/memory',{method:'DELETE'});await loadDream();setEraseOpen(false);})}>Apagar memórias</button></div>{error&&<p role="alert" className="error-text">{error}</p>}</Modal>
  </div></MotionConfig></ThemeProvider>;

  function Sidebar(){return <><Link href="/" className="brand sidebar-home-link" aria-label="Atlas, voltar ao início"><AtlasLogo/></Link><button className="search-trigger" onClick={()=>{setMenuOpen(false);setSearchOpen(true);}}><Search size={14}/><span>Buscar uma fonte…</span><kbd>⌘ K</kbd></button><nav aria-label="Espaços de trabalho"><div className="sidebar-label">Seu espaço</div>{nav.map(({id,label,icon:Icon})=><button key={id} onClick={()=>navigate(id)} className={`nav-row ${tab===id?'active':''}`} aria-current={tab===id?'page':undefined}><Icon size={16}/><span>{label}</span>{id==='studio'&&<span className="nav-pip"/>}</button>)}</nav><div className="sidebar-agents"><div className="sidebar-label row between"><span>Seus tutores</span><span className="roster-dots">•••</span></div>{agents?.map(a=><button className={`agent-row ${agentId===a.id?'active':''}`} key={a.id} onClick={()=>{setAgentId(a.id);navigate('chat');}}><AgentMark id={a.id} color={a.color} small custom={identity?.agentId===a.id}/><span><strong>{a.name}</strong><small>{a.role}</small></span><span className="agent-status" style={{background:a.color}}/></button>)}{!boot&&<p className="muted small">Conectando tutores…</p>}</div><div className="sidebar-bottom"><Link href={settingsHref} className="custom-atlas-button" style={{textDecoration:'none'}}><Settings2 size={15}/><span>Conexões e modelos</span><ArrowRight size={13}/></Link><button className="custom-atlas-button" onClick={()=>{setMenuOpen(false);setCustomizeOpen(true);}}><Sparkles size={15}/><span>{identity?`Personalizar ${identity.name}`:'Crie seu Atlas'}</span><ArrowRight size={13}/></button><button className={`calm-button ${calm?'enabled':''}`} onClick={()=>setCalm(!calm)} aria-pressed={calm}><Leaf size={15}/><span>Baixo estímulo</span><span>{calm?'Ativo':'Off'}</span></button><div className="local-user"><div className="user-avatar">A</div><div><strong>Meu aprendizado</strong><span>Workspace local</span></div><ShieldCheck size={15}/></div><div className="progress-label"><span>Nível {level}</span><span className="mono">{xp} XP</span></div><LinearProgress variant="determinate" value={levelPercent} sx={{height:3,borderRadius:1,bgcolor:'#22262b','& .MuiLinearProgress-bar':{bgcolor:'#85e7b8'}}}/><span className="progress-footnote">No seu ritmo, sempre.</span></div></>;}
  function Reader(){return <><div className="reader-heading"><div><BookOpen size={15}/><strong>Fontes & evidências</strong></div><button className="icon-button reader-close" aria-label="Fechar fontes" onClick={()=>setReaderOpen(false)}><X size={16}/></button></div><div className="reader-tabs"><button className={readerTab==='source'?'active':''} onClick={()=>setReaderTab('source')}>Manuscrito</button><button className={readerTab==='details'?'active':''} onClick={()=>setReaderTab('details')}>Proveniência</button></div><div className="reader-scroll">{sourceLoading?<div className="reader-empty"><CircularProgress size={22}/><p>Abrindo documento…</p></div>:sourceError?<div className="notice error" role="alert">{sourceError}<button className="text-button" onClick={()=>activeDoc&&void openSource(activeDoc.id)}>Tentar novamente</button></div>:readerTab==='source'&&source?<><div className="source-meta"><span><FileText size={12}/>{source.title}</span><span>p. {page}/{source.pages.length}</span></div><article className="archival-paper"><div className="paper-kicker"><span>Documento original</span><span>página {page}</span></div><h2>{source.title}</h2><div className="paper-rule"/><div className="paper-text">{currentPage?highlight(currentPage.text,citation?.page===page?citation.excerpt:undefined):'Esta página não está disponível.'}</div><div className="paper-footer"><span>Extraído da sua fonte</span><ShieldCheck size={13}/></div></article><div className="page-navigation"><button className="icon-button" aria-label="Página anterior" disabled={page<=1} onClick={()=>setPage(page-1)}><ChevronLeft size={16}/></button><span className="mono">Página {page} de {source.pages.length}</span><button className="icon-button" aria-label="Próxima página" disabled={page>=source.pages.length} onClick={()=>setPage(page+1)}><ChevronRight size={16}/></button></div>{citation&&<div className="evidence-note"><ShieldCheck size={16}/><p>O destaque corresponde ao trecho citado no seu material. Confira o contexto na página.</p></div>}</>:readerTab==='details'?<div className="provenance"><h3>O caminho da evidência</h3>{pkg?<><p>{pkg.mode==='extractive_demo'?'Trechos literais recuperados das fontes. Sem síntese por LLM.':'Material produzido por geração remota a partir das fontes.'}</p><dl><dt>Método</dt><dd>{methodLabels[pkg.decision.method]}</dd><dt>Recuperação</dt><dd>{pkg.decision.rag_mode}</dd><dt>Avaliador</dt><dd>{pkg.quality.judge_verdict==='not_evaluated'?'Não avaliado':pkg.quality.judge_verdict}</dd><dt>Armazenamento</dt><dd>{pkg.storage.provider} · {pkg.storage.status}</dd></dl><p>{pkg.decision.reason}</p>{pkg.quality.limitations.map((text,i)=><p className="small muted" key={i}>{text}</p>)}<h4>Fontes e versões</h4>{pkg.document_refs.map(doc=><div className="reference-detail" key={doc.id}><strong>{doc.title}</strong><span>Versão {doc.version}</span><code title={doc.hash}>{doc.hash.slice(0,24)}…</code></div>)}{pkg.agent_trace.length>0&&<><h4>Etapas de processamento</h4>{pkg.agent_trace.map((trace,i)=><div className="trace-item" key={i}><GitBranch size={13}/><div><strong>{trace.agent_id} · {trace.action}</strong><p>{trace.summary}</p></div></div>)}</>}</>:<p>Crie seu primeiro material para inspecionar decisões, versões e etapas de processamento.</p>}</div>:<div className="reader-empty"><BookOpen size={32}/><h3>O conhecimento tem uma fonte.</h3><p>Selecione um documento ou abra uma citação para ler a evidência aqui.</p><button className="button" onClick={()=>setUploadOpen(true)}><Plus size={14}/>Adicionar fonte</button></div>}</div><div className="reader-bottom"><ShieldCheck size={13}/><span>Referências reais. Contexto sempre à mão.</span></div></>;}
}

function policyInstruction(instruction:string):string {try{const value=JSON.parse(instruction);if(value.preferred_method)return `Método ${methodLabels[value.preferred_method as Method]||value.preferred_method}; etapas ${value.step_size==='short'?'curtas':'médias'}${value.question_first?'; começar com uma pergunta':''}.`;}catch{}return instruction;}
function highlight(text:string,excerpt?:string):ReactNode {if(!excerpt)return text;const index=text.indexOf(excerpt);if(index<0)return text;return <>{text.slice(0,index)}<mark>{excerpt}</mark>{text.slice(index+excerpt.length)}</>;}
function PackageView({pkg,cite,attempt,onExport}:{pkg:EducationalPackage;cite:(c:Citation)=>void;attempt:(p:string,i:LearningItem,o:string)=>Promise<Attempt>;onExport?:()=>void}){
  return <section className="package"><div className="package-top"><span className="package-type"><Layers3 size={14}/>{pkg.mode==='extractive_demo'?'Material extrativo':'Material de aprendizagem'}</span>{onExport&&<button className="text-button" onClick={onExport}><ArrowDownToLine size={14}/>Exportar JSON</button>}</div><div className="package-body"><div className="row between"><span className="tag">{methodLabels[pkg.decision.method]}</span><span className="muted small">{pkg.quality.judge_verdict==='not_evaluated'?'Avaliação externa pendente':pkg.quality.judge_verdict==='supported'?'Suporte documental avaliado':pkg.quality.judge_verdict}</span></div><h2>{pkg.conteudo_adaptado.titulo}</h2><p className="package-intro">{pkg.conteudo_adaptado.introducao_contextualizada}</p>{pkg.metadados&&<p className="muted small">Estudo estimado: {pkg.metadados.tempo_estimado_estudo_minutos} min · Estimativa de leitura e prática{pkg.metadados.conceitos_chave.length>0&&<> · Conceitos nas fontes: {pkg.metadados.conceitos_chave.join(', ')}</>}</p>}{pkg.status==='abstained'&&<div className="notice">As fontes não oferecem evidência suficiente para este objetivo. Tente uma pergunta mais próxima do documento.</div>}{pkg.conteudo_adaptado.itens.map((item,index)=><LearningCard key={item.id} item={item} index={index} cite={cite} attempt={option=>attempt(pkg.id,item,option)}/>)}</div><div className="package-bottom"><ShieldCheck size={14}/><p><DecisionNote decision={pkg.decision}/></p><span className="mono">{pkg.storage.provider==='local'?'Salvo localmente':pkg.storage.status==='verified'?'OCI verificado':'OCI armazenado'}</span></div></section>;
}
function LearningCard({item,index,cite,attempt}:{item:LearningItem;index:number;cite:(c:Citation)=>void;attempt:(o:string)=>Promise<Attempt>}){
  const [flipped,setFlipped]=useState(false);
  const [result,setResult]=useState<Attempt|null>(null);
  const [pending,setPending]=useState(false);
  const [selected,setSelected]=useState('');
  const [error,setError]=useState('');
  async function answer(option:string){setPending(true);setError('');setSelected(option);try{setResult(await attempt(option));}catch(err){setError((err as Error).message);}finally{setPending(false);}}
  return <article className={`learning-item ${item.type==='flashcards'?'flashcard':''}`}><div className="learning-heading"><span className="item-number">{String(index+1).padStart(2,'0')}</span><h3>{item.title}</h3></div>{item.type==='flashcards'?<><AnimatePresence mode="wait" initial={false}><motion.div key={flipped?'back':'front'} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.18}} className="flashcard-face">{flipped?item.back||item.body:item.front||item.title}</motion.div></AnimatePresence><button className="button" onClick={()=>setFlipped(!flipped)}><RotateCcw size={14}/>{flipped?'Ver pergunta':'Revelar resposta'}</button><p className="small muted">Revelar o cartão não gera XP.</p></>:<p className="learning-body">{item.body}</p>}{item.type==='quiz'&&item.options&&<div className="quiz-options">{item.options.map((option,i)=><button disabled={pending||!!result?.correct} className={`quiz-option ${selected===option.id?'chosen':''} ${result&&selected===option.id?(result.correct?'correct':'incorrect'):''}`} key={option.id} onClick={()=>void answer(option.id)}><span>{String.fromCharCode(65+i)}</span>{option.text}{selected===option.id&&pending&&<CircularProgress size={15}/>}</button>)}{result&&<div className={`quiz-feedback ${result.correct?'success':''}`} role="status">{result.correct?<CheckCheck size={17}/>:<CircleHelp size={17}/>}<p>{result.feedback}{result.xp_awarded>0&&<strong> +{result.xp_awarded} XP</strong>}</p></div>}{error&&<p className="error-text" role="alert">{error}</p>}</div>}{item.citations.length>0&&<div className="citations">{item.citations.map((citation,i)=><button className="citation" onClick={()=>cite(citation)} key={`${citation.document_id}-${citation.page}-${i}`} title={`Ler evidência: ${citation.document_title}, página ${citation.page}`}><BookOpen size={12}/><span>{citation.document_title}</span><span>p. {citation.page}</span><ExternalLink size={10}/></button>)}</div>}</article>;
}
function DocumentGraph({documents,packages,onDocument}:{documents:Document[];packages:EducationalPackage[];onDocument:(id:string)=>void}){
  const nodes=documents.slice(0,16).map((doc,i)=>({...doc,x:300+Math.cos(i/Math.max(documents.length,1)*Math.PI*2-Math.PI/2)*190,y:215+Math.sin(i/Math.max(documents.length,1)*Math.PI*2-Math.PI/2)*135}));
  const relations=packages.flatMap(pkg=>pkg.conteudo_adaptado.itens.flatMap(item=>item.citations.map(c=>({documentId:c.document_id,title:item.title,page:c.page})))).filter((item,i,all)=>all.findIndex(other=>other.documentId===item.documentId&&other.title===item.title)===i).slice(0,24);
  return <div className="graph-view"><div className="graph-legend"><span><i/>Documento</span><span><i className="citation-dot"/>Citação real</span><span className="muted">Relações de fonte, sem inferências automáticas</span></div>{nodes.length?<div className="graph-canvas"><svg viewBox="0 0 600 430" role="img" aria-label={`Grafo de ${nodes.length} documentos e ${relations.length} referências geradas`}><defs><pattern id="dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="#343a42"/></pattern></defs><rect width="600" height="430" fill="url(#dots)"/>{relations.map((relation,i)=>{const doc=nodes.find(n=>n.id===relation.documentId);if(!doc)return null;const x=300+Math.cos(i*2.399)*65,y=215+Math.sin(i*2.399)*65;return <g key={i}><line x1={doc.x} y1={doc.y} x2={x} y2={y} stroke="#85e7b8" strokeOpacity=".35"/><circle cx={x} cy={y} r="5" fill="#85e7b8"><title>{relation.title} · p. {relation.page}</title></circle></g>;})}{nodes.map(doc=><g key={doc.id} className="graph-node" tabIndex={0} role="button" aria-label={`Abrir ${doc.title}`} onClick={()=>onDocument(doc.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onDocument(doc.id);}}}><circle cx={doc.x} cy={doc.y} r="24" fill="#171a1e" stroke="#ff4f38" strokeWidth="1.2"/><path d={`M${doc.x-6} ${doc.y-8}h9l3 3v13h-12Z`} fill="none" stroke="#ff9d8f"/><text x={doc.x} y={doc.y+42} textAnchor="middle" fill="#b9bdc5" fontSize="16">{doc.title.length>18?doc.title.slice(0,17)+'…':doc.title}</text><title>{doc.title}</title></g>)}</svg></div>:<div className="empty-state"><Network size={32}/><p>Adicione fontes no estúdio para começar seu atlas.</p></div>}<div className="graph-details"><h2>Conexões que você pode conferir</h2><p>{relations.length?`${relations.length} referências nos materiais criados nesta sessão. Abra um documento no grafo para ler sua fonte.`:'As fontes já estão no atlas. Crie um material no estúdio para acrescentar suas citações ao grafo.'}</p>{relations.map((relation,i)=><button key={i} className="graph-reference" onClick={()=>onDocument(relation.documentId)}><GitBranch size={14}/><span>{relation.title}</span><span className="mono">p. {relation.page}</span></button>)}</div></div>;
}

function canRebuild(pkg:EducationalPackage|null,documents:Document[]|undefined,removed:Document|null){
  return Boolean(rebuildInput(pkg,removed?.id));
}
function DecisionNote({decision}:{decision:EducationalPackage['decision']}){
  return [decision.agent_reason,decision.reason].filter(Boolean).join(' ');
}

function rebuildInput(pkg:EducationalPackage|null,removedId?:string):GenerationInput|null{
  if(!pkg?.study_request)return null;
  const document_ids=pkg.document_refs.filter(doc=>doc.id!==removedId).map(doc=>doc.id);
  return document_ids.length?{...pkg.study_request,document_ids}:null;
}

function studyDisabled(busy:string,selected:string[],goal:string,pending:Bootstrap['pending_removals']){
  return Boolean(busy||!selected.length||!goal.trim()||pending?.length);
}
