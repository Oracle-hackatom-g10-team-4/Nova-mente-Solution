from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

class Decision(StrictModel):
    method: Literal["socratic", "feynman", "first_principles", "warburg"]
    rag_mode: Literal["vector", "hybrid", "lm"]
    reason: str = Field(min_length=1, max_length=1000)
    source: Literal["policy", "typesafe"] = "policy"

    agent_id: Literal["nilo", "lumi", "prisma", "fio", "soma"] | None = None
    agent_source: Literal["manual", "policy", "typesafe"] | None = None
    agent_reason: str | None = Field(default=None, max_length=500)

class Generation(StrictModel):
    document_ids: list[str] = Field(min_length=1, max_length=8)
    goal: str = Field(min_length=3, max_length=2000)
    profile: Literal["beginner", "developer", "architect", "executive"] = "beginner"
    format: Literal["tutorial", "flashcards", "quiz", "summary"] = "tutorial"
    sector: Literal["general", "fintech", "health", "ecommerce"] = "general"
    agent_id: Literal["nilo", "lumi", "prisma", "fio", "soma"] = "nilo"
    method: Literal["auto", "socratic", "feynman", "first_principles", "warburg"] = "auto"
    rag_mode: Literal["auto", "vector", "hybrid", "lm"] = "auto"
    decision: Decision | None = None
    conversation_context: str = Field(default="", max_length=8000)

class Attempt(StrictModel):
    item_id: str = Field(min_length=1, max_length=100)
    option_id: str = Field(min_length=1, max_length=100)
    event_id: str = Field(min_length=1, max_length=100)

class GroupInput(StrictModel):
    name: str = Field(min_length=2, max_length=60)
    topic: str = Field(min_length=3, max_length=200)

class MessageInput(StrictModel):
    text: str = Field(min_length=1, max_length=2000)

class Consent(StrictModel):
    enabled: bool

class Rollback(StrictModel):
    version: int = Field(ge=0)

class Experience(StrictModel):
    kind: Literal["generation", "attempt"]
    payload: dict
    revision: int = Field(ge=0)

class RemoteItem(StrictModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=6000)
    evidence_ids: list[str] = Field(min_length=1, max_length=8)
    front: str | None = Field(default=None, max_length=3000)
    back: str | None = Field(default=None, max_length=3000)
    options: list[str] | None = Field(default=None, min_length=2, max_length=4)
    correct_index: int | None = Field(default=None, ge=0, le=3)

class RemoteContent(StrictModel):
    title: str = Field(min_length=1, max_length=200)
    introduction: str = Field(max_length=2000)
    items: list[RemoteItem] = Field(min_length=1, max_length=6)

class Citation(StrictModel):
    document_id: str
    document_title: str
    page: int = Field(ge=1)
    section_id: str
    excerpt: str = Field(min_length=1, max_length=1800)
    excerpt_hash: str = Field(pattern=r"^[a-f0-9]{64}$")

class LearningItem(StrictModel):
    id: str
    type: Literal["tutorial", "flashcards", "quiz", "summary"]
    title: str
    body: str = Field(max_length=6000)
    citations: list[Citation] = Field(min_length=1, max_length=8)
    front: str | None = Field(default=None, max_length=3000)
    back: str | None = Field(default=None, max_length=3000)
    options: list[dict[str, str]] | None = None

class AdaptedContent(StrictModel):
    titulo: str
    introducao_contextualizada: str
    itens: list[LearningItem] = Field(max_length=6)

class Quality(StrictModel):
    judge_verdict: Literal["not_evaluated", "supported", "contradicted", "insufficient_evidence"]
    schema_valid: bool
    limitations: list[str]

class StorageReceipt(StrictModel):
    provider: Literal["local", "oci"]
    object_key: str
    status: Literal["stored", "verified"]

    namespace: str | None = Field(default=None, max_length=256)
    bucket: str | None = Field(default=None, max_length=256)

class LearningMetadata(StrictModel):
    perfil_aplicado: str
    formato_gerado: str
    tempo_estimado_estudo_minutos: int = Field(ge=1)
    estimativa_metodo: str
    conceitos_chave: list[str] = Field(max_length=8)
    conceitos_origem: str
    pre_requisitos: list[str]
    pre_requisitos_status: Literal["nao_inferidos"]

class StudyRequest(StrictModel):
    document_ids: list[str]
    goal: str
    profile: Literal['beginner', 'developer', 'architect', 'executive']
    format: Literal['tutorial', 'flashcards', 'quiz', 'summary']
    sector: Literal['general', 'fintech', 'health', 'ecommerce']
    agent_id: Literal['auto', 'nilo', 'lumi', 'prisma', 'fio', 'soma']
    method: Literal['auto', 'socratic', 'feynman', 'first_principles', 'warburg']
    rag_mode: Literal['auto', 'vector', 'hybrid', 'lm']

class EducationalPackage(StrictModel):
    study_request: StudyRequest | None = None
    id: str
    schema_version: Literal["1.0"]
    status: Literal["ready", "abstained"]
    mode: Literal["extractive_demo", "remote"]
    document_refs: list[dict[str, str | int]]
    decision: Decision
    profile: Literal["beginner", "developer", "architect", "executive"]
    sector: Literal["general", "fintech", "health", "ecommerce"]
    metadados: LearningMetadata | None = None
    conteudo_adaptado: AdaptedContent
    quality: Quality
    storage: StorageReceipt
    agent_trace: list[dict[str, str]]
    created_at: str
