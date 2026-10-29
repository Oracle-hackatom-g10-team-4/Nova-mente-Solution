"""Record non-secret integration identities when a source is actually ingested."""
import json
import os
from .. import vector_index
from ..projections import origin as mongo_origin


def integrations():
    return json.dumps({'version': 1, 'mongo_origin': mongo_origin() if os.getenv('MONGODB_URI') else None})


def vector(values, model, collection):
    return json.dumps({'model': model, 'values': values, 'collection': collection,
                       'origin': vector_index.origin() if collection else None})


def remember_vectors(store, tenant, rows, collection):
    """Keep all prior destinations, including writes interrupted before metadata replacement."""
    with store.db() as db:
        for doc_id in {row['doc_id'] for row in rows}:
            doc = db.execute('SELECT integrations FROM documents WHERE tenant=? AND id=?', (tenant, doc_id)).fetchone()
            integrations = json.loads(doc[0])
            targets = integrations.get('qdrant_targets', [])
            previous = db.execute("SELECT DISTINCT json_extract(vector,'$.collection'),json_extract(vector,'$.origin') FROM passages WHERE tenant=? AND doc_id=?", (tenant, doc_id)).fetchall()
            additions = [{'name': item[0], 'origin': item[1]} for item in previous if item[0]]
            additions.append({'name': collection, 'origin': vector_index.origin()})
            for target in additions:
                if target not in targets:
                    targets.append(target)
            integrations['qdrant_targets'] = targets
            db.execute('UPDATE documents SET integrations=? WHERE tenant=? AND id=?', (json.dumps(integrations), tenant, doc_id))


def project_stored(store, tenant, doc):
    """Record the CLI destination before any upsert, and refuse hidden destination changes."""
    from ..projections import project
    if os.getenv('MONGODB_URI'):
        with store.db() as db:
            row = db.execute('SELECT integrations FROM documents WHERE tenant=? AND id=?', (tenant, doc['id'])).fetchone()
            value = json.loads(row[0])
            if value.get('mongo_origin') and value['mongo_origin'] != mongo_origin():
                raise ValueError('Restaure MongoDB original; migração exige limpar a projeção anterior primeiro.')
            value['mongo_origin'] = mongo_origin()
            db.execute('UPDATE documents SET integrations=? WHERE tenant=? AND id=?', (json.dumps(value), tenant, doc['id']))
    return project(tenant, doc)
