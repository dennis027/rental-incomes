"""Limits on guessing (login attempts, password-reset codes) and on public form spam."""
from django.core.cache import cache

LOGIN_LIMIT = 5              # wrong passwords allowed...
LOGIN_WINDOW = 15 * 60       # ...within this many seconds, per account and address
RESET_CODE_LIMIT = 5         # wrong reset codes before the code is thrown away
PUBLIC_FORM_LIMIT = 5        # contact / demo messages allowed...
PUBLIC_FORM_WINDOW = 60 * 60 # ...within this many seconds, per address


def client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return forwarded.split(",")[0].strip() or request.META.get("REMOTE_ADDR", "")


def _login_key(request, identifier):
    return f"login-fail:{client_ip(request)}:{str(identifier or '').strip().lower()}"


def login_blocked(request, identifier):
    return cache.get(_login_key(request, identifier), 0) >= LOGIN_LIMIT


def login_failed(request, identifier):
    key = _login_key(request, identifier)
    cache.set(key, cache.get(key, 0) + 1, timeout=LOGIN_WINDOW)


def login_succeeded(request, identifier):
    cache.delete(_login_key(request, identifier))


def reset_code_exhausted(user, submitted_code):
    """
    Count a wrong reset code. After RESET_CODE_LIMIT wrong tries the code is
    cleared, so a six-digit code cannot be guessed by trying them all.
    Returns True when the code has just been (or already was) thrown away.
    """
    if user.reset_code and user.reset_code == submitted_code:
        return False
    key = f"reset-fail:{user.pk}"
    failures = cache.get(key, 0) + 1
    if failures >= RESET_CODE_LIMIT:
        user.reset_code = None
        user.reset_code_expiry = None
        user.save(update_fields=["reset_code", "reset_code_expiry"])
        cache.delete(key)
        return True
    cache.set(key, failures, timeout=15 * 60)
    return False


def public_form_limited(request, form_name):
    """Count one submission of a public form; True once the address is over the limit."""
    key = f"form:{form_name}:{client_ip(request)}"
    sent = cache.get(key, 0)
    if sent >= PUBLIC_FORM_LIMIT:
        return True
    cache.set(key, sent + 1, timeout=PUBLIC_FORM_WINDOW)
    return False
