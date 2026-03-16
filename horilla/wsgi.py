"""
WSGI config for horilla project.

Serves /health/ instantly while Django loads in a background thread,
so Railway health checks pass before the full app is ready.
"""

import os
import sys
import threading
import time
import traceback

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "horilla.settings")

_django_app = None
_django_ready = threading.Event()
_django_error = None
_load_status = "not-started"


def _log(msg):
    print(f"[WSGI] {msg}", file=sys.stderr, flush=True)


def _instrument_app_ready():
    """Monkey-patch AppConfig.ready to log timing per app."""
    from django.apps import AppConfig

    _original_ready = AppConfig.ready

    def _timed_ready(self):
        t = time.time()
        _log(f"  ready() START: {self.name}")
        try:
            result = _original_ready(self)
        except Exception as e:
            _log(f"  ready() FAILED: {self.name} after {time.time()-t:.1f}s — {e}")
            raise
        elapsed = time.time() - t
        if elapsed > 0.5:
            _log(f"  ready() SLOW:  {self.name} took {elapsed:.1f}s")
        else:
            _log(f"  ready() OK:    {self.name} ({elapsed:.2f}s)")
        return result

    AppConfig.ready = _timed_ready


def _load_django():
    global _django_app, _django_error, _load_status
    try:
        _load_status = "importing-settings"
        _log("Importing Django settings...")
        t0 = time.time()

        import django
        from django.conf import settings

        _log(f"Settings imported in {time.time()-t0:.1f}s, DEBUG={settings.DEBUG}")

        # Instrument per-app timing before setup
        _instrument_app_ready()

        _load_status = "django-setup"
        _log("Running django.setup()...")
        t1 = time.time()
        django.setup()
        _log(f"django.setup() completed in {time.time()-t1:.1f}s")

        _load_status = "get-wsgi-app"
        from django.core.wsgi import get_wsgi_application

        _django_app = get_wsgi_application()
        _load_status = "ready"
        _log(f"Django fully loaded in {time.time()-t0:.1f}s total")
    except Exception as exc:
        _django_error = exc
        _load_status = f"error: {exc}"
        _log(f"Django load FAILED: {exc}")
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
            body = f'{{"status": "error", "detail": "{_load_status}"}}'.encode()
        elif _django_ready.is_set():
            status = "200 OK"
            body = b'{"status": "ok", "django": "ready"}'
        else:
            status = "200 OK"
            body = f'{{"status": "ok", "django": "loading", "phase": "{_load_status}"}}'.encode()
        headers = [("Content-Type", "application/json")]
        start_response(status, headers)
        return [body]

    # All other requests wait for Django
    if not _django_ready.wait(timeout=120):
        status = "503 Service Unavailable"
        headers = [("Content-Type", "application/json"), ("Retry-After", "10")]
        start_response(status, headers)
        return [f'{{"status": "starting", "phase": "{_load_status}"}}'.encode()]

    if _django_error is not None:
        status = "500 Internal Server Error"
        headers = [("Content-Type", "application/json")]
        start_response(status, headers)
        return [f'{{"status": "error", "detail": "{_load_status}"}}'.encode()]

    return _django_app(environ, start_response)
