"""
WSGI config for horilla project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.1/howto/deployment/wsgi/
"""

import os
import threading
import traceback

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "horilla.settings")

# Load Django in a background thread so the health check responds immediately
_django_app = None
_django_ready = threading.Event()
_django_error = None


def _load_django():
    global _django_app, _django_error
    try:
        from django.core.wsgi import get_wsgi_application

        _django_app = get_wsgi_application()
    except Exception as exc:
        _django_error = exc
        traceback.print_exc()
    finally:
        _django_ready.set()


threading.Thread(target=_load_django, daemon=True).start()


def application(environ, start_response):
    path = environ.get("PATH_INFO", "")

    if path in {"/health", "/health/"}:
        status = "200 OK"
        headers = [("Content-Type", "application/json")]
        start_response(status, headers)
        return [b'{"status": "ok", "bootstrap": "in-progress"}']

    # Health checks can hit "/" on some platforms (including Railway).
    if path == "/" and not _django_ready.is_set():
        status = "200 OK"
        headers = [("Content-Type", "application/json")]
        start_response(status, headers)
        return [b'{"status": "ok", "bootstrap": "in-progress"}']

    # Wait for Django to be ready for all other requests.
    if not _django_ready.wait(timeout=30):
        status = "503 Service Unavailable"
        headers = [("Content-Type", "application/json"), ("Retry-After", "5")]
        start_response(status, headers)
        return [b'{"status": "starting"}']
    if _django_error is not None:
        status = "500 Internal Server Error"
        headers = [("Content-Type", "application/json")]
        start_response(status, headers)
        return [b'{"status": "error", "detail": "django-bootstrap-failed"}']
    return _django_app(environ, start_response)
