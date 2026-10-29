"""Rebuild vectors after changing provider, keeping source/section IDs stable."""
import json
import os
import uuid
from . import vector_index
from . import providers, credentials
from .rag import local_vector
from .store import Store
from .documents.locking import synchronized
from .documents.provenance import remember_vectors

@synchronized
def reindex(store, tenant):
    return credentials.scoped(_reindex, store, tenant)

def _reindex(store, tenant):
    with store.db() as db:
        rows = db.execute("SELECT id,doc_id,text FROM passages WHERE tenant=? ORDER BY id", (tenant,)).fetchall()
    updates = []
    model = credentials.embedding_id()
    for start in range(0, len(rows), 16):
        batch = rows[start:start+16]
        vectors = providers.embed([row["text"] for row in batch]) or [local_vector(row["text"]) for row in batch]
        updates.extend((json.dumps({"model": model, "values": vector}), tenant, row["id"]) for row, vector in zip(batch, vectors))
    if vector_index.enabled() and updates:
        if not credentials.configured("embeddings"):
            raise providers.ProviderError("Qdrant requer embeddings semânticos.")
        index=vector_index.QdrantIndex()
        try:
            vectors=[json.loads(update[0])["values"] for update in updates]
            generation=uuid.uuid4().hex[:12]
            collection=vector_index.collection_name(model,len(vectors[0]),generation)
            remember_vectors(store,tenant,rows,collection)
            collection=index.upsert(tenant,rows,vectors,model,generation)
            updates=[(json.dumps({**json.loads(value),"collection":collection,"origin":vector_index.origin()}),owner,section) for value,owner,section in updates]
        finally:
            index.close()
    with store.db() as db:
        db.executemany("UPDATE passages SET vector=? WHERE tenant=? AND id=?", updates)
    return len(updates)

if __name__ == "__main__":
    print(f"Reindexação concluída: {reindex(Store(), os.getenv('ATLAS_TENANT_ID', 'local-workspace'))} passagens. Fontes e citações preservadas.")
