#!/bin/bash
echo "Starting gunicorn on port ${PORT:-8000}..."
exec gunicorn --bind 0.0.0.0:${PORT:-8000} --timeout 120 --workers 1 --threads 2 --worker-tmp-dir /dev/shm --log-level info --access-logfile - --error-logfile - --capture-output --limit-request-field_size 16384 --limit-request-line 8190 horilla.wsgi:application
