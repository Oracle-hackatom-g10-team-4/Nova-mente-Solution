"""Delete canonical data atomically, then retry bounded external cleanup durably."""
import json
import os
import time
from ..store import now
from ..providers import ProviderError
from . import policy, cleanup, memory
from .locking import synchronized, library_lock


def status(store, tenant, doc_id):
    with store.db() as db:
        row = db.execute('SELECT id,status,impact,payload FROM document_removals WHERE tenant=? AND id=?', (tenant, doc_id)).fetchone()
    if not row:
        raise LookupError('Remoção não encontrada neste workspace.')
    return {'document_id': row['id'], 'status': row['status'], 'impact': json.loads(row['impact']),
            'attention_required': cleanup.attention(json.loads(row['payload']))}


def pending(store, tenant):
    with store.db() as db:
        rows = db.execute("SELECT id FROM document_removals WHERE tenant=? AND status<>'deleted' ORDER BY created_at LIMIT 100", (tenant,)).fetchall()
    return [status(store, tenant, row[0]) for row in rows]


def ensure_ready(store, tenant):
    with store.db() as db:
        exists = db.execute("SELECT 1 FROM document_removals WHERE tenant=? AND status<>'deleted' LIMIT 1", (tenant,)).fetchone()
    if exists:
        raise ProviderError('Aguarde a limpeza das fontes removidas antes de gerar novos materiais.')


def preview(store, tenant, doc_id):
    with store.db() as db:
        doc = db.execute('SELECT id,title FROM documents WHERE tenant=? AND id=?', (tenant, doc_id)).fetchone()
        if not doc:
            raise LookupError('Fonte não encontrada neste workspace.')
        return {'document_id': doc_id, 'title': doc['title'], 'impact': policy.impact(db, tenant, doc_id)}


def purge(db, tenant, doc_id):
    packages, trails = policy.affected(db, tenant, doc_id)
    for row in packages:
        db.execute('DELETE FROM quiz_attempts WHERE tenant=? AND package_id=?', (tenant, row['id']))
        db.execute('DELETE FROM xp WHERE tenant=? AND key>=? AND key<?', (tenant, row['id']+':', row['id']+';'))
        db.execute('DELETE FROM packages WHERE tenant=? AND id=?', (tenant, row['id']))
    for trail_id in trails:
        db.execute('DELETE FROM trails WHERE tenant=? AND id=?', (tenant, trail_id))
    for table in ('passages', 'passages_fts'):
        db.execute(f'DELETE FROM {table} WHERE tenant=? AND doc_id=?', (tenant, doc_id))
    db.execute('DELETE FROM documents WHERE tenant=? AND id=?', (tenant, doc_id))
    memory.clear(db, tenant)


def begin(store, dreamer, tenant, doc_id):
    with dreamer.state_lock, store.db() as db:
        db.execute('BEGIN IMMEDIATE')
        existing = db.execute('SELECT 1 FROM document_removals WHERE tenant=? AND id=?', (tenant, doc_id)).fetchone()
        if existing:
            return
        doc = db.execute('SELECT * FROM documents WHERE tenant=? AND id=?', (tenant, doc_id)).fetchone()
        if not doc:
            raise LookupError('Fonte não encontrada neste workspace.')
        impact = policy.impact(db, tenant, doc_id)
        targets = memory.destinations(db, tenant)
        payload = policy.snapshot(db, tenant, doc) | {'remote_memory': bool(targets), 'memory_origins': targets}
        if not json.loads(doc['integrations']) and os.getenv('MONGODB_URI'):
            payload['mongo'] = True
        purge(db, tenant, doc_id)
        db.execute('INSERT INTO document_removals(tenant,id,status,payload,impact,created_at) VALUES(?,?,?,?,?,?)', (tenant, doc_id, 'cleanup_pending', json.dumps(payload), json.dumps(impact), now()))
        dreamer.epochs[tenant] = dreamer.epochs.get(tenant, 0) + 1


@synchronized
def retry(store, tenant, doc_id):
    with store.db() as db:
        row = db.execute('SELECT status,payload,attempts FROM document_removals WHERE tenant=? AND id=?', (tenant, doc_id)).fetchone()
    if not row:
        raise LookupError('Remoção não encontrada neste workspace.')
    if row['status'] == 'deleted':
        return status(store, tenant, doc_id)
    try:
        remaining = cleanup.finish(store, tenant, json.loads(row['payload']))
    except Exception:
        with store.db() as db:
            delay = min(300, 10 * (2 ** min(row['attempts'], 5)))
            db.execute('UPDATE document_removals SET last_attempt=?,next_attempt=?,attempts=attempts+1 WHERE tenant=? AND id=?', (time.time(), time.time()+delay, tenant, doc_id))
        return status(store, tenant, doc_id)
    with store.db() as db:
        db.execute("UPDATE document_removals SET status=?,payload=?,last_attempt=?,next_attempt=?,attempts=0 WHERE tenant=? AND id=?", ('cleanup_pending' if remaining else 'deleted', json.dumps(remaining), time.time(), 0, tenant, doc_id))
    return status(store, tenant, doc_id)


def remove(store, dreamer, tenant, doc_id):
    with library_lock(store, tenant):
        return remove_locked(store, dreamer, tenant, doc_id)


def remove_locked(store, dreamer, tenant, doc_id):
    begin(store, dreamer, tenant, doc_id)
    with store.db() as db:
        row = db.execute('SELECT payload FROM document_removals WHERE tenant=? AND id=?', (tenant, doc_id)).fetchone()
    payload = json.loads(row[0])
    external = payload.get('remote_memory') or payload.get('mongo') or payload.get('collections') or any(item['provider'] == 'oci' for item in payload.get('objects', []))
    return status(store, tenant, doc_id) if external else retry(store, tenant, doc_id)


def due(store):
    with store.db() as db:
        return db.execute("SELECT tenant,id FROM document_removals WHERE status<>'deleted' AND next_attempt<=? ORDER BY last_attempt,created_at LIMIT 3", (time.time(),)).fetchall()
