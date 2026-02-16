"""
SpeakInsights v3 — Calendar Generator
Generates .ics (iCalendar) files for meetings and action items.
"""

import logging
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from icalendar import Calendar, Event, Todo, Alarm

from app.config import settings

logger = logging.getLogger(__name__)


class CalendarGenerator:
    """Generates valid iCalendar (.ics) files for meeting exports."""

    def __init__(self) -> None:
        self._storage_path: str = settings.STORAGE_PATH
        logger.info("CalendarGenerator initialised (storage=%s)", self._storage_path)

    def generate_ics(
        self,
        title: str,
        description: str,
        start_time: datetime,
        duration_minutes: int,
        attendees: list[str],
        tasks: list[dict[str, Any]],
        meeting_id: str,
    ) -> tuple[str, str]:
        """Generate a valid .ics calendar file for a meeting.

        Args:
            title: Meeting title.
            description: Meeting description.
            start_time: Meeting start datetime (UTC).
            duration_minutes: Meeting duration in minutes.
            attendees: List of attendee names/emails.
            tasks: List of task dicts (title, assignee, due_date, priority).
            meeting_id: UUID of the meeting for file naming.

        Returns:
            Tuple of (file_path, ics_content_string).
        """
        try:
            cal = Calendar()
            cal.add("prodid", "-//SpeakInsights v3//EN")
            cal.add("version", "2.0")
            cal.add("calscale", "GREGORIAN")
            cal.add("method", "PUBLISH")

            # ----- Main meeting event -----
            event = Event()
            event.add("uid", f"meeting-{meeting_id}@speakinsights")
            event.add("dtstart", start_time)
            event.add("dtend", start_time + timedelta(minutes=duration_minutes))
            event.add("summary", title)

            # Build description with action items
            desc_parts = [description or ""]
            if tasks:
                desc_parts.append("\n\n--- Action Items ---")
                for i, task in enumerate(tasks, 1):
                    assignee = task.get("assignee", "Unassigned")
                    due = task.get("due_date", "No due date")
                    desc_parts.append(
                        f"{i}. {task.get('title', 'Task')} "
                        f"[{assignee}] (Due: {due})"
                    )
            event.add("description", "\n".join(desc_parts))
            event.add("dtstamp", datetime.utcnow())
            event.add("created", datetime.utcnow())

            # Attendees
            for attendee in attendees:
                # If it looks like an email use it directly, otherwise create a pseudo-address
                if "@" in attendee:
                    event.add("attendee", f"mailto:{attendee}")
                else:
                    event.add("attendee", f"mailto:{attendee.lower().replace(' ', '.')}@speakinsights.local")

            # 15-minute reminder alarm
            alarm = Alarm()
            alarm.add("action", "DISPLAY")
            alarm.add("description", f"Reminder: {title}")
            alarm.add("trigger", timedelta(minutes=-15))
            event.add_component(alarm)

            cal.add_component(event)

            # ----- Optional VTODO entries for tasks with due dates -----
            for task in tasks:
                due_date = task.get("due_date")
                if not due_date:
                    continue

                todo = Todo()
                todo.add("uid", f"task-{uuid.uuid4()}@speakinsights")
                todo.add("summary", task.get("title", "Task"))
                todo.add("description", task.get("context", ""))
                todo.add("dtstamp", datetime.utcnow())
                todo.add("created", datetime.utcnow())

                # Parse due_date string to date/datetime
                if isinstance(due_date, str):
                    try:
                        due_dt = datetime.fromisoformat(due_date)
                        todo.add("due", due_dt)
                    except ValueError:
                        pass
                else:
                    todo.add("due", due_date)

                priority_map = {"critical": 1, "high": 3, "medium": 5, "low": 9}
                priority = priority_map.get(task.get("priority", "medium"), 5)
                todo.add("priority", priority)

                if task.get("assignee"):
                    name = task["assignee"]
                    if "@" in name:
                        todo.add("attendee", f"mailto:{name}")
                    else:
                        todo.add("attendee", f"mailto:{name.lower().replace(' ', '.')}@speakinsights.local")

                cal.add_component(todo)

            # ----- Write to file -----
            exports_dir = Path(self._storage_path) / "exports"
            exports_dir.mkdir(parents=True, exist_ok=True)
            file_path = exports_dir / f"meeting_{meeting_id}.ics"

            ics_content = cal.to_ical().decode("utf-8")
            file_path.write_text(ics_content, encoding="utf-8")

            logger.info("Generated .ics file: %s", file_path)
            return str(file_path), ics_content

        except Exception as exc:
            logger.error("Failed to generate .ics for meeting %s: %s", meeting_id, exc, exc_info=True)
            raise


# Singleton instance
calendar_generator = CalendarGenerator()
