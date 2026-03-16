"""
App configuration for the Horilla Automations app.
Initializes model choices and starts automation when the server runs.
"""

import os
import sys
import threading
import time

from django.apps import AppConfig

_AUTOMATION_BOOTSTRAP_STARTED = False


class HorillaAutomationConfig(AppConfig):
    """Configuration class for the Horilla Automations Django app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "horilla_automations"

    def ready(self) -> None:
        global _AUTOMATION_BOOTSTRAP_STARTED
        ready = super().ready()
        if any(
            cmd in sys.argv
            for cmd in [
                "makemigrations",
                "migrate",
                "compilemessages",
                "flush",
                "shell",
            ]
        ):
            return ready
        if _AUTOMATION_BOOTSTRAP_STARTED:
            return ready
        _AUTOMATION_BOOTSTRAP_STARTED = True
        threading.Thread(target=self._bootstrap_automation, daemon=True).start()
        return ready

    def _bootstrap_automation(self):
        # Defer automation initialization so startup can serve HTTP quickly.
        time.sleep(2)
        try:
            from base.templatetags.horillafilters import app_installed
            from employee.models import Employee
            from horilla_automations.methods.methods import get_related_models
            from horilla_automations.models import MODEL_CHOICES

            recruitment_installed = False
            if app_installed("recruitment"):
                recruitment_installed = True

            models = [Employee]
            if recruitment_installed:
                from recruitment.models import Candidate

                models.append(Candidate)

            main_models = models
            for main_model in main_models:
                related_models = get_related_models(main_model)

                for model in related_models:
                    path = f"{model.__module__}.{model.__name__}"
                    MODEL_CHOICES.append((path, model.__name__))
            MODEL_CHOICES.append(("employee.models.Employee", "Employee"))
            MODEL_CHOICES.append(
                ("pms.models.EmployeeKeyResult", "Employee Key Results")
            )

            MODEL_CHOICES = list(set(MODEL_CHOICES))
            try:
                from horilla_automations.signals import start_automation

                start_automation()
            except Exception as e:
                print(e)
                """
                Migrations are not affected yet
                """
        except:
            """
            Models not ready yet
            """
