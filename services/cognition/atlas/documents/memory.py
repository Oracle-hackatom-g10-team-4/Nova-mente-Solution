"""Invalidate learned context while preserving the user's consent preference."""
from .. import providers
from .locking import synchronized
import os
import hashlib


def origin():
    return hashlib.sha256(os.getenv("MEMORY_SERVICE_URL", "").rstrip("/").encode()).hexdigest()
import httpx

TABLES = ('jobs', 'memory_events', 'policies', 'cycles', 'conversations', 'replay_cases', 'dream_worlds', 'agent_runs')


def clear(db, tenant):
    db.execute("INSERT INTO memory_revisions VALUES(?,1) ON CONFLICT(tenant) DO UPDATE SET version=version+1", (tenant,))
    for table in TABLES:
        db.execute(f"DELETE FROM {table} WHERE tenant=?", (tenant,))


def remote(tenant, doc_id):
    base = providers.safe_base(os.environ['MEMORY_SERVICE_URL'])
    response = httpx.post(base + '/v1/dreamer/reset-sources', headers={
        'Authorization': 'Bearer ' + os.environ['MEMORY_SERVICE_TOKEN'], 'x-atlas-tenant': tenant}, json={'operation_id': doc_id}, timeout=10)
    response.raise_for_status()
    if response.json().get('reset') is not True:
        raise providers.ProviderError('A memória externa ainda não confirmou a limpeza.')


def reset_sources(store, dreamer, tenant, operation_id):
    with dreamer.state_lock, store.db() as db:
        db.execute('BEGIN IMMEDIATE')
        if db.execute('SELECT 1 FROM memory_source_resets WHERE tenant=? AND id=?', (tenant, operation_id)).fetchone():
            return {'reset': True}
        clear(db, tenant)
        db.execute('INSERT INTO memory_source_resets VALUES(?,?)', (tenant, operation_id))
        dreamer.epochs[tenant] = dreamer.epochs.get(tenant, 0) + 1
    return {'reset': True}


def destinations(db, tenant):
    targets = [row[0] for row in db.execute('SELECT origin FROM memory_destinations WHERE tenant=?', (tenant,))]
    if os.getenv('MEMORY_SERVICE_URL') and origin() not in targets:
        targets.append(origin())
    return targets


def mismatched(payload):
    targets = payload.get('memory_origins', [payload.get('memory_origin')])
    return bool(payload.get('remote_memory') and origin() not in targets)


def clean_remote(store, tenant, payload):
    if mismatched(payload):
        raise ValueError('Restaure um dos destinos originais de memória antes de limpar.')
    remote(tenant, payload['document_id'])
    targets = payload.get('memory_origins', [payload.get('memory_origin')])
    payload['memory_origins'] = [target for target in targets if target != origin()]
    payload['remote_memory'] = bool(payload['memory_origins'])
    with store.db() as db:
        db.execute('DELETE FROM memory_destinations WHERE tenant=? AND origin=?', (tenant, origin()))


@synchronized
def publish(store, tenant, kind, payload, expected_revision):
    from .service import ensure_ready
    ensure_ready(store, tenant)
    base = providers.safe_base(os.environ['MEMORY_SERVICE_URL'])
    headers = {'Authorization': 'Bearer ' + os.environ['MEMORY_SERVICE_TOKEN'], 'x-atlas-tenant': tenant}
    try:
        status = httpx.get(base + '/v1/dreamer/status', headers=headers, timeout=10)
        status.raise_for_status()
        state = status.json()
        if state.get('consent') and (expected_revision is None or state.get('revision') == expected_revision):
            with store.db() as db:
                db.execute('INSERT OR IGNORE INTO memory_destinations VALUES(?,?)', (tenant, origin()))
            response = httpx.post(base + '/v1/dreamer/experiences', json={'kind': kind, 'payload': payload, 'revision': state['revision']}, headers=headers, timeout=10)
            response.raise_for_status()
    except (httpx.HTTPError, ValueError) as exc:
        raise providers.ProviderError('A memória externa está indisponível. Não foram enviados dados sem consentimento.') from exc
