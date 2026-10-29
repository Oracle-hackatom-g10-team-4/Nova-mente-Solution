"""Idempotent physical cleanup. Exceptions leave the durable job pending."""
import hashlib
import os
import re
from pathlib import Path
from .. import vector_index
from ..projections import MongoProjection
from . import memory


def tenant_key(tenant):
    return hashlib.sha256(tenant.encode()).hexdigest()[:24]


def object_path(tenant, receipt):
    prefix = ('tenants/' if receipt['provider'] == 'oci' else '') + tenant_key(tenant) + '/'
    key = receipt['object_key']
    if not key.startswith(prefix):
        raise ValueError('Objeto fora do workspace.')
    relative = key[len(prefix):]
    if not re.fullmatch(r'(documents/doc_[a-f0-9]{20}/original(?:\.(pdf|md|markdown|txt))?|packages/pkg_[a-f0-9]{20}\.json)', relative):
        raise ValueError('Referência de objeto inválida.')
    return relative


def oci_client():
    import oci
    if os.getenv('OCI_AUTH_MODE', 'instance_principal') == 'instance_principal':
        return oci.object_storage.ObjectStorageClient({}, signer=oci.auth.signers.InstancePrincipalsSecurityTokenSigner(), timeout=(3, 10))
    return oci.object_storage.ObjectStorageClient(oci.config.from_file(os.getenv('OCI_CONFIG_FILE') or oci.config.DEFAULT_LOCATION, os.getenv('OCI_CONFIG_PROFILE') or 'DEFAULT'), timeout=(3, 10))


def delete_oci(receipt, payload):
    import oci
    namespace, bucket = receipt.get('namespace'), receipt.get('bucket')
    if not namespace or not bucket:
        raise ValueError('Destino original OCI desconhecido; limpeza requer reconciliação do operador.')
    client = oci_client()
    try:
        client.delete_object(namespace, bucket, receipt['object_key'], retry_strategy=oci.retry.NoneRetryStrategy())
    except oci.exceptions.ServiceError as error:
        if error.status != 404:
            raise
    try:
        client.head_object(namespace, bucket, receipt['object_key'])
    except oci.exceptions.ServiceError as error:
        if error.status == 404:
            return
        raise
    raise RuntimeError('O armazenamento ainda não confirmou a remoção.')


def delete_objects(store, tenant, payload):
    for receipt in payload['objects']:
        relative = object_path(tenant, receipt)
        if receipt['provider'] == 'oci':
            delete_oci(receipt, payload)
        path = store.root / 'objects' / tenant_key(tenant) / relative
        path.unlink(missing_ok=True)


def finish(store, tenant, payload):
    if payload.get('legacy_projection_unknown'):
        raise ValueError('Proveniência legada desconhecida; o operador deve reconciliar os destinos históricos.')
    if payload.get('remote_memory'):
        memory.clean_remote(store, tenant, payload)
        if payload['remote_memory']:
            return payload
    batch = payload['objects'][:3]
    delete_objects(store, tenant, payload | {'objects': batch})
    payload['objects'] = payload['objects'][len(batch):]
    if payload['objects']:
        return payload
    delete_indexes(tenant, payload)
    return payload if payload['collections'] or payload.get('mongo') else {}


def delete_indexes(tenant, payload):
    delete_current_vectors(tenant, payload)
    if payload.get('mongo'):
        from ..projections import origin
        if payload.get('mongo_origin') and payload['mongo_origin'] == origin():
            projection = MongoProjection()
            try:
                projection.delete(tenant, payload['document_id'])
                payload['mongo'] = False
            finally:
                projection.close()


def delete_current_vectors(tenant, payload):
    matching = [item for item in payload['collections'] if item.get('origin') == vector_index.origin()]
    if not matching:
        return
    index = vector_index.QdrantIndex()
    try:
        for collection in matching:
            index.delete_document(tenant, payload['document_id'], collection['name'])
        payload['collections'] = [item for item in payload['collections'] if item not in matching]
    finally:
        index.close()


def missing_object_identity(payload):
    return any(item['provider'] == 'oci' and not (item.get('namespace') and item.get('bucket')) for item in payload.get('objects', []))


def mismatched_indexes(payload):
    if any(not item.get('origin') or item['origin'] != vector_index.origin() for item in payload.get('collections', [])):
        return True
    from ..projections import origin
    return bool(payload.get('mongo') and payload.get('mongo_origin') != origin())


def attention(payload):
    return bool(payload.get('legacy_projection_unknown') or missing_object_identity(payload) or mismatched_indexes(payload) or memory.mismatched(payload))
