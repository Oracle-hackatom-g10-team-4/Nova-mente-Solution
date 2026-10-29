import json
import threading
from typing import Literal
from pydantic import Field
from . import providers, credentials
from .learning import active_policy, remote_content
from .models import StrictModel, Generation
from .store import uid, now

from .replay import Policy, BASELINE, compare

class Dreamer:
    """Independent memory domain; proposals cannot modify code, tools or permissions."""
    def __init__(self, store):
        self.store, self.lock = store, threading.Lock()
        self.state_lock = threading.RLock()
        self.epochs = {}

    def status(self, tenant):
        with self.store.db() as db:
            consent = db.execute("SELECT enabled FROM consent WHERE tenant=?", (tenant,)).fetchone()
            count = db.execute("SELECT COUNT(*) FROM memory_events WHERE tenant=?", (tenant,)).fetchone()[0]
            policies = [dict(row) for row in db.execute("SELECT version,instruction,status FROM policies WHERE tenant=? ORDER BY version DESC", (tenant,)).fetchall()]
            cycles = [dict(row) for row in db.execute("SELECT id,status,reason,created_at FROM cycles WHERE tenant=? ORDER BY created_at DESC LIMIT 10", (tenant,)).fetchall()]
            worlds = db.execute("SELECT COUNT(*) FROM dream_worlds WHERE tenant=?", (tenant,)).fetchone()[0]
            revision = db.execute("SELECT COALESCE((SELECT version FROM memory_revisions WHERE tenant=?),0)", (tenant,)).fetchone()[0]
        active = next((p for p in policies if p["status"] == "active"), None)
        enabled = bool(consent and consent[0])
        return {"algorithm": "history_replay_v1", "worlds": worlds, "consent": enabled, "revision": revision, "events": count, "active_version": active["version"] if active else 0, "active_policy": json.loads(active["instruction"]) if active and enabled else None, "policies": policies, "cycles": cycles}

    def consent(self, tenant, enabled):
        with self.state_lock, self.store.db() as db:
            db.execute("INSERT INTO memory_revisions VALUES(?,1) ON CONFLICT(tenant) DO UPDATE SET version=version+1", (tenant,))
            if not enabled:
                db.execute("UPDATE jobs SET status='cancelled' WHERE tenant=? AND status IN ('queued','running')", (tenant,))
                self.epochs[tenant] = self.epochs.get(tenant, 0) + 1
                db.execute("UPDATE cycles SET status='cancelled',reason='Consentimento revogado; ciclo cancelado.' WHERE tenant=? AND status IN ('queued','evaluating')", (tenant,))
            db.execute("INSERT INTO consent VALUES(?,?) ON CONFLICT(tenant) DO UPDATE SET enabled=excluded.enabled", (tenant, int(enabled)))
        return self.status(tenant)

    def forget(self, tenant):
        with self.state_lock, self.store.db() as db:
            db.execute("INSERT INTO memory_revisions VALUES(?,1) ON CONFLICT(tenant) DO UPDATE SET version=version+1", (tenant,))
            self.epochs[tenant] = self.epochs.get(tenant, 0) + 1
            for table in ("jobs", "memory_events", "policies", "cycles", "consent", "conversations", "replay_cases", "dream_worlds", "agent_runs"):
                db.execute(f"DELETE FROM {table} WHERE tenant=?", (tenant,))
        return self.status(tenant)

    def rollback(self, tenant, version):
        with self.state_lock, self.store.db() as db:
            if version and not db.execute("SELECT 1 FROM policies WHERE tenant=? AND version=? AND status IN ('active','archived')", (tenant, version)).fetchone():
                raise ValueError("Versão não foi aprovada ou não pertence ao workspace.")
            self.epochs[tenant] = self.epochs.get(tenant, 0) + 1
            db.execute("INSERT INTO memory_revisions VALUES(?,1) ON CONFLICT(tenant) DO UPDATE SET version=version+1", (tenant,))
            db.execute("UPDATE cycles SET status='cancelled',reason='Rollback solicitado; ciclo cancelado.' WHERE tenant=? AND status IN ('queued','evaluating')", (tenant,))
            db.execute("UPDATE jobs SET status='cancelled' WHERE tenant=? AND status IN ('queued','running')", (tenant,))
            db.execute("UPDATE policies SET status='archived' WHERE tenant=? AND status='active'", (tenant,))
            db.execute("UPDATE policies SET status='active' WHERE tenant=? AND version=?", (tenant, version))
        return self.status(tenant)

    def cycle(self, tenant, cycle_id=None):
        cycle_id = cycle_id or uid("dream")
        if not self.lock.acquire(blocking=False):
            return self.record(tenant, cycle_id, "cancelled", "Outro ciclo já está em execução; esta solicitação foi cancelada.")
        epoch = self.epochs.get(tenant, 0)
        revision = None
        def record_result(status, reason, metrics=None):
            return self.record(tenant, cycle_id, status, reason, metrics, expected_epoch=epoch, expected_revision=revision)
        try:
            state = self.status(tenant)
            revision = state['revision']
            stop = self._preconditions(state, record_result)
            if stop:
                return stop
            context = self._replay_context(tenant, record_result)
            if 'stop' in context:
                return context['stop']
            record_result('evaluating', 'Consolidando histórico e avaliando políticas em simulador; nenhum replay chama o agente ou o judge.')
            candidate = self._propose(tenant, revision, epoch, context)
            if any(candidate[key] != context['baseline'][key] for key in ('preferred_method', 'step_size', 'question_first')):
                return record_result('rejected', 'O candidato mudou uma preferência sem contrafactual observado; baseline preservada.')
            self._assert_revision(tenant, revision, epoch)
            metrics = self._compare(context, candidate)
            return self._publish(tenant, revision, epoch, candidate, metrics, record_result)
        except Exception:
            record_result('failed', 'O replay não pôde concluir. Política anterior preservada; consulte a configuração dos provedores.')
            raise
        finally:
            self.lock.release()

    def _preconditions(self, state, record):
        if not state['consent']:
            return record('awaiting_consent', 'Ative a memória individual antes de consolidar experiências.')
        if state['events'] < 3:
            return record('awaiting_events', 'Ainda não há três experiências consentidas para propor uma revisão.')
        if not providers.llm_ready() or not credentials.configured('decision'):
            return record('awaiting_evaluation', 'Memórias preservadas. Configure geração e Typesafe para comparar baseline/candidato; nenhuma melhoria foi promovida sem avaliação.')
        return None

    def _replay_context(self, tenant, record):
        with self.store.db() as db:
            recent = db.execute("SELECT created_at FROM cycles WHERE tenant=? AND status IN ('promoted','rejected','failed') ORDER BY created_at DESC LIMIT 1", (tenant,)).fetchone()
            if recent and recent[0][:10] == now()[:10]:
                return {'stop': record('awaiting_evaluation', 'Limite de um replay remoto por workspace/dia atingido.')}
            events = [dict(row) for row in db.execute('SELECT kind,payload FROM memory_events WHERE tenant=? ORDER BY created_at DESC LIMIT 20', (tenant,)).fetchall()]
            rows = db.execute('SELECT payload FROM dream_worlds WHERE tenant=? ORDER BY rowid DESC LIMIT 20', (tenant,)).fetchall()
        worlds = [json.loads(row['payload']) for row in rows]
        if len(worlds) < 3:
            return {'stop': record('awaiting_events', 'São necessários três mundos com pelo menos duas alternativas reais avaliadas. O simulador não inventa experiências.')}
        split = max(1, len(worlds) // 3)
        baseline = Policy.model_validate(active_policy(self.store, tenant) or BASELINE).model_dump()
        return {'events': events, 'heldout': worlds[:split], 'train': worlds[split:], 'baseline': baseline, 'worlds': len(worlds)}

    def _assert_revision(self, tenant, revision, epoch):
        if self.status(tenant)['revision'] != revision or epoch != self.epochs.get(tenant, 0):
            raise ValueError('Consentimento ou memória mudou durante proposta.')

    def _propose(self, tenant, revision, epoch, context):
        from .documents.locking import library_lock
        with library_lock(self.store, tenant):
            self._assert_revision(tenant, revision, epoch)
            proposed = providers.complete('Você é o desenvolvedor de políticas Dream-RSI do Atlas. Consolide as experiências e proponha uma política tipada de exploração. O modelo, o avaliador e preferred_method/step_size/question_first são fixos; copie esses três campos da baseline e altere somente exploration. Não altere segurança, ferramentas, permissões ou código. Use somente os mundos de treinamento fornecidos.', json.dumps({'events': context['events'], 'training_worlds': context['train'], 'baseline': context['baseline'], 'schema': Policy.model_json_schema(), 'objective': 'max observed grounded score - 0.03 * observed attempts; W=1'}, ensure_ascii=False), agent_id='soma', purpose='dreamer_policy')
        return Policy.model_validate(proposed).model_dump()

    def _compare(self, context, candidate):
        baseline = context['baseline']['exploration']
        training = compare(context['train'], baseline, candidate['exploration'])
        validation = compare(context['heldout'], baseline, candidate['exploration'])
        valid = all((training['covered'], validation['covered'], training['no_regression'], validation['no_regression'], training['no_quality_regression'], validation['no_quality_regression']))
        return {'baseline': validation['baseline'], 'candidate': validation['candidate'], 'training': training, 'heldout': validation,
                'worlds': context['worlds'], 'valid': valid, 'algorithm': 'history_replay_v1', 'rubric': 'grounding_and_pedagogical_utility_v1', 'learning_efficacy': 'not_measured'}

    def _publish(self, tenant, revision, epoch, candidate, metrics, record):
        promote = metrics['valid'] and self.status(tenant)['consent'] and metrics['candidate'] > metrics['baseline'] + 0.01
        with self.state_lock, self.store.db() as db:
            db.execute('BEGIN IMMEDIATE')
            current = db.execute('SELECT version FROM memory_revisions WHERE tenant=?', (tenant,)).fetchone()
            if epoch != self.epochs.get(tenant, 0) or not current or current[0] != revision:
                return {'status': 'cancelled', 'reason': 'Memória desativada ou apagada durante o ciclo.'}
            version = db.execute('SELECT COALESCE(MAX(version),0)+1 FROM policies WHERE tenant=?', (tenant,)).fetchone()[0]
            if promote:
                db.execute("UPDATE policies SET status='archived' WHERE tenant=? AND status='active'", (tenant,))
            db.execute('INSERT INTO policies VALUES(?,?,?,?,?)', (tenant, version, json.dumps(candidate), 'active' if promote else 'rejected', now()))
        return record('promoted' if promote else 'rejected', 'Melhoria observada no replay; política pedagógica promovida.' if promote else 'O candidato não melhorou todos os critérios; baseline preservada.', metrics | {'version': version})

    def record(self, tenant, cycle_id, status, reason, metrics=None, *, expected_epoch=None, expected_revision=None):
        with self.state_lock, self.store.db() as db:
            db.execute('BEGIN IMMEDIATE')
            revision = db.execute('SELECT COALESCE((SELECT version FROM memory_revisions WHERE tenant=?),0)', (tenant,)).fetchone()[0]
            valid_epoch = expected_epoch is None or expected_epoch == self.epochs.get(tenant, 0)
            valid_revision = expected_revision is None or expected_revision == revision
            if not valid_epoch or not valid_revision:
                return {'id': cycle_id, 'status': 'cancelled', 'reason': 'A memória mudou; o ciclo antigo não será registrado.'}
            db.execute("INSERT INTO cycles VALUES(?,?,?,?,?,?) ON CONFLICT(tenant,id) DO UPDATE SET status=excluded.status,reason=excluded.reason,metrics=excluded.metrics", (tenant, cycle_id, status, reason, json.dumps(metrics or {}), now()))
        return {"id": cycle_id, "status": status, "reason": reason, "metrics": metrics or {}, "created_at": now()}
