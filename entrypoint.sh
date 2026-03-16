#!/bin/bash

echo "Running migrations..."
python3 manage.py makemigrations 2>&1 | tail -5
python3 manage.py migrate --noinput 2>&1 | tail -5
python3 manage.py createhorillauser --first_name admin --last_name admin --username admin --password admin --email admin@example.com --phone 1234567890 2>&1 | tail -3
echo "Starting gunicorn on port ${PORT:-8000}..."
exec gunicorn --bind 0.0.0.0:${PORT:-8000} --timeout 120 --workers 1 --threads 2 --worker-tmp-dir /dev/shm --log-level info --access-logfile - --error-logfile - --capture-output --limit-request-field_size 16384 --limit-request-line 8190 horilla.wsgi:application
