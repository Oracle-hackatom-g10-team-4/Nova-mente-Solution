"""Transactional quiz attempts: immutable event IDs and one XP reward per item."""
import json
from .store import now
from .progression import progress
from .errors import ConflictError


def validate_answer(row, submission):
    answers = json.loads(row["answers"])
    expected = answers.get(submission.item_id)
    if not expected:
        raise ValueError("Questão não encontrada neste material.")
    package = json.loads(row["payload"])
    question = next(item for item in package["conteudo_adaptado"]["itens"] if item["id"] == submission.item_id)
    if submission.option_id not in {option["id"] for option in question.get("options", [])}:
        raise ValueError("Alternativa inválida.")
    return expected, package


def previous_result(db, tenant, package_id, submission):
    row = db.execute("SELECT * FROM quiz_attempts WHERE tenant=? AND event_id=?", (tenant, submission.event_id)).fetchone()
    if not row:
        return None
    if (row["package_id"], row["item_id"], row["option_id"]) != (package_id, submission.item_id, submission.option_id):
        raise ConflictError("Este evento já identifica outra resposta.")
    return json.loads(row["response"])


def register(store, tenant, package_id, submission, expected):
    with store.db() as db:
        db.execute("BEGIN IMMEDIATE")
        if not db.execute("SELECT 1 FROM packages WHERE tenant=? AND id=?", (tenant, package_id)).fetchone():
            raise LookupError("Material não encontrado.")
        previous = previous_result(db, tenant, package_id, submission)
        if previous is not None:
            return previous, False
        correct = expected["correct"] == submission.option_id
        awarded = 0
        if correct:
            cursor = db.execute("INSERT OR IGNORE INTO xp VALUES(?,?,?,?)", (tenant, f"{package_id}:{submission.item_id}", 15, now()))
            awarded = 15 if cursor.rowcount else 0
        row = db.execute("SELECT COALESCE(SUM(amount),0) xp,COUNT(*) completed FROM xp WHERE tenant=?", (tenant,)).fetchone()
        result = {"correct": correct, "feedback": expected["feedback"] if correct else "Ainda não. Reabra a fonte e procure a afirmação literal antes de tentar novamente.",
                  "xp_awarded": awarded, "progress": progress(row["xp"], row["completed"])}
        db.execute("INSERT INTO quiz_attempts VALUES(?,?,?,?,?,?)", (tenant, submission.event_id, package_id, submission.item_id, submission.option_id, json.dumps(result)))
    return result, True


def attempt(store, tenant, package_id, submission):
    memory = store.memory_state(tenant)
    expected, package = validate_answer(store.package(tenant, package_id), submission)
    result, created = register(store, tenant, package_id, submission, expected)
    if created and memory["enabled"]:
        store.event(tenant, "attempt", {"package_id": package_id, "item_id": submission.item_id,
                    "correct": result["correct"], "method": package["decision"]["method"]}, memory["revision"])
    return result
