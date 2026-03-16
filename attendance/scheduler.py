import datetime
import os
import sys
import threading

import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from django.conf import settings

from base.backends import logger

_SCHEDULER = None
_SCHEDULER_LOCK = threading.Lock()
_SCHEDULER_STARTED = False


def create_work_record():
    from attendance.models import WorkRecords
    from employee.models import Employee

    date = datetime.datetime.today()
    work_records = WorkRecords.objects.filter(date=date).values_list(
        "employee_id", flat=True
    )
    employees = Employee.objects.exclude(id__in=work_records)
    records_to_create = []

    for employee in employees:
        try:
            shift_schedule = employee.get_shift_schedule()
            if shift_schedule is None:
                continue

            shift = employee.get_shift()
            record = WorkRecords(
                employee_id=employee,
                date=date,
                work_record_type="DFT",
                shift_id=shift,
                message="",
            )
            records_to_create.append(record)
        except Exception as e:
            logger.error(f"Error preparing work record for {employee}: {e}")

    if records_to_create:
        try:
            WorkRecords.objects.bulk_create(records_to_create)
            print(f"Created {len(records_to_create)} work records for {date}.")
        except Exception as e:
            logger.error(f"Failed to bulk create work records: {e}")
    else:
        print(f"No new work records to create for {date}.")


def should_start_scheduler():
    if os.environ.get("HORILLA_DISABLE_SCHEDULERS", "").lower() in {"1", "true", "yes"}:
        return False
    return not any(
        cmd in sys.argv
        for cmd in ["makemigrations", "migrate", "compilemessages", "flush", "shell"]
    )


def start_scheduler():
    """
    Initializes background tasks explicitly (not at module import time).
    """
    global _SCHEDULER, _SCHEDULER_STARTED
    if not should_start_scheduler():
        return
    with _SCHEDULER_LOCK:
        if _SCHEDULER_STARTED:
            return
        _SCHEDULER = BackgroundScheduler(timezone=pytz.timezone(settings.TIME_ZONE))
        _SCHEDULER.add_job(
            create_work_record, "interval", minutes=30, misfire_grace_time=3600 * 3
        )
        _SCHEDULER.add_job(
            create_work_record,
            "cron",
            hour=0,
            minute=30,
            misfire_grace_time=3600 * 9,
            id="create_daily_work_record",
            replace_existing=True,
        )
        _SCHEDULER.start()
        _SCHEDULER_STARTED = True


def start_scheduler_async(delay_seconds=2):
    def _start():
        try:
            start_scheduler()
        except Exception as exc:
            logger.error(f"Attendance scheduler failed to start: {exc}")

    threading.Timer(delay_seconds, _start).start()
