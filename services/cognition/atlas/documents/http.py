import re
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from ..models import StrictModel
from pydantic import Field
from . import service, memory


def document_id(value):
    if not re.fullmatch(r'doc_[a-f0-9]{20}', value):
        raise ValueError('Identificador de fonte inválido.')
    return value


class SourceReset(StrictModel):
    operation_id: str = Field(pattern=r'^doc_[a-f0-9]{20}$')


def router(store, dreamer, identity, limited):
    api = APIRouter(prefix='/v1')

    @api.get('/documents/{doc_id}/deletion')
    def preview(doc_id: str, tenant=Depends(identity)):
        return service.preview(store, tenant, document_id(doc_id))

    @api.get('/documents/{doc_id}/removal')
    def status(doc_id: str, tenant=Depends(identity)):
        return service.status(store, tenant, document_id(doc_id))

    @api.delete('/documents/{doc_id}')
    async def remove(doc_id: str, tenant=Depends(identity)):
        value = await limited(service.remove, store, dreamer, tenant, document_id(doc_id))
        return JSONResponse(value, status_code=200 if value['status'] == 'deleted' else 202)

    @api.post('/dreamer/reset-sources')
    def reset(request: SourceReset, tenant=Depends(identity)):
        return memory.reset_sources(store, dreamer, tenant, request.operation_id)

    return api
