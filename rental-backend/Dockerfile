FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install dependencies first so this layer is cached until requirements.txt changes
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Collect static files at build time (served by WhiteNoise).
# settings.py needs a DATABASE_URL to import; no connection is made here.
RUN DATABASE_URL=postgresql://build:build@localhost/build \
    python manage.py collectstatic --noinput

# Run as an unprivileged user that can still write uploads and logs
RUN useradd --uid 1000 --create-home appuser \
    && mkdir -p /app/media /app/logs \
    && chown -R appuser:appuser /app/media /app/logs /app/staticfiles \
    && chmod +x /app/docker-entrypoint.sh
USER appuser

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["sh", "-c", "exec gunicorn projects.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${WEB_CONCURRENCY:-3} --access-logfile - --error-logfile -"]
