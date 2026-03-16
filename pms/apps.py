"""
Django application configuration for the PMS (Performance Management System) app.
"""

import threading
import time

from django.apps import AppConfig

_PMS_AUTOMATION_BOOTSTRAP_STARTED = False


class PmsConfig(AppConfig):
    """
    This class provides configuration settings for the PMS app, such as the default
    database field type and the app's name.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "pms"

    def ready(self):
        global _PMS_AUTOMATION_BOOTSTRAP_STARTED
        from django.urls import include, path

        from horilla.horilla_settings import APPS
        from horilla.urls import urlpatterns

        APPS.append("pms")
        urlpatterns.append(
            path("pms/", include("pms.urls")),
        )
        super().ready()
        if not _PMS_AUTOMATION_BOOTSTRAP_STARTED:
            _PMS_AUTOMATION_BOOTSTRAP_STARTED = True
            threading.Thread(target=self._bootstrap_automation, daemon=True).start()

    def _bootstrap_automation(self):
        # Keep app initialization non-blocking.
        time.sleep(2)
        try:
            from pms.signals import start_automation

            start_automation()
        except:
            """
            Migrations are not affected yet
            """
