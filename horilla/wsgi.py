"""
WSGI config for horilla project.

Serves /health/ instantly while Django loads in a background thread,
so Railway health checks pass before the full app is ready.
"""

import os
import threading
import traceback

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "horilla.settings")

_django_app = None
_django_ready = threading.Event()
_django_error = None


def _load_django():
    global _django_app, _django_error
    try:
        from django.core.wsgi import get_wsgi_application

        _django_app = get_wsgi_application()
        print("Django application loaded successfully", flush=True)
    except Exception as exc:
        _django_error = exc
        traceback.print_exc()
    finally:
        _django_ready.set()


threading.Thread(target=_load_django, daemon=True).start()


def application(environ, start_response):
    path = environ.get("PATH_INFO", "")

    # Health check responds instantly, before Django is ready
    if path in ("/health", "/health/"):
        if _django_ready.is_set() and _django_error is not None:
            status = "500 Internal Server Error"
            body = b'{"status": "error", "detail": "django-bootstrap-failed"}'
        else:
            status = "200 OK"
            body = b'{"status": "ok"}'
        headers = [("Content-Type", "application/json")]
        start_response(status, headers)
        return [body]

    # All other requests wait for Django
    if not _django_ready.wait(timeout=120):
        status = "503 Service Unavailable"
        headers = [("Content-Type", "application/json"), ("Retry-After", "10")]
        start_response(status, headers)
        return [b'{"status": "starting"}']

    if _django_error is not None:
        status = "500 Internal Server Error"
        headers = [("Content-Type", "application/json")]
        start_response(status, headers)
        return [b'{"status": "error"}']

    return _django_app(environ, start_response)
