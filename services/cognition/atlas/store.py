import hashlib
import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from .progression import progress

def now():
    return datetime.now(timezone.utc).isoformat()

def uid(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:20]}"

class Store:
    def __init__(self, root=None):
        self.root = Path(root or os.getenv("ATLAS_DATA_DIR", "data"))
        self.root.mkdir(parents=True, exist_ok=True)
        with self.db() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS memory_destinations(tenant TEXT,origin TEXT,PRIMARY KEY(tenant,origin));
                CREATE TABLE IF NOT EXISTS memory_source_resets(tenant TEXT,id TEXT,PRIMARY KEY(tenant,id));
                CREATE TABLE IF NOT EXISTS document_removals(tenant TEXT,id TEXT,status TEXT,payload TEXT,impact TEXT,created_at TEXT,last_attempt REAL NOT NULL DEFAULT 0,next_attempt REAL NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(tenant,id));
                CREATE TABLE IF NOT EXISTS documents(tenant TEXT,id TEXT,title TEXT,filename TEXT,media_type TEXT,pages TEXT,hash TEXT,created_at TEXT,storage TEXT,PRIMARY KEY(tenant,id));
                CREATE TABLE IF NOT EXISTS passages(tenant TEXT,doc_id TEXT,id TEXT,page INTEGER,text TEXT,vector TEXT,PRIMARY KEY(tenant,id));
                CREATE VIRTUAL TABLE IF NOT EXISTS passages_fts USING fts5(tenant UNINDEXED,doc_id UNINDEXED,id UNINDEXED,text);
                CREATE TABLE IF NOT EXISTS packages(tenant TEXT,id TEXT,payload TEXT,answers TEXT,input TEXT,PRIMARY KEY(tenant,id));
                CREATE TABLE IF NOT EXISTS quiz_attempts(tenant TEXT,event_id TEXT,package_id TEXT,item_id TEXT,option_id TEXT,response TEXT,PRIMARY KEY(tenant,event_id));
                CREATE TABLE IF NOT EXISTS xp(tenant TEXT,key TEXT,amount INTEGER,created_at TEXT,PRIMARY KEY(tenant,key));
                CREATE TABLE IF NOT EXISTS trails(tenant TEXT,id TEXT,payload TEXT,created_at TEXT,PRIMARY KEY(tenant,id));
                CREATE INDEX IF NOT EXISTS trails_by_date ON trails(tenant,created_at);
                CREATE TABLE IF NOT EXISTS groups(tenant TEXT,id TEXT,name TEXT,topic TEXT,created_at TEXT,PRIMARY KEY(tenant,id));
                CREATE TABLE IF NOT EXISTS messages(tenant TEXT,id TEXT,group_id TEXT,text TEXT,created_at TEXT,PRIMARY KEY(tenant,id));
                CREATE TABLE IF NOT EXISTS consent(tenant TEXT PRIMARY KEY,enabled INTEGER);
                CREATE TABLE IF NOT EXISTS memory_events(tenant TEXT,id TEXT,kind TEXT,payload TEXT,created_at TEXT,PRIMARY KEY(tenant,id));
                CREATE TABLE IF NOT EXISTS policies(tenant TEXT,version INTEGER,instruction TEXT,status TEXT,created_at TEXT,PRIMARY KEY(tenant,version));
                CREATE TABLE IF NOT EXISTS cycles(tenant TEXT,id TEXT,status TEXT,reason TEXT,metrics TEXT,created_at TEXT,PRIMARY KEY(tenant,id));
                CREATE TABLE IF NOT EXISTS conversations(tenant TEXT,id TEXT,agent_id TEXT,role TEXT,text TEXT,created_at TEXT,PRIMARY KEY(tenant,id));
                CREATE TABLE IF NOT EXISTS replay_cases(tenant TEXT,id TEXT,payload TEXT,input TEXT,PRIMARY KEY(tenant,id));
                CREATE TABLE IF NOT EXISTS jobs(tenant TEXT,id TEXT,dedup TEXT,revision INTEGER,kind TEXT,status TEXT,attempts INTEGER,lease_until REAL,created_at TEXT,result TEXT,PRIMARY KEY(tenant,id),UNIQUE(tenant,dedup));
                CREATE INDEX IF NOT EXISTS jobs_pending ON jobs(status,lease_until,created_at);
                CREATE TABLE IF NOT EXISTS agent_runs(tenant TEXT,id TEXT,payload TEXT,created_at TEXT,PRIMARY KEY(tenant,id));
                CREATE TABLE IF NOT EXISTS dream_worlds(tenant TEXT,id TEXT,payload TEXT,created_at TEXT,PRIMARY KEY(tenant,id));
                CREATE TABLE IF NOT EXISTS memory_revisions(tenant TEXT PRIMARY KEY,version INTEGER);
            """)
            columns = {row["name"] for row in db.execute("PRAGMA table_info(documents)")}
            for field in ("page_count", "characters"):
                if field not in columns:
                    db.execute(f"ALTER TABLE documents ADD COLUMN {field} INTEGER NOT NULL DEFAULT 0")
            if 'integrations' not in columns:
                db.execute("ALTER TABLE documents ADD COLUMN integrations TEXT NOT NULL DEFAULT '{}'")
            removal_columns = {row["name"] for row in db.execute("PRAGMA table_info(document_removals)")}
            for field, kind in (("last_attempt", "REAL"), ("next_attempt", "REAL"), ("attempts", "INTEGER")):
                if field not in removal_columns:
                    db.execute(f"ALTER TABLE document_removals ADD COLUMN {field} {kind} NOT NULL DEFAULT 0")
            db.execute("UPDATE documents SET page_count=json_array_length(pages),characters=(SELECT COALESCE(SUM(length(json_extract(value,'$.text'))),0) FROM json_each(documents.pages)) WHERE page_count=0")
            db.execute("CREATE INDEX IF NOT EXISTS documents_by_date ON documents(tenant,created_at)")
            db.execute("CREATE INDEX IF NOT EXISTS passages_by_document ON passages(tenant,doc_id)")

    @contextmanager
    def db(self):
        db = sqlite3.connect(self.root / "atlas.sqlite3", timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA secure_delete=ON")
        try:
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def documents(self, tenant):
        with self.db() as db:
            rows = db.execute("SELECT id,title,filename,media_type,hash,created_at,storage,page_count,characters FROM documents WHERE tenant=? ORDER BY created_at DESC", (tenant,)).fetchall()
        return [self.document_meta(row) for row in rows]

    def document_meta(self, row):
        pages = json.loads(row["pages"]) if "pages" in row.keys() else None
        page_count = len(pages) if pages is not None else row["page_count"]
        characters = sum(len(p["text"]) for p in pages) if pages is not None else row["characters"]
        return {k: row[k] for k in ("id", "title", "filename", "media_type", "hash", "created_at")} | {"pages": page_count, "characters": characters, "version": 1, "status": "ready", "storage": json.loads(row["storage"])}

    def source(self, tenant, doc_id):
        with self.db() as db:
            row = db.execute("SELECT * FROM documents WHERE tenant=? AND id=?", (tenant, doc_id)).fetchone()
        if not row:
            raise LookupError("Fonte não encontrada neste workspace.")
        return {"id": row["id"], "title": row["title"], "pages": json.loads(row["pages"])}

    def package(self, tenant, package_id):
        with self.db() as db:
            row = db.execute("SELECT * FROM packages WHERE tenant=? AND id=?", (tenant, package_id)).fetchone()
        if not row:
            raise LookupError("Material não encontrado.")
        return row

    def progress(self, tenant):
        with self.db() as db:
            row = db.execute("SELECT COALESCE(SUM(amount),0) xp,COUNT(*) completed FROM xp WHERE tenant=?", (tenant,)).fetchone()
        return progress(row["xp"], row["completed"])

    def memory_state(self, tenant):
        if os.getenv("MEMORY_SERVICE_URL"):
            import httpx
            from .providers import safe_base
            response = httpx.get(safe_base(os.environ["MEMORY_SERVICE_URL"]) + "/v1/dreamer/status", headers={"Authorization": "Bearer " + os.environ["MEMORY_SERVICE_TOKEN"], "x-atlas-tenant": tenant}, timeout=10)
            response.raise_for_status()
            state = response.json()
            return {"enabled": state["consent"], "revision": state["revision"]}
        with self.db() as db:
            row = db.execute("SELECT COALESCE((SELECT enabled FROM consent WHERE tenant=?),0),COALESCE((SELECT version FROM memory_revisions WHERE tenant=?),0)", (tenant, tenant)).fetchone()
        return {"enabled": bool(row[0]), "revision": row[1]}

    def event(self, tenant, kind, payload, expected_revision=None):
        if os.getenv("MEMORY_SERVICE_URL"):
            from .documents.memory import publish
            return publish(self, tenant, kind, payload, expected_revision)
        with self.db() as db:
            db.execute("BEGIN IMMEDIATE")
            consent = db.execute("SELECT enabled FROM consent WHERE tenant=?", (tenant,)).fetchone()
            revision = db.execute("SELECT COALESCE((SELECT version FROM memory_revisions WHERE tenant=?),0)", (tenant,)).fetchone()[0]
            if consent and consent[0] and (expected_revision is None or expected_revision == revision):
                event_payload = {key: value for key, value in payload.items() if key not in ("replay", "dream_world", "execution")}
                db.execute("INSERT INTO memory_events VALUES(?,?,?,?,?)", (tenant, uid("ev"), kind, json.dumps(event_payload, ensure_ascii=False), now()))
                if kind == "generation" and payload.get("replay"):
                    replay = payload["replay"]
                    db.execute("INSERT OR IGNORE INTO replay_cases VALUES(?,?,?,?)", (tenant, replay["package"]["id"], json.dumps(replay["package"], ensure_ascii=False), json.dumps(replay["input"], ensure_ascii=False)))
                    self.record_execution(db, tenant, replay, payload)
                    self.record_world(db, tenant, replay, payload.get("dream_world"))
                    db.execute("DELETE FROM replay_cases WHERE tenant=? AND id NOT IN (SELECT id FROM replay_cases WHERE tenant=? ORDER BY rowid DESC LIMIT 30)", (tenant, tenant))
                db.execute("DELETE FROM memory_events WHERE tenant=? AND id NOT IN (SELECT id FROM memory_events WHERE tenant=? ORDER BY created_at DESC LIMIT 1000)", (tenant, tenant))
                return True
            return False

    def record_execution(self, db, tenant, replay, payload):
        if payload.get("execution"):
            db.execute("INSERT OR IGNORE INTO agent_runs VALUES(?,?,?,?)", (tenant,replay["package"]["id"],json.dumps(payload["execution"]),now()))
            db.execute("DELETE FROM agent_runs WHERE tenant=? AND id NOT IN (SELECT id FROM agent_runs WHERE tenant=? ORDER BY rowid DESC LIMIT 100)", (tenant,tenant))

    def record_world(self, db, tenant, replay, world):
        if replay["package"]["status"] == "ready" and world and len(world.get("nodes", [])) >= 2 and all(n.get("verdict") == "supported" for n in world["nodes"]):
            db.execute("INSERT OR IGNORE INTO dream_worlds VALUES(?,?,?,?)", (tenant, replay["package"]["id"], json.dumps(world), now()))
            db.execute("DELETE FROM dream_worlds WHERE tenant=? AND id NOT IN (SELECT id FROM dream_worlds WHERE tenant=? ORDER BY rowid DESC LIMIT 30)", (tenant, tenant))

    def groups(self, tenant):
        with self.db() as db:
            rows = db.execute("SELECT id,name,topic,created_at FROM groups WHERE tenant=? ORDER BY created_at DESC", (tenant,)).fetchall()
        return [dict(row) | {"member_count": 1} for row in rows]

    def group_exists(self, tenant, group_id):
        with self.db() as db:
            exists = db.execute("SELECT 1 FROM groups WHERE tenant=? AND id=?", (tenant, group_id)).fetchone()
        if not exists:
            raise LookupError("Grupo não encontrado neste workspace.")

    def blob(self, tenant, key, content):
        tenant_key = hashlib.sha256(tenant.encode()).hexdigest()[:24]
        path = self.root / "objects" / tenant_key / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        if os.getenv("STORAGE_PROVIDER", "local") != "oci":
            return {"provider": "local", "object_key": f"{tenant_key}/{key}", "status": "stored"}
        import oci
        if os.getenv("OCI_AUTH_MODE", "instance_principal") == "instance_principal":
            client = oci.object_storage.ObjectStorageClient({}, signer=oci.auth.signers.InstancePrincipalsSecurityTokenSigner())
        else:
            client = oci.object_storage.ObjectStorageClient(oci.config.from_file(os.getenv("OCI_CONFIG_FILE") or oci.config.DEFAULT_LOCATION, os.getenv("OCI_CONFIG_PROFILE") or "DEFAULT"))
        namespace, bucket = os.environ["OCI_NAMESPACE"], os.environ["OCI_BUCKET"]
        object_key = f"tenants/{tenant_key}/{key}"
        client.put_object(namespace, bucket, object_key, content, retry_strategy=oci.retry.NoneRetryStrategy())
        received = client.get_object(namespace, bucket, object_key).data.content
        if hashlib.sha256(received).digest() != hashlib.sha256(content).digest():
            raise RuntimeError("Falha na conferência do objeto OCI.")
        return {"provider": "oci", "object_key": object_key, "status": "verified", "namespace": namespace, "bucket": bucket}
