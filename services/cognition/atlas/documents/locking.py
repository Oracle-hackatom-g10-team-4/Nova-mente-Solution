"""Reentrant library guard across threads/processes sharing the canonical volume."""
import fcntl
import hashlib
import threading
from contextlib import contextmanager
from functools import wraps
from ..providers import ProviderBusy

held = threading.local()


@contextmanager
def library_lock(store, tenant):
    directory = store.root / '.library-locks'
    directory.mkdir(mode=0o700, exist_ok=True)
    path = directory / hashlib.sha256(tenant.encode()).hexdigest()
    key = str(path.resolve())
    active = getattr(held, 'paths', set())
    if key in active:
        yield
        return
    with path.open('a') as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise ProviderBusy('Outra operação da biblioteca está em andamento. Aguarde e tente novamente.') from exc
        held.paths = active | {key}
        try:
            yield
        finally:
            held.paths = active
            fcntl.flock(handle, fcntl.LOCK_UN)


def synchronized(function):
    @wraps(function)
    def run(store, tenant, *args, **kwargs):
        with library_lock(store, tenant):
            return function(store, tenant, *args, **kwargs)
    return run
