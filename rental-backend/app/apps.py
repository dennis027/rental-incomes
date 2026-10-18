from django.apps import AppConfig


class AppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'app'

    def ready(self):
        from django.db.models.signals import m2m_changed, post_delete, post_save

        from .caching import invalidate_on_write

        # Logins and token refreshes save the user; that changes no page
        for model in self.get_models():
            if model._meta.model_name == "customuser":
                continue
            post_save.connect(invalidate_on_write, sender=model, dispatch_uid=f"api-cache-save-{model.__name__}")
            post_delete.connect(invalidate_on_write, sender=model, dispatch_uid=f"api-cache-delete-{model.__name__}")
        m2m_changed.connect(invalidate_on_write, dispatch_uid="api-cache-m2m")
