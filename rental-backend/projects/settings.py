"""
Django settings for the portfolio_backend project.
Reads all sensitive/environment-specific values from a .env file.
"""
from datetime import timedelta
from pathlib import Path
import os
import dj_database_url

from celery.schedules import crontab
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(key: str, default: bool = False) -> bool:
    return os.getenv(key, str(default)).lower() in ("1", "true", "yes")


def env_list(key: str, default: str = "") -> list[str]:
    raw = os.getenv(key, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
SECRET_KEY = os.getenv("SECRET_KEY", "insecure-dev-key-change-me")
DEBUG = os.getenv("DEBUG", "False") == "True"
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")
# Render sets this to the service's own onrender.com address
if os.getenv("RENDER_EXTERNAL_HOSTNAME"):
    ALLOWED_HOSTS.append(os.environ["RENDER_EXTERNAL_HOSTNAME"])

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',  # Required for static files
    'corsheaders',
    'app',
    "rest_framework",
    "rest_framework_simplejwt",
    'rest_framework_simplejwt.token_blacklist',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Must be right under SecurityMiddleware
    'django.contrib.sessions.middleware.SessionMiddleware',
    "corsheaders.middleware.CorsMiddleware",
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # Keeps each landlord's data apart (see app/tenancy.py)
    'app.tenancy.AccountMiddleware',
]


ROOT_URLCONF = "projects.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# WSGI_APPLICATION = "config.wsgi.application"
# ASGI_APPLICATION = "config.asgi.application"

# ---------------------------------------------------------------------------
# Database (PostgreSQL)
# ---------------------------------------------------------------------------
# if os.getenv("DATABASE_URL"):
DATABASES = {
    "default": dj_database_url.parse(
        os.getenv("DATABASE_URL"),
        conn_max_age=600,
        # The hosted Postgres closes idle connections; check one before reusing it
        # instead of failing the request with "SSL connection has been closed"
        conn_health_checks=True,
        ssl_require=True,
    )
}
# else:
#     DATABASES = {
#         "default": {
#             "ENGINE": "django.db.backends.postgresql",
#             "NAME": os.getenv("DB_NAME"),
#             "USER": os.getenv("DB_USER"),
#             "PASSWORD": os.getenv("DB_PASSWORD"),
#             "HOST": os.getenv("DB_HOST"),
#             "PORT": os.getenv("DB_PORT", "5432"),
#         }
#     }

# ---------------------------------------------------------------------------
# Cache and background jobs (Redis)
# ---------------------------------------------------------------------------
# Without REDIS_URL everything still works in one process: an in-memory cache
# and Celery tasks run inline, which is what the tests and quick local runs use.
REDIS_URL = os.getenv("REDIS_URL", "")

if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": REDIS_URL,
            "KEY_PREFIX": "rent",
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
                # A Redis outage turns into cache misses instead of failed requests
                "IGNORE_EXCEPTIONS": True,
                "SOCKET_CONNECT_TIMEOUT": 2,
                "SOCKET_TIMEOUT": 2,
            },
        }
    }
    DJANGO_REDIS_LOG_IGNORED_EXCEPTIONS = True
else:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

# How long a cached GET response may be served. Any write clears them all
# straight away, so this only bounds date-driven changes (arrears, expiries).
API_CACHE_SECONDS = int(os.getenv("API_CACHE_SECONDS", 300))

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = None  # nothing reads task results
# Set CELERY_ALWAYS_EAGER=True to keep Redis for the cache but run tasks
# inline, for hosts with no worker process (e.g. Render's free tier)
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_ALWAYS_EAGER", not CELERY_BROKER_URL)
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_TIMEZONE = "Africa/Nairobi"
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_BEAT_SCHEDULE = {
    "recalculate-unit-balances": {
        "task": "app.tasks.recalculate_unit_balances",
        "schedule": crontab(hour=1, minute=0),
    },
    "flush-expired-tokens": {
        "task": "app.tasks.flush_expired_tokens",
        "schedule": crontab(hour=2, minute=30),
    },
    "send-rent-reminders": {
        "task": "app.tasks.send_rent_reminders",
        "schedule": crontab(hour=8, minute=0),
    },
}

# ---------------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# I18N
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Nairobi"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static / media (WhiteNoise serves static files in production)
# ---------------------------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# DRF
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    # Public endpoints (login, register, password reset...) opt out with AllowAny.
    # IsAccountMember scopes the request to the user's account and checks their role.
    "DEFAULT_PERMISSION_CLASSES": (
        "app.permissions.IsAccountMember",
    ),
    # No default pagination: the frontend expects plain lists and pages them itself
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ) if not DEBUG else (
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", 15))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", 7))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Portfolio Backend API",
    "DESCRIPTION": "REST API powering Dennis Kimani's portfolio (contact, analytics, projects, blog, etc).",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

