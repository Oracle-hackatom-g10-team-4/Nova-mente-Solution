"""Operator-only provenance repair. Never marks a removal completed or bypasses cleanup."""
import argparse
import hashlib
import json
from pathlib import Path
from pydantic import BaseModel, ConfigDict, Field
from typing import Annotated
from ..store import Store, now
from .locking import synchronized


class OCIIdentity(BaseModel):
    model_config = ConfigDict(extra='forbid')
    object_key: str
    namespace: str = Field(min_length=1, max_length=256)
    bucket: str = Field(min_length=1, max_length=256)


class Target(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: str = Field(pattern=r'^atlas_[A-Za-z0-9_]+$')
    origin: str = Field(pattern=r'^[a-f0-9]{64}$')


class Manifest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    tenant: str = Field(min_length=1)
    document_id: str = Field(pattern=r'^doc_[a-f0-9]{20}$')
    reviewed_all_historical_destinations: bool
    oci: list[OCIIdentity] = []
    collections: list[Target] = []
    memory_origins: list[Annotated[str, Field(pattern=r'^[a-f0-9]{64}$')]] = Field(default_factory=list)
    mongo_origin: str | None = Field(default=None, pattern=r'^[a-f0-9]{64}$')


def preserve(existing, supplied):
    if existing and existing != supplied:
        raise ValueError('Destino conhecido não pode ser substituído; restaure a configuração original.')
    return supplied


def repair(payload, manifest):
    if not manifest.reviewed_all_historical_destinations:
        raise ValueError('Confira os registros históricos antes de reconciliar.')
    receipts = {item['object_key']: item for item in payload['objects'] if item['provider'] == 'oci'}
    for item in manifest.oci:
        receipt = receipts[item.object_key]
        for key in ('namespace', 'bucket'):
            receipt[key] = preserve(receipt.get(key), getattr(item, key))
    targets = {item['name']: item for item in payload['collections']}
    for target in manifest.collections:
        previous = targets.get(target.name, {})
        targets[target.name] = {'name': target.name, 'origin': preserve(previous.get('origin'), target.origin)}
    payload['collections'] = list(targets.values())
    payload['mongo_origin'] = preserve(payload.get('mongo_origin'), manifest.mongo_origin)
    payload['mongo'] = bool(payload['mongo_origin'])
    targets = set(payload.get('memory_origins', []))
    targets.update(manifest.memory_origins)
    payload['memory_origins'] = sorted(targets)
    payload['remote_memory'] = bool(targets)
    payload['legacy_projection_unknown'] = False
    return payload


@synchronized
def reconcile(store, tenant, doc_id, raw):
    manifest = Manifest.model_validate(raw)
    if (manifest.tenant, manifest.document_id) != (tenant, doc_id):
        raise ValueError('Manifesto pertence a outra operação.')
    with store.db() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT status,payload FROM document_removals WHERE tenant=? AND id=?', (tenant, doc_id)).fetchone()
        if not row or row['status'] == 'deleted':
            raise ValueError('Reconciliação exige uma remoção pendente.')
        payload = repair(json.loads(row['payload']), manifest)
        payload['reconciliation'] = {'at': now(), 'sha256': hashlib.sha256(json.dumps(raw, sort_keys=True).encode()).hexdigest()}
        db.execute('UPDATE document_removals SET payload=?,next_attempt=0 WHERE tenant=? AND id=?', (json.dumps(payload), tenant, doc_id))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tenant', required=True)
    parser.add_argument('--document-id', required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    args = parser.parse_args()
    reconcile(Store(), args.tenant, args.document_id, json.loads(args.manifest.read_text()))
    print('Proveniência reconciliada. A limpeza real será repetida pelo worker; conclusão ainda não confirmada.')
