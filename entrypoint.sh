#!/bin/bash
set -e

echo "=== ENTRYPOINT START ==="
echo "PORT=$PORT"
echo "DJANGO_SETTINGS_MODULE=${DJANGO_SETTINGS_MODULE:-horilla.settings}"
echo "Python: $(python --version 2>&1)"
echo "Working dir: $(pwd)"
echo "Files in /app: $(ls /app/ 2>&1 | head -5)"

# Quick sanity check: can Python import the wsgi module?
echo "Testing Django import..."
python -c "
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'horilla.settings')
print('ENV OK')
try:
    from horilla.wsgi import application
    print('WSGI IMPORT OK')
except Exception as e:
    print(f'WSGI IMPORT FAILED: {e}')
" 2>&1 || echo "Python test failed with exit code $?"

echo "Starting gunicorn on port ${PORT:-8000}..."
exec gunicorn \
    --bind "0.0.0.0:${PORT:-8000}" \
    --timeout 120 \
    --workers 1 \
    --threads 2 \
    --worker-tmp-dir /dev/shm \
    --log-level debug \
    --access-logfile - \
    --error-logfile - \
    --capture-output \
    --limit-request-field_size 16384 \
    --limit-request-line 8190 \
    horilla.wsgi:application
