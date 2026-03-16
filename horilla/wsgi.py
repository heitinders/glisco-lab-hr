"""
WSGI config for horilla project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.1/howto/deployment/wsgi/
"""

import os
import threading

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "horilla.settings")

# Load Django in a background thread so the health check responds immediately
_django_app = None
_django_ready = threading.Event()


def _load_django():
    global _django_app
    from django.core.wsgi import get_wsgi_application

    _django_app = get_wsgi_application()
    _django_ready.set()


threading.Thread(target=_load_django, daemon=True).start()


def application(environ, start_response):
    path = environ.get("PATH_INFO", "")

    # Health check responds immediately, even before Django loads
    if path == "/health/" or path == "/health":
        status = "200 OK"
        headers = [("Content-Type", "application/json")]
        start_response(status, headers)
        return [b'{"status": "ok"}']

    # Wait for Django to be ready for all other requests
    _django_ready.wait()
    return _django_app(environ, start_response)
