export type Profile = 'beginner' | 'developer' | 'architect' | 'executive';
export type Format = 'tutorial' | 'flashcards' | 'quiz' | 'summary';
export type Method = 'auto' | 'socratic' | 'feynman' | 'first_principles' | 'warburg';
export type RagMode = 'auto' | 'vector' | 'hybrid' | 'lm';
export type AgentId = 'nilo' | 'lumi' | 'prisma' | 'fio' | 'soma';
export interface Agent {id: AgentId; name: string; role: string; description: string; color: string}
export interface StorageReceipt {provider: 'local' | 'oci'; object_key: string; status: 'stored' | 'verified'; namespace?:string; bucket?:string}
export interface Document {id: string; title: string; filename: string; media_type: string; pages: number; characters: number; status: 'ready'; version: number; hash: string; created_at: string; storage: StorageReceipt}
export interface Citation {document_id: string; document_title: string; page: number; section_id: string; excerpt: string; excerpt_hash: string}
export interface Decision {method: Exclude<Method,'auto'>; rag_mode: Exclude<RagMode,'auto'>; reason: string; source: 'policy' | 'typesafe'; agent_id?:AgentId; agent_source?:'manual'|'policy'|'typesafe'; agent_reason?:string}
export interface GenerationInput {document_ids: string[]; goal: string; profile: Profile; format: Format; sector: 'general' | 'fintech' | 'health' | 'ecommerce'; agent_id: AgentId|'auto'; method: Method; rag_mode: RagMode}
export interface LearningItem {id: string; type: Format; title: string; body: string; citations: Citation[]; front?: string; back?: string; options?: {id: string; text: string}[]}
export interface LearningMetadata {perfil_aplicado: Profile; formato_gerado: Format; tempo_estimado_estudo_minutos: number; estimativa_metodo: string; conceitos_chave: string[]; conceitos_origem: string; pre_requisitos: string[]; pre_requisitos_status: 'nao_inferidos'}
export interface EducationalPackage {study_request?:GenerationInput; metadados?: LearningMetadata; id: string; schema_version: '1.0'; status: 'ready' | 'abstained'; mode: 'extractive_demo' | 'remote'; document_refs: {id: string; title: string; version: number; hash: string}[]; decision: Decision; conteudo_adaptado: {titulo: string; introducao_contextualizada: string; itens: LearningItem[]}; quality: {judge_verdict: 'not_evaluated' | 'supported' | 'insufficient_evidence' | 'contradicted'; schema_valid: boolean; limitations: string[]}; storage: StorageReceipt; agent_trace: {agent_id: AgentId; action: string; summary: string; kind: 'handoff' | 'tool' | 'review'}[]; created_at: string}
export interface Progress {xp: number; level: number; completed: number; level_start: number; level_end: number; level_percent: number}
export interface Group {id: string; name: string; topic: string; member_count: number; created_at: string}
export interface GroupMessage {id: string; group_id: string; author: string; text: string; created_at: string}
export interface Bootstrap {pending_removals?:RemovalStatus[]; agents: Agent[]; documents: Document[]; progress: Progress; capabilities: {llm: 'extractive_demo' | 'remote'; embeddings: string; web_search: boolean; storage: 'local' | 'oci'; deployment: 'local'}; groups: Group[]}
export interface DreamStatus {consent: boolean; events: number; active_version: number; policies: {version: number; instruction: string; status: string}[]; cycles: {id: string; status: string; reason: string; created_at: string}[]}

export interface TrailStep {id:string; title:string; goal:string; format:Format; status:"pending"|"completed"; package_id:string|null; completion_evidence:"user_acknowledgement"|"server_verified_quiz"|null; unlocked:boolean}
export interface Trail {id:string; goal:string; profile:Profile; agent_id:AgentId; planner:"local_template_v1"; document_refs:EducationalPackage["document_refs"]; steps:TrailStep[]; completed_steps:number; created_at:string}

export interface RemovalImpact {packages:number; trails:number; xp:number; conversations:number; reset_learning_memory:boolean}
export interface RemovalStatus {document_id:string; status:'cleanup_pending'|'deleted'; attention_required?:boolean; impact:RemovalImpact}
export interface RemovalPreview {document_id:string; title:string; impact:RemovalImpact}
