from ..documents.locking import synchronized
"""Path use cases over the canonical Store. All progression is server-owned."""
import json
from ..store import uid, now
from ..errors import ConflictError
from .policy import steps, available_steps, selected_step, compatible


def get(store, tenant, trail_id):
    with store.db() as db:
        row = db.execute("SELECT payload FROM trails WHERE tenant=? AND id=?", (tenant, trail_id)).fetchone()
    if not row:
        raise LookupError("Trilha não encontrada neste workspace.")
    return present(json.loads(row[0]))


def present(trail):
    return trail | {"steps": available_steps(trail["steps"]),
                    "completed_steps": sum(step["status"] == "completed" for step in trail["steps"])}


def list_trails(store, tenant):
    with store.db() as db:
        rows = db.execute("SELECT payload FROM trails WHERE tenant=? ORDER BY created_at DESC LIMIT 100", (tenant,)).fetchall()
    return [present(json.loads(row[0])) for row in rows]


@synchronized
def create(store, tenant, request):
    docs = {doc["id"]: doc for doc in store.documents(tenant)}
    ids = list(dict.fromkeys(request.document_ids))
    if not all(doc_id in docs for doc_id in ids):
        raise LookupError("Uma fonte não pertence a este workspace.")
    trail = {"id": uid("trail"), "goal": request.goal, "profile": request.profile,
             "agent_id": request.agent_id, "planner": "local_template_v1",
             "document_refs": [{key: docs[doc_id][key] for key in ("id", "title", "hash", "version")} for doc_id in ids],
             "steps": steps(request.goal), "created_at": now()}
    with store.db() as db:
        db.execute("INSERT INTO trails VALUES(?,?,?,?)", (tenant, trail["id"], json.dumps(trail, ensure_ascii=False), trail["created_at"]))
    return present(trail)


def generation_input(store, tenant, trail_id, step_id):
    trail = get(store, tenant, trail_id)
    step = selected_step(trail, step_id)
    if step["status"] == "completed":
        raise ConflictError("Etapa concluída. O material permanece disponível na trilha.")
    current = {doc["id"]: doc["hash"] for doc in store.documents(tenant)}
    if any(current.get(doc["id"]) != doc["hash"] for doc in trail["document_refs"]):
        raise ConflictError("As fontes mudaram; crie uma nova trilha para esta versão.")
    return {"document_ids": [doc["id"] for doc in trail["document_refs"]], "goal": step["goal"],
            "profile": trail["profile"], "agent_id": trail["agent_id"], "format": step["format"],
            "method": "auto", "rag_mode": "auto", "sector": "general"}


def _save(db, tenant, trail):
    db.execute("UPDATE trails SET payload=? WHERE tenant=? AND id=?", (json.dumps(trail, ensure_ascii=False), tenant, trail["id"]))


def _locked(db, tenant, trail_id, step_id):
    db.execute("BEGIN IMMEDIATE")
    row = db.execute("SELECT payload FROM trails WHERE tenant=? AND id=?", (tenant, trail_id)).fetchone()
    if not row:
        raise LookupError("Trilha não encontrada neste workspace.")
    trail = json.loads(row[0])
    selected_step(trail, step_id)
    return trail, next(step for step in trail["steps"] if step["id"] == step_id)


@synchronized
def attach(store, tenant, trail_id, step_id, package_id):
    generation_input(store, tenant, trail_id, step_id)
    row = store.package(tenant, package_id)
    with store.db() as db:
        trail, step = _locked(db, tenant, trail_id, step_id)
        if step["status"] == "completed":
            raise ConflictError("Etapa já concluída.")
        compatible(trail, step, json.loads(row["payload"]), json.loads(row["input"]))
        step["package_id"] = package_id
        _save(db, tenant, trail)
    return present(trail)


def _completion_evidence(db, tenant, step):
    if not step["package_id"]:
        raise ConflictError("Prepare o material desta etapa antes de concluir.")
    if step["format"] != "quiz":
        return "user_acknowledgement"
    row = db.execute("SELECT answers FROM packages WHERE tenant=? AND id=?", (tenant, step["package_id"])).fetchone()
    answers = json.loads(row[0])
    earned = {row[0] for row in db.execute("SELECT key FROM xp WHERE tenant=? AND key LIKE ?", (tenant, step["package_id"] + ":%"))}
    if not answers or any(f"{step['package_id']}:{item}" not in earned for item in answers):
        raise ConflictError("Responda corretamente às questões desta etapa antes de continuar.")
    return "server_verified_quiz"


@synchronized
def complete(store, tenant, trail_id, step_id):
    with store.db() as db:
        trail, step = _locked(db, tenant, trail_id, step_id)
        if step["status"] != "completed":
            step["completion_evidence"] = _completion_evidence(db, tenant, step)
            step["status"] = "completed"
            _save(db, tenant, trail)
    return present(trail)
