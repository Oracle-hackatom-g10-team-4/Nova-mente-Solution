import json
import os
import sys
import tempfile
import unittest
import subprocess
import httpx
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch, MagicMock
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from atlas.store import Store
from atlas.rag import ingest
from atlas.learning import generate, attempt
from atlas.models import Generation, Attempt
from atlas.dreamer import Dreamer
from atlas.documents import service, cleanup, memory
from atlas.trails import service as trails
from atlas.trails.http import TrailInput
from atlas.providers import ProviderError, ProviderBusy


class DocumentLifecycle(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'ATLAS_AGENT_RUNTIME': 'extractive'}, clear=True)
        self.env.start()
        self.store = Store(self.temp.name)
        self.dreamer = Dreamer(self.store)
        self.a = ingest(self.store, 'alice', 'A.md', b'# Rede privada\n\nUma rede privada usa sub-redes e regras de acesso controladas.')
        self.b = ingest(self.store, 'alice', 'B.md', b'# Revisao\n\nUma revisao frequente permite recordar os conceitos estudados.')
        self.other = ingest(self.store, 'bob', 'A.md', b'# Rede privada\n\nUma rede privada usa sub-redes e regras de acesso controladas.')

    def tearDown(self):
        self.env.stop()
        self.temp.cleanup()

    def material(self, documents, format='tutorial'):
        return generate(self.store, 'alice', Generation(document_ids=documents, goal='Entender os conceitos do documento', format=format))

    def test_delete_cascades_only_dependent_materials_and_refreshes_xp(self):
        self.dreamer.consent('alice', True)
        a = self.material([self.a['id']], 'quiz')
        b = self.material([self.b['id']])
        mixed = self.material([self.a['id'], self.b['id']])
        trail = trails.create(self.store, 'alice', TrailInput(document_ids=[self.a['id']], goal='Aprender redes privadas'))
        other_trail = trails.create(self.store, 'alice', TrailInput(document_ids=[self.b['id']], goal='Aprender revisao frequente'))
        with self.store.db() as db:
            row = self.store.package('alice', a['id'])
            item, answer = next(iter(json.loads(row['answers']).items()))
            db.execute('INSERT INTO conversations VALUES(?,?,?,?,?,?)', ('alice', 'turn_old', 'nilo', 'assistant', 'private context', 'today'))
        attempt(self.store, 'alice', a['id'], Attempt(item_id=item, option_id=answer['correct'], event_id='event1'))
        preview = service.preview(self.store, 'alice', self.a['id'])
        self.assertEqual(preview['impact'], {'packages': 2, 'trails': 1, 'xp': 15, 'conversations': 1, 'reset_learning_memory': True})
        result = service.remove(self.store, self.dreamer, 'alice', self.a['id'])
        self.assertEqual(result['status'], 'deleted')
        self.assertEqual([doc['id'] for doc in self.store.documents('alice')], [self.b['id']])
        self.assertEqual(self.store.progress('alice')['xp'], 0)
        self.assertEqual([t['id'] for t in trails.list_trails(self.store, 'alice')], [other_trail['id']])
        for package in [a, mixed]:
            with self.assertRaises(LookupError): self.store.package('alice', package['id'])
            self.assertFalse((self.store.root / 'objects' / package['storage']['object_key']).exists())
        self.assertEqual(self.store.package('alice', b['id'])['id'], b['id'])
        self.assertEqual(self.store.source('bob', self.other['id'])['id'], self.other['id'])
        self.assertTrue(self.dreamer.status('alice')['consent'])
        self.assertEqual(self.dreamer.status('alice')['events'], 0)
        with self.store.db() as db:
            for table in ['passages', 'passages_fts']:
                self.assertEqual(db.execute(f'SELECT COUNT(*) FROM {table} WHERE tenant=? AND doc_id=?', ('alice', self.a['id'])).fetchone()[0], 0)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM conversations WHERE tenant=?', ('alice',)).fetchone()[0], 0)
            self.assertEqual(db.execute('SELECT payload FROM document_removals WHERE tenant=? AND id=?', ('alice', self.a['id'])).fetchone()[0], '{}')
        self.assertFalse((self.store.root / 'objects' / self.a['storage']['object_key']).exists())

    def test_retry_survives_restart_and_upload_is_reprocessed_with_new_id(self):
        original = service.remove(self.store, self.dreamer, 'alice', self.a['id'])
        revision = self.dreamer.status('alice')['revision']
        reopened = Store(self.temp.name)
        self.assertEqual(service.remove(reopened, Dreamer(reopened), 'alice', self.a['id']), original)
        self.assertEqual(self.dreamer.status('alice')['revision'], revision)
        new = ingest(reopened, 'alice', 'A.md', b'# Rede privada\n\nUma rede privada usa sub-redes e regras de acesso controladas.')
        self.assertNotEqual(new['id'], self.a['id'])
        self.assertEqual(new['hash'], self.a['hash'])
        self.assertTrue((reopened.root / 'objects' / new['storage']['object_key']).exists())

    def test_external_failure_hides_source_but_never_claims_completed_cleanup(self):
        with patch.object(cleanup, 'finish', side_effect=OSError('private upstream body')):
            result = service.remove(self.store, self.dreamer, 'alice', self.a['id'])
        self.assertEqual(result['status'], 'cleanup_pending')
        self.assertNotIn('private upstream', json.dumps(result))
        with self.assertRaises(LookupError): self.store.source('alice', self.a['id'])
        with self.assertRaises(ProviderError): self.material([self.b['id']])
        reopened = Store(self.temp.name)
        self.assertEqual(service.retry(reopened, 'alice', self.a['id'])['status'], 'deleted')
        self.assertEqual(self.material([self.b['id']])['status'], 'ready')

    def test_tenant_and_transaction_failure_preserve_other_data(self):
        with self.assertRaises(LookupError): service.remove(self.store, self.dreamer, 'alice', self.other['id'])
        with patch.object(memory, 'clear', side_effect=RuntimeError('failure during transaction')):
            with self.assertRaises(RuntimeError): service.remove(self.store, self.dreamer, 'alice', self.a['id'])
        self.assertEqual(self.store.source('alice', self.a['id'])['id'], self.a['id'])
        self.assertEqual(service.pending(self.store, 'alice'), [])

    def test_external_memory_reset_is_idempotent_and_keeps_consent(self):
        self.dreamer.consent('alice', True)
        first = memory.reset_sources(self.store, self.dreamer, 'alice', self.a['id'])
        revision = self.dreamer.status('alice')['revision']
        self.assertEqual(memory.reset_sources(self.store, self.dreamer, 'alice', self.a['id']), first)
        self.assertEqual(self.dreamer.status('alice')['revision'], revision)
        self.assertTrue(self.dreamer.status('alice')['consent'])

    def test_cleanup_rejects_objects_outside_tenant_or_allowed_paths(self):
        for key in ['wrong/documents/doc_'+'a'*20+'/original.md', cleanup.tenant_key('alice')+'/../../secrets']:
            with self.assertRaises(ValueError): cleanup.object_path('alice', {'provider': 'local', 'object_key': key})

    def test_bounded_cleanup_resumes_after_reopening_without_repeating_logical_erasure(self):
        for _ in range(4): self.material([self.a['id']])
        first = service.remove(self.store, self.dreamer, 'alice', self.a['id'])
        self.assertEqual(first['status'], 'cleanup_pending')
        revision = self.dreamer.status('alice')['revision']
        reopened = Store(self.temp.name)
        self.assertEqual(service.retry(reopened, 'alice', self.a['id'])['status'], 'deleted')
        self.assertEqual(self.dreamer.status('alice')['revision'], revision)

    def test_oci_cleanup_requires_verified_absence_and_is_safe_to_repeat(self):
        import oci
        client = MagicMock()
        missing = oci.exceptions.ServiceError(404, 'ObjectNotFound', {}, 'gone')
        client.head_object.side_effect = missing
        receipt = {'provider': 'oci', 'object_key': 'tenants/' + self.a['storage']['object_key'], 'namespace': 'test-space', 'bucket': 'test-bucket'}
        with patch.object(cleanup, 'oci_client', return_value=client):
            cleanup.delete_objects(self.store, 'alice', {'objects': [receipt], 'namespace': 'test-space', 'bucket': 'test-bucket'})
            client.delete_object.side_effect = missing
            cleanup.delete_objects(self.store, 'alice', {'objects': [receipt], 'namespace': 'test-space', 'bucket': 'test-bucket'})
        self.assertEqual(client.head_object.call_count, 2)
        self.assertEqual(client.delete_object.call_args.args, ('test-space', 'test-bucket', receipt['object_key']))
        client.head_object.side_effect = None
        client.delete_object.side_effect = None
        with patch.object(cleanup, 'oci_client', return_value=client):
            with self.assertRaises(RuntimeError): cleanup.delete_oci(receipt, {'namespace': 'test-space', 'bucket': 'test-bucket'})

    def test_qdrant_and_mongo_delete_use_tenant_and_document_filters(self):
        from atlas.vector_index import QdrantIndex
        from atlas.projections import MongoProjection
        seen = []
        def handler(request):
            seen.append((request.url.path, json.loads(request.content)))
            return httpx.Response(200, json={'result': {'status': 'completed'}})
        with patch.dict(os.environ, {'QDRANT_URL': 'https://qdrant.example'}):
            index = QdrantIndex(transport=httpx.MockTransport(handler))
            index.delete_document('alice', self.a['id'], 'atlas_test')
            index.close()
        self.assertEqual(seen, [('/collections/atlas_test/points/delete', {'filter': {'must': [
            {'key': 'tenant', 'match': {'value': 'alice'}}, {'key': 'doc_id', 'match': {'value': self.a['id']}}]}})])
        collection = MagicMock()
        projection = MongoProjection(client={'atlas': {'document_metadata': collection}})
        projection.delete('alice', self.a['id'])
        collection.delete_one.assert_called_once_with({'tenant': 'alice', 'id': self.a['id']})

    def test_external_memory_cleanup_has_a_stable_operation_and_requires_acknowledgement(self):
        url = 'https://memory.example/v1/dreamer/reset-sources'
        response = httpx.Response(200, json={'reset': True}, request=httpx.Request('POST', url))
        with patch.dict(os.environ, {'MEMORY_SERVICE_URL': 'https://memory.example', 'MEMORY_SERVICE_TOKEN': 'test-only-memory-token'}):
            with patch.object(httpx, 'post', return_value=response) as post:
                self.assertEqual(service.remove(self.store, self.dreamer, 'alice', self.a['id'])['status'], 'cleanup_pending')
                self.assertEqual(post.call_count, 0)
                self.assertEqual(service.retry(self.store, 'alice', self.a['id'])['status'], 'deleted')
                self.assertEqual(post.call_args.kwargs['json'], {'operation_id': self.a['id']})
                self.assertEqual(post.call_args.kwargs['headers']['x-atlas-tenant'], 'alice')
            bad = httpx.Response(200, json={'reset': False}, request=httpx.Request('POST', url))
            with patch.object(httpx, 'post', return_value=bad):
                with self.assertRaises(ProviderError): memory.remote('alice', self.a['id'])

    def test_deleted_demo_does_not_reappear_after_service_restart(self):
        code = """
from fastapi.testclient import TestClient
from atlas.main import app
headers={'Authorization':'Bearer test-internal-lifecycle-token-123456','x-atlas-tenant':'alice'}
with TestClient(app) as client:
    docs=client.get('/v1/documents',headers=headers).json()
    assert len(docs)==1
    response=client.delete('/v1/documents/'+docs[0]['id'],headers=headers)
    assert response.status_code==200,response.text
    assert client.get('/v1/documents',headers=headers).json()==[]
with TestClient(app) as client:
    assert client.get('/v1/documents',headers=headers).json()==[]
print('restart-erasure-ok')
"""
        with tempfile.TemporaryDirectory() as data:
            env = dict(os.environ, ATLAS_DATA_DIR=data, ATLAS_TENANT_ID='alice', ATLAS_INTERNAL_TOKEN='test-internal-lifecycle-token-123456', ATLAS_SEED_DEMO='1', PYTHONPATH=str(Path(__file__).resolve().parents[1]))
            result = subprocess.run([sys.executable, '-c', code], env=env, capture_output=True, text=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('restart-erasure-ok', result.stdout)

    def test_inflight_generation_cannot_write_after_successful_removal(self):
        from atlas import learning
        entered, release = threading.Event(), threading.Event()
        original = learning.learning_metadata
        def paused(*args):
            entered.set(); self.assertTrue(release.wait(5)); return original(*args)
        with ThreadPoolExecutor(max_workers=1) as pool, patch.object(learning, 'learning_metadata', paused):
            future = pool.submit(self.material, [self.a['id']])
            try:
                self.assertTrue(entered.wait(5))
                with self.assertRaises(ProviderBusy): service.remove(self.store, self.dreamer, 'alice', self.a['id'])
                self.assertEqual(self.store.source('alice', self.a['id'])['id'], self.a['id'])
            finally: release.set()
            package = future.result(timeout=5)
        self.assertEqual(service.remove(self.store, self.dreamer, 'alice', self.a['id'])['status'], 'deleted')
        with self.assertRaises(LookupError): self.store.package('alice', package['id'])
        self.assertFalse((self.store.root / 'objects' / package['storage']['object_key']).exists())

    def test_inflight_trail_creation_cannot_leave_orphaned_references(self):
        entered, release = threading.Event(), threading.Event()
        original = trails.steps
        def paused(*args):
            entered.set(); self.assertTrue(release.wait(5)); return original(*args)
        request = TrailInput(document_ids=[self.a['id']], goal='Aprender redes privadas')
        with ThreadPoolExecutor(max_workers=1) as pool, patch.object(trails, 'steps', paused):
            future = pool.submit(trails.create, self.store, 'alice', request)
            try:
                self.assertTrue(entered.wait(5))
                with self.assertRaises(ProviderBusy): service.remove(self.store, self.dreamer, 'alice', self.a['id'])
            finally: release.set()
            trail = future.result(timeout=5)
        self.assertEqual(service.remove(self.store, self.dreamer, 'alice', self.a['id'])['status'], 'deleted')
        with self.assertRaises(LookupError): trails.get(self.store, 'alice', trail['id'])

    def test_delayed_dreamer_record_cannot_restore_erased_history(self):
        self.dreamer.consent('alice', True)
        entered, release = threading.Event(), threading.Event()
        original = self.dreamer.record
        def paused(*args, **kwargs):
            entered.set(); self.assertTrue(release.wait(5)); return original(*args, **kwargs)
        with ThreadPoolExecutor(max_workers=1) as pool, patch.object(self.dreamer, 'record', paused):
            future = pool.submit(self.dreamer.cycle, 'alice')
            try:
                self.assertTrue(entered.wait(5))
                self.assertEqual(service.remove(self.store, self.dreamer, 'alice', self.a['id'])['status'], 'deleted')
            finally: release.set()
            self.assertEqual(future.result(timeout=5)['status'], 'cancelled')
        self.assertEqual(self.dreamer.status('alice')['cycles'], [])

    def test_failed_old_jobs_do_not_starve_a_new_removal(self):
        docs = [self.a, self.b] + [ingest(self.store, 'alice', f'Extra{i}.md', f'# Fonte{i}\n\nUm assunto novo para estudar.'.encode()) for i in range(2)]
        for doc in docs: service.begin(self.store, self.dreamer, 'alice', doc['id'])
        with patch.object(cleanup, 'finish', side_effect=OSError('upstream unavailable')):
            for job in service.due(self.store): service.retry(self.store, job['tenant'], job['id'])
        ready = service.due(self.store)
        self.assertEqual([job['id'] for job in ready], [docs[3]['id']])
        self.assertEqual(service.retry(self.store, 'alice', docs[3]['id'])['status'], 'deleted')
        self.assertEqual(len(service.pending(self.store, 'alice')), 3)

    def test_changed_oci_configuration_never_deletes_a_different_original_bucket(self):
        import oci
        client = MagicMock()
        client.head_object.side_effect = oci.exceptions.ServiceError(404, 'ObjectNotFound', {}, 'gone')
        receipt = {'provider': 'oci', 'object_key': 'tenants/' + self.a['storage']['object_key'], 'namespace': 'original-space', 'bucket': 'original-bucket'}
        with patch.dict(os.environ, {'OCI_NAMESPACE': 'new-space', 'OCI_BUCKET': 'new-bucket'}), patch.object(cleanup, 'oci_client', return_value=client):
            cleanup.delete_oci(receipt, {})
        self.assertEqual(client.delete_object.call_args.args[:2], ('original-space', 'original-bucket'))
        with patch.object(cleanup, 'oci_client') as factory:
            with self.assertRaises(ValueError): cleanup.delete_oci({'provider': 'oci', 'object_key': receipt['object_key']}, {})
            factory.assert_not_called()

    def test_legacy_without_current_config_requires_operator_reconciliation_and_real_cleanup(self):
        from atlas.documents.reconcile import reconcile
        with self.store.db() as db:
            db.execute("UPDATE documents SET integrations='{}' WHERE tenant=? AND id=?", ('alice', self.a['id']))
        result = service.remove(self.store, self.dreamer, 'alice', self.a['id'])
        self.assertEqual(result['status'], 'cleanup_pending')
        self.assertTrue(result['attention_required'])
        manifest = {'tenant': 'alice', 'document_id': self.a['id'], 'reviewed_all_historical_destinations': True}
        with self.assertRaises(ValueError): reconcile(self.store, 'bob', self.a['id'], manifest)
        reconcile(self.store, 'alice', self.a['id'], manifest)
        self.assertEqual(service.status(self.store, 'alice', self.a['id'])['status'], 'cleanup_pending')
        self.assertEqual(service.retry(self.store, 'alice', self.a['id'])['status'], 'deleted')
        self.assertFalse((self.store.root / 'objects' / self.a['storage']['object_key']).exists())

    def test_changed_index_destination_and_missing_receipt_identity_need_attention(self):
        from atlas import vector_index
        payload = {'document_id': self.a['id'], 'objects': [], 'collections': [{'name': 'atlas_test', 'origin': 'a'*64}], 'mongo': False}
        with patch.dict(os.environ, {'QDRANT_URL': 'https://other.example'}):
            self.assertTrue(cleanup.attention(payload))
            with patch.object(vector_index.QdrantIndex, 'delete_document') as delete:
                with self.assertRaises(ValueError): cleanup.delete_indexes('alice', payload)
                delete.assert_not_called()
        self.assertTrue(cleanup.attention({'objects': [{'provider': 'oci'}]}))
        from atlas.documents.reconcile import preserve
        with self.assertRaises(ValueError): preserve('original', 'replacement')

    def test_reindex_remembers_prior_and_interrupted_destinations(self):
        from atlas.documents.provenance import remember_vectors
        with self.store.db() as db:
            db.execute("UPDATE passages SET vector=? WHERE tenant=? AND doc_id=?", (json.dumps({'collection': 'atlas_old', 'origin': 'a'*64}), 'alice', self.a['id']))
        with patch.dict(os.environ, {'QDRANT_URL': 'https://index.example'}):
            remember_vectors(self.store, 'alice', [{'doc_id': self.a['id']}], 'atlas_new')
        with self.store.db() as db:
            doc = db.execute('SELECT * FROM documents WHERE tenant=? AND id=?', ('alice', self.a['id'])).fetchone()
            from atlas.documents.policy import snapshot
            names = {item['name'] for item in snapshot(db, 'alice', doc)['collections']}
        self.assertEqual(names, {'atlas_old', 'atlas_new'})

    def test_memory_destination_is_recorded_before_send_and_survives_disabling_configuration(self):
        url = 'https://original-memory.example'
        with patch.dict(os.environ, {'MEMORY_SERVICE_URL': url, 'MEMORY_SERVICE_TOKEN': 'test-only-memory-token'}):
            state = httpx.Response(200, json={'consent': True, 'revision': 0}, request=httpx.Request('GET', url))
            with patch.object(httpx, 'get', return_value=state), patch.object(httpx, 'post', side_effect=httpx.ConnectError('unavailable')):
                with self.assertRaises(ProviderError): self.store.event('alice', 'generation', {'private': 'synthetic'})
        result = service.remove(self.store, self.dreamer, 'alice', self.a['id'])
        self.assertEqual(result['status'], 'cleanup_pending')
        self.assertTrue(result['attention_required'])
        with patch.dict(os.environ, {'MEMORY_SERVICE_URL': 'https://different-memory.example'}):
            with patch.object(httpx, 'post') as post:
                self.assertEqual(service.retry(self.store, 'alice', self.a['id'])['status'], 'cleanup_pending')
                post.assert_not_called()
        with patch.dict(os.environ, {'MEMORY_SERVICE_URL': url, 'MEMORY_SERVICE_TOKEN': 'test-only-memory-token'}):
            ack = httpx.Response(200, json={'reset': True}, request=httpx.Request('POST', url))
            with patch.object(httpx, 'post', return_value=ack):
                self.assertEqual(service.retry(self.store, 'alice', self.a['id'])['status'], 'deleted')
        with self.store.db() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM memory_destinations WHERE tenant=?', ('alice',)).fetchone()[0], 0)


if __name__ == '__main__': unittest.main()
