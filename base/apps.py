"""
This module contains the configuration for the 'base' app.
"""

from django.db.models.signals import post_migrate
from django.apps import AppConfig


class BaseConfig(AppConfig):
    """
    Configuration class for the 'base' app.
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "base"

    def ready(self) -> None:
        from base import signals

        super().ready()
        post_migrate.connect(
            create_default_employee_shift_days,
            dispatch_uid="base.create_default_employee_shift_days",
            weak=False,
        )


def create_default_employee_shift_days(sender, **kwargs):
    """
    Seed default shift-day rows after migrations, not during app startup.
    """
    if getattr(sender, "name", None) != "base":
        return
    try:
        from base.models import EmployeeShiftDay

        days = [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
        ]
        existing_days = set(
            EmployeeShiftDay.objects.filter(day__in=days).values_list("day", flat=True)
        )
        missing_days = [day for day in days if day not in existing_days]
        if missing_days:
            EmployeeShiftDay.objects.bulk_create(
                [EmployeeShiftDay(day=day) for day in missing_days]
            )
    except Exception:
        # Avoid blocking startup/migrations because of seed failures.
        pass
