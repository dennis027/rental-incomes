from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes


def generate_activation_link(user, request):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    # Follows the request, so the link is https wherever the site is
    return request.build_absolute_uri(f"/api/activate/{uid}/{token}/")

def generate_password_reset_link(user, request):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return request.build_absolute_uri(f"/api/reset-password-confirm/{uid}/{token}/")