# ---------------------------------------------------------------------------
# CORS / CSRF
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS", "http://localhost:4200,https://dennis027.github.io"
)
CSRF_TRUSTED_ORIGINS = [o for o in CORS_ALLOWED_ORIGINS if o.startswith("http")]
CORS_ALLOW_CREDENTIALS = True

# ---------------------------------------------------------------------------
# Security hardening (relaxed automatically in DEBUG)
# ---------------------------------------------------------------------------
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True

if not DEBUG:
    SECURE_SSL_REDIRECT = True
    # HTTPS ends at the host's proxy (Render, nginx); trust its header or every
    # request looks like plain http and redirects forever
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# ---------------------------------------------------------------------------
# Email (used for contact-form notifications)
# ---------------------------------------------------------------------------
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend" if not DEBUG else "django.core.mail.backends.console.EmailBackend"
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = EMAIL_HOST_USER
CONTACT_NOTIFY_EMAIL = os.getenv("CONTACT_NOTIFY_EMAIL", EMAIL_HOST_USER)

# ---------------------------------------------------------------------------
# Third-party integrations
# ---------------------------------------------------------------------------
RECAPTCHA_SECRET_KEY = os.getenv("RECAPTCHA_SECRET_KEY", "")
GITHUB_USERNAME = os.getenv("GITHUB_USERNAME", "dennis027")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

# Accounts are created by the administrator (admin site or createsuperuser).
# Each sign-up gets an account of its own and sees only its own data (app/tenancy.py),
# so this can be switched on once the product is open to the public.
ALLOW_PUBLIC_SIGNUP = env_bool("ALLOW_PUBLIC_SIGNUP", False)
# Where the web app is served, for links in emails (e.g. https://dennis027.github.io/rental-incomes)
FRONTEND_URL = os.getenv("FRONTEND_URL", "")

# M-Pesa paybill/till (Daraja C2B). Leave MPESA_CALLBACK_TOKEN empty to keep the callbacks switched off.
MPESA_CALLBACK_TOKEN = os.getenv("MPESA_CALLBACK_TOKEN", "")
MPESA_ENV = os.getenv("MPESA_ENV", "sandbox")  # sandbox | production
MPESA_SHORTCODE = os.getenv("MPESA_SHORTCODE", "")
MPESA_CONSUMER_KEY = os.getenv("MPESA_CONSUMER_KEY", "")
MPESA_CONSUMER_SECRET = os.getenv("MPESA_CONSUMER_SECRET", "")
# Public https address of this backend, e.g. https://api.example.com
MPESA_CALLBACK_BASE_URL = os.getenv("MPESA_CALLBACK_BASE_URL", "")
# "Pay now" prompts on the tenant's phone (STK push) also need the Lipa na M-Pesa Online passkey.
# Use CustomerBuyGoodsOnline as the transaction type for a till number.
MPESA_PASSKEY = os.getenv("MPESA_PASSKEY", "")
MPESA_TRANSACTION_TYPE = os.getenv("MPESA_TRANSACTION_TYPE", "CustomerPayBillOnline")

# SMS rent reminders (Africa's Talking). Leave AT_API_KEY empty to keep SMS off.
# AT_USERNAME=sandbox sends to the Africa's Talking simulator instead of real phones.
AT_USERNAME = os.getenv("AT_USERNAME", "")
AT_API_KEY = os.getenv("AT_API_KEY", "")
AT_SENDER_ID = os.getenv("AT_SENDER_ID", "")

# WhatsApp rent reminders (Meta WhatsApp Cloud API). Leave WHATSAPP_TOKEN empty to keep WhatsApp off.
# The three message templates must be approved in WhatsApp Manager first; see app/whatsapp.py.
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN", "")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_BUSINESS_ACCOUNT_ID = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
WHATSAPP_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v21.0")
WHATSAPP_TEMPLATE_LANGUAGE = os.getenv("WHATSAPP_TEMPLATE_LANGUAGE", "en")
WHATSAPP_TEMPLATE_DUE = os.getenv("WHATSAPP_TEMPLATE_DUE", "rent_due_reminder")
WHATSAPP_TEMPLATE_OVERDUE = os.getenv("WHATSAPP_TEMPLATE_OVERDUE", "rent_overdue_reminder")
WHATSAPP_TEMPLATE_BALANCE = os.getenv("WHATSAPP_TEMPLATE_BALANCE", "rent_balance_reminder")
WHATSAPP_TEMPLATE_MESSAGE = os.getenv("WHATSAPP_TEMPLATE_MESSAGE", "tenant_message")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name} - {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": BASE_DIR / "logs" / "app.log",
            "maxBytes": 5 * 1024 * 1024,
            "backupCount": 5,
            "formatter": "verbose",
        },
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {"handlers": ["console", "file"], "level": "INFO", "propagate": False},
        "apps": {"handlers": ["console", "file"], "level": "DEBUG", "propagate": False},
    },
}
os.makedirs(BASE_DIR / "logs", exist_ok=True)

AUTH_USER_MODEL = 'app.CustomUser'