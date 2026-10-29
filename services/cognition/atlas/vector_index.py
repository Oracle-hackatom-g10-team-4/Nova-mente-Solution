"""Optional Qdrant REST port: tenant/doc/model filters, no raw document payloads."""
import hashlib
import json
import os
import re
import uuid
from urllib.parse import urlsplit
import httpx
from .providers import ProviderError

def origin():
    return hashlib.sha256(os.getenv('QDRANT_URL', '').rstrip('/').encode()).hexdigest()

def collection_name(model, dimension, generation=""):
    suffix = hashlib.sha256(f"{model}:{dimension}".encode()).hexdigest()[:20]
    return "atlas_" + suffix + ("_" + generation if generation else "")


def enabled():
    backend = os.getenv("VECTOR_BACKEND", "sqlite")
    if backend not in ("sqlite", "qdrant"):
        raise ProviderError("VECTOR_BACKEND deve ser sqlite ou qdrant.")
    return backend == "qdrant"

class QdrantIndex:
    def __init__(self, transport=None):
        base = os.getenv("QDRANT_URL", "")
        parsed = urlsplit(base)
        if parsed.username or parsed.password or parsed.query or parsed.fragment or not parsed.hostname:
            raise ProviderError("Configure QDRANT_URL sem credenciais na URL.")
        if parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in ("127.0.0.1", "localhost", "qdrant")):
            raise ProviderError("Qdrant externo requer HTTPS.")
        self.client = httpx.Client(base_url=base.rstrip("/"), headers={"api-key":os.getenv("QDRANT_API_KEY", "")}, timeout=20, follow_redirects=False, transport=transport)

    def close(self):
        self.client.close()

    def request(self, method, path, body=None, missing=False):
        try:
            response = self.client.request(method,path,json=body)
            if missing and response.status_code == 404:
                return None
            response.raise_for_status()
            return response.json().get("result")
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            raise ProviderError("Qdrant configurado está indisponível. Não houve fallback silencioso para outro índice.") from exc

    def collection(self, model, dimension, generation=""):
        name = collection_name(model, dimension, generation)
        if self.request("GET",f"/collections/{name}",missing=True) is None:
            self.request("PUT",f"/collections/{name}",{"vectors":{"size":dimension,"distance":"Cosine","on_disk":True},"hnsw_config":{"on_disk":True}})
            for field in ("tenant", "doc_id", "model"):
                self.request("PUT",f"/collections/{name}/index?wait=true",{"field_name":field,"field_schema":"keyword"})
        return name

    def upsert(self, tenant, rows, vectors, model, generation=""):
        if not vectors:
            return None
        name = self.collection(model,len(vectors[0]),generation)
        for start in range(0,len(rows),32):
            points=[]
            for row,vector in zip(rows[start:start+32],vectors[start:start+32]):
                points.append({"id":str(uuid.uuid5(uuid.NAMESPACE_URL,tenant+":"+row["id"])),"vector":vector,"payload":{"tenant":tenant,"doc_id":row["doc_id"],"section_id":row["id"],"model":model}})
            self.request("PUT",f"/collections/{name}/points?wait=true",{"points":points})
        return name

    def delete_document(self, tenant, doc_id, collection):
        if not isinstance(collection, str) or not re.fullmatch(r"atlas_[a-zA-Z0-9_]+", collection):
            raise ProviderError("Referência de coleção Qdrant inválida.")
        self.request("POST", f"/collections/{collection}/points/delete?wait=true", {"filter": {"must": [
            {"key": "tenant", "match": {"value": tenant}}, {"key": "doc_id", "match": {"value": doc_id}}]}}, missing=True)

    def search(self, tenant, rows, vector, model):
        allowed = {row["id"]:row for row in rows}
        collections = {json.loads(row["vector"]).get("collection") for row in rows}
        if None in collections:
            raise ProviderError("Fontes sem índice Qdrant; execute a reindexação antes de consultar.")
        doc_ids = sorted({row["doc_id"] for row in rows})
        scores={}
        for name in collections:
            # Names come from stored server metadata, not the user or a model.
            if not isinstance(name,str) or not name.startswith("atlas_") or not all(c.isalnum() or c=="_" for c in name):
                raise ProviderError("Referência de coleção Qdrant inválida.")
            result=self.request("POST",f"/collections/{name}/points/query",{"query":vector,"limit":32,"with_payload":True,"filter":{"must":[{"key":"tenant","match":{"value":tenant}},{"key":"doc_id","match":{"any":doc_ids}},{"key":"model","match":{"value":model}}]}})
            for point in result["points"]:
                payload=point["payload"];section=payload.get("section_id")
                if payload.get("tenant")!=tenant or payload.get("model")!=model or section not in allowed or payload.get("doc_id")!=allowed[section]["doc_id"]:
                    raise ProviderError("Qdrant retornou referência fora do escopo autorizado.")
                scores[section]=max(scores.get(section,-1),point["score"])
        return sorted(scores.items(),key=lambda pair:pair[1],reverse=True)
