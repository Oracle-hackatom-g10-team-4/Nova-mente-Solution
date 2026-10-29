"""Find derived resources using server-owned document references, not text matches."""
import json


def affected(db, tenant, doc_id):
    packages = db.execute("SELECT id,json_extract(payload,'$.storage') AS storage FROM packages WHERE tenant=? AND EXISTS(SELECT 1 FROM json_each(json_extract(input,'$.document_ids')) WHERE value=?)", (tenant, doc_id)).fetchall()
    trails = db.execute("SELECT id FROM trails WHERE tenant=? AND EXISTS(SELECT 1 FROM json_each(json_extract(payload,'$.document_refs')) WHERE json_extract(value,'$.id')=?)", (tenant, doc_id)).fetchall()
    return packages, [row[0] for row in trails]


def impact(db, tenant, doc_id):
    packages, trails = affected(db, tenant, doc_id)
    xp = sum(db.execute("SELECT COALESCE(SUM(amount),0) FROM xp WHERE tenant=? AND key>=? AND key<?", (tenant, row['id']+':', row['id']+';')).fetchone()[0] for row in packages)
    history = db.execute("SELECT COUNT(*) FROM conversations WHERE tenant=?", (tenant,)).fetchone()[0]
    return {"packages": len(packages), "trails": len(trails), "xp": xp, "conversations": history, "reset_learning_memory": True}


def snapshot(db, tenant, doc):
    packages, _ = affected(db, tenant, doc['id'])
    rows = db.execute("SELECT DISTINCT json_extract(vector,'$.collection') AS collection,json_extract(vector,'$.origin') AS origin FROM passages WHERE tenant=? AND doc_id=?", (tenant, doc['id'])).fetchall()
    collections = [{'name': row['collection'], 'origin': row['origin']} for row in rows if row['collection']]
    integrations = json.loads(doc['integrations'])
    for target in integrations.get('qdrant_targets', []):
        if target not in collections:
            collections.append(target)
    return {"document_id": doc['id'], "collections": collections,
            'legacy_projection_unknown': integrations.get('version') != 1,
            'mongo': bool(integrations.get('mongo_origin')), 'mongo_origin': integrations.get('mongo_origin'),
            "objects": [json.loads(doc['storage'])] + [json.loads(row['storage']) for row in packages]}
