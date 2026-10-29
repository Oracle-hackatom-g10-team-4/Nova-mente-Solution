'use client';
import {useEffect,useRef,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {X,Trash2} from 'lucide-react';
import type {Document,RemovalPreview,RemovalStatus} from '@atlas/contracts';
import {api} from '@/lib/api';

type Props={document:Document|null;onClose:()=>void;onBusy:(v:boolean)=>void;onRemoved:(regenerate:boolean)=>Promise<void>;canRegenerate:boolean};
export default function SourceRemoval({document,onClose,onBusy,onRemoved,canRegenerate}:Props){
  const [preview,setPreview]=useState<RemovalPreview|null>(null);
  const [job,setJob]=useState<RemovalStatus|null>(null);
  const [error,setError]=useState('');
  const [working,setWorking]=useState(false);
  const [regenerate,setRegenerate]=useState(false);
  const completed=useRef(false);
  const recreate=useRef(false);
  useEffect(()=>{
    setPreview(null);setJob(null);setError('');setRegenerate(false);completed.current=false;
    if(!document)return;
    let cancelled=false;
    api<RemovalPreview>(`documents/${document.id}/deletion`).then(value=>{if(!cancelled)setPreview(value);}).catch(e=>{if(!cancelled)setError(e.message);});
    return()=>{cancelled=true;};
  },[document]);
  async function finish(value:RemovalStatus){
    setJob(value);
    if(value.status!=='deleted'||completed.current)return;
    completed.current=true;
    try{await onRemoved(recreate.current);onClose();}catch(e){completed.current=false;setError('Fonte removida; não foi possível atualizar a tela. '+(e as Error).message);}finally{onBusy(false);setWorking(false);}
  }
  useEffect(()=>{
    if(job?.status!=='cleanup_pending')return;
    let cancelled=false;
    const timer=window.setInterval(()=>{api<RemovalStatus>(`documents/${job.document_id}/removal`).then(value=>{if(!cancelled)void finish(value);}).catch(e=>{if(!cancelled)setError(e.message);});},2000);
    return()=>{cancelled=true;window.clearInterval(timer);};
  });
  const locked=working&&!job;
  function close(){setWorking(false);recreate.current=false;onBusy(false);onClose();}
  async function remove(){
    if(!document)return;
    setWorking(true);onBusy(true);setError('');recreate.current=canRegenerate&&regenerate;
    try{
      const value=await api<RemovalStatus>(`documents/${document.id}`,{method:'DELETE'});
      if(value.status==='cleanup_pending')await onRemoved(false);
      await finish(value);
    }
    catch(e){setError((e as Error).message);setWorking(false);onBusy(false);}
  }
  return <Dialog.Root open={!!document} onOpenChange={open=>{if(!open&&!locked)close();}}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content">
    <div className="row between"><Dialog.Title>Remover fonte?</Dialog.Title><button className="icon-button" disabled={locked} aria-label="Fechar" onClick={close}><X size={18}/></button></div>
    <Dialog.Description>A fonte e os resultados que dependem dela serão removidos do workspace.</Dialog.Description>
    {preview&&<><strong>{preview.title}</strong><ul className="removal-impact"><li>{preview.impact.packages} materiais e {preview.impact.trails} trilhas vinculadas</li><li>{preview.impact.xp} XP vinculado a esses exercícios</li><li>Todo o histórico de conversas e a memória pedagógica serão limpos para não reutilizar trechos da fonte. Sua preferência de memória e os outros documentos permanecem.</li></ul></>}
    {canRegenerate&&<label className="removal-regenerate"><input type="checkbox" checked={regenerate} disabled={working} onChange={e=>setRegenerate(e.target.checked)}/>Refazer o material aberto com as fontes restantes</label>}
    <RemovalProgress job={job}/>
    {error&&<p className="error-text" role="alert">{error}</p>}
    <div className="row end"><button className="button" disabled={locked} onClick={close}>Fechar</button><button className="button danger" disabled={!preview||working} onClick={()=>void remove()}><Trash2 size={14}/>{working?'Removendo…':'Remover fonte'}</button></div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}

export function PendingRemovals({jobs=[],paused=false,onComplete}:{jobs?:RemovalStatus[];paused?:boolean;onComplete:()=>void}){
  useEffect(()=>{
    if(paused||!jobs.length)return;
    const timer=window.setInterval(async()=>{
      const results=await Promise.all(jobs.map(job=>api<RemovalStatus>(`documents/${job.document_id}/removal`))).catch(()=>[]);
      if(results.length&&results.every(job=>job.status==='deleted'))onComplete();
    },3000);
    return()=>window.clearInterval(timer);
  },[jobs,paused,onComplete]);
  return jobs.length&&!paused?<p className="notice" role="status">Há uma limpeza de fontes em andamento. A geração volta a ficar disponível quando ela terminar.</p>:null;
}

function RemovalProgress({job}:{job:RemovalStatus|null}){
  if(job?.status!=='cleanup_pending')return null;
  return <p role="status">{job.attention_required?'Fonte retirada do acervo. Os destinos de integrações antigas precisam ser conferidos pelo administrador antes de confirmar a limpeza completa.':'Fonte retirada do acervo. Finalizando a limpeza dos arquivos e serviços; tentaremos novamente automaticamente se necessário.'} Você pode fechar esta janela e acompanhar na biblioteca. Se fechar, poderá refazer o material depois.</p>;
}
