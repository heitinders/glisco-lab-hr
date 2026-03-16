#!/bin/bash

echo "Waiting for database to be ready..."
python3 manage.py makemigrations
python3 manage.py migrate
python3 manage.py collectstatic --noinput
python3 manage.py createhorillauser --first_name admin --last_name admin --username admin --password admin --email admin@example.com --phone 1234567890
echo "Starting gunicorn on port ${PORT:-8000}..."
exec gunicorn --bind 0.0.0.0:${PORT:-8000} --timeout 120 --workers 1 --threads 2 --worker-tmp-dir /dev/shm --log-level info --access-logfile - --error-logfile - --capture-output --limit-request-field_size 16384 --limit-request-line 8190 horilla.wsgi:application
