"""Optional external MongoDB metadata projection; SQLite remains canonical."""
import os
import hashlib
from urllib.parse import urlsplit
from .providers import ProviderError

def origin():
    parsed = urlsplit(os.getenv('MONGODB_URI', ''))
    value = parsed.scheme + '://' + parsed.netloc.rsplit('@', 1)[-1].lower() + parsed.path + '\0' + os.getenv('MONGODB_DATABASE', 'atlas')
    return hashlib.sha256(value.encode()).hexdigest()

FIELDS = ("id", "title", "hash", "version", "pages", "characters", "created_at")
class MongoProjection:
    def __init__(self, client=None):
        if client is None:
            uri=os.getenv("MONGODB_URI", "")
            if not uri.startswith(("mongodb+srv://", "mongodb://")):
                raise ProviderError("Configure MONGODB_URI no servidor.")
            try:
                from pymongo import MongoClient
                client=MongoClient(uri,tls=True,maxPoolSize=2,minPoolSize=0,serverSelectionTimeoutMS=3000,connectTimeoutMS=3000,socketTimeoutMS=3000)
            except ImportError as exc:
                raise ProviderError("Instale requirements-mongo.lock somente no serviço que usar a projeção MongoDB.") from exc
        self.client=client
        self.collection=client[os.getenv("MONGODB_DATABASE", "atlas")]["document_metadata"]
    def close(self):
        self.client.close()
    def put(self,tenant,metadata):
        self.collection.create_index([("tenant",1),("id",1)],unique=True)
        payload={key:metadata[key] for key in FIELDS}
        self.collection.update_one({"tenant":tenant,"id":metadata["id"]},{"$set":payload},upsert=True)
    def delete(self,tenant,doc_id):
        self.collection.delete_one({"tenant":tenant,"id":doc_id})
    def list(self,tenant,after="",limit=50):
        query={"tenant":tenant}
        if after:query["id"]={"$gt":after}
        return list(self.collection.find(query,{"_id":0,**{key:1 for key in FIELDS}}).sort("id",1).limit(min(max(limit,1),100)))

def project(tenant,metadata):
    if not os.getenv("MONGODB_URI"):
        return "disabled"
    projection=None
    try:
        projection=MongoProjection();projection.put(tenant,metadata)
        return "synced"
    except Exception:
        # Projection failures never overwrite canonical data or report fake sync.
        return "pending"
    finally:
        if projection:projection.close()

if __name__ == "__main__":
    from .store import Store
    tenant=os.getenv("ATLAS_TENANT_ID", "local-workspace")
    from .documents.locking import library_lock
    from .documents.provenance import project_stored
    store=Store()
    with library_lock(store,tenant):
        results=[project_stored(store,tenant,doc) for doc in store.documents(tenant)]
    if "pending" in results:
        raise SystemExit("Projeção MongoDB pendente; confira conexão/SDK no servidor.")
    print("Projeção de metadados:",len(results),"documentos; estados:",sorted(set(results)))
