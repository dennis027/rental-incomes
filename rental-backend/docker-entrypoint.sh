#!/bin/sh
set -e

# Set RUN_MIGRATIONS=false to start the server without touching the database schema
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "Running database migrations..."
    python manage.py migrate --noinput
fi

exec "$@"
