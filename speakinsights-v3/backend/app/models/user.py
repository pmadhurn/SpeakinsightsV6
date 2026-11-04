"""
SpeakInsights v3 — User Model

Links a Clerk-authenticated browser session to a durable local user row.
Meetings/tasks/summaries can point at `users.id` (instead of only a display
name) once a user has signed in.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clerk_id = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(320), nullable=True, index=True)
    display_name = Column(String(100), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    is_pro = Column(Boolean, default=False, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    last_seen_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    hosted_meetings = relationship("Meeting", back_populates="host_user")

    def __repr__(self) -> str:
        return f"<User id={self.id} clerk_id={self.clerk_id} email={self.email}>"
