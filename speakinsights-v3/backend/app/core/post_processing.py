"""
SpeakInsights v3 — Post-Processing Pipeline
Orchestrates the full post-meeting pipeline: transcription, embedding,
summarisation, task extraction, sentiment analysis, and calendar export.
Designed to run as a background asyncio task.
"""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.calendar_generator import calendar_generator
from app.core.ollama_client import ollama_client
from app.core.recording_manager import recording_manager
from app.core.sentiment_service import sentiment_service
from app.core.whisperx_client import whisperx_client
from app.db.database import async_session_factory
from app.models.calendar_export import CalendarExport
from app.models.embedding import TranscriptEmbedding
from app.models.meeting import Meeting
from app.models.recording import IndividualRecording
from app.models.summary import Summary
from app.models.task import Task
from app.models.transcription import TranscriptionSegment

logger = logging.getLogger(__name__)


class PostProcessingPipeline:
    """Post-meeting processing pipeline.

    Runs as a background task after a meeting ends:
      1. Transcribe individual audio tracks via WhisperX
      2. Run VADER sentiment on each segment
      3. Merge all segments into a chronological transcript
      4. Chunk the transcript for embedding
      5. Embed chunks via Ollama nomic-embed-text
      6. Summarise via Ollama
      7. Extract tasks via Ollama
      8. Deep sentiment analysis via Ollama
      9. Generate .ics calendar export
     10. Mark meeting as completed
    """

    def __init__(self) -> None:
        logger.info("PostProcessingPipeline initialised")

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    async def process_meeting(self, meeting_id: str) -> None:
        """Orchestrate the full post-meeting pipeline.

        Each step is wrapped in its own try/except so that a failure in
        one step does not kill the entire pipeline.

        Args:
            meeting_id: UUID of the meeting to process.
        """
        logger.info("=== Starting post-processing for meeting %s ===", meeting_id)

        async with async_session_factory() as db:
            # Update status to 'processing'
            await db.execute(
                update(Meeting)
                .where(Meeting.id == uuid.UUID(meeting_id))
                .values(status="processing")
            )
            await db.commit()

        all_segments: list[dict[str, Any]] = []

        # Step 1 & 2: Transcribe individual tracks + VADER sentiment
        try:
            all_segments = await self._step_transcribe_and_sentiment(meeting_id)
            logger.info("[Step 1-2] Transcribed %d segments for meeting %s", len(all_segments), meeting_id)
        except Exception as exc:
            logger.error("[Step 1-2] Transcription failed for meeting %s: %s", meeting_id, exc, exc_info=True)

        # Step 3: Merge into chronological transcript text
        merged_transcript = ""
        speaker_names: list[str] = []
        try:
            merged_transcript, speaker_names = self._step_merge_transcript(all_segments)
            logger.info("[Step 3] Merged transcript: %d chars, %d speakers", len(merged_transcript), len(speaker_names))
        except Exception as exc:
            logger.error("[Step 3] Merge failed for meeting %s: %s", meeting_id, exc, exc_info=True)

        # Step 4 & 5: Chunk + embed
        try:
            await self._step_chunk_and_embed(meeting_id, all_segments)
            logger.info("[Step 4-5] Chunking and embedding complete for meeting %s", meeting_id)
        except Exception as exc:
            logger.error("[Step 4-5] Embedding failed for meeting %s: %s", meeting_id, exc, exc_info=True)

        # Step 6: Summarise
        summary_data: dict[str, Any] = {}
        try:
            summary_data = await self._step_summarise(meeting_id, merged_transcript)
            logger.info("[Step 6] Summarisation complete for meeting %s", meeting_id)
        except Exception as exc:
            logger.error("[Step 6] Summarisation failed for meeting %s: %s", meeting_id, exc, exc_info=True)

        # Step 7: Extract tasks
        tasks_data: list[dict[str, Any]] = []
        try:
            tasks_data = await self._step_extract_tasks(meeting_id, merged_transcript)
            logger.info("[Step 7] Extracted %d tasks for meeting %s", len(tasks_data), meeting_id)
        except Exception as exc:
            logger.error("[Step 7] Task extraction failed for meeting %s: %s", meeting_id, exc, exc_info=True)

        # Step 8: Deep sentiment analysis
        try:
            await self._step_deep_sentiment(meeting_id, merged_transcript, speaker_names)
            logger.info("[Step 8] Deep sentiment analysis complete for meeting %s", meeting_id)
        except Exception as exc:
            logger.error("[Step 8] Deep sentiment failed for meeting %s: %s", meeting_id, exc, exc_info=True)

        # Step 9: Generate .ics calendar export
        try:
            await self._step_calendar_export(meeting_id, tasks_data)
            logger.info("[Step 9] Calendar export complete for meeting %s", meeting_id)
        except Exception as exc:
            logger.error("[Step 9] Calendar export failed for meeting %s: %s", meeting_id, exc, exc_info=True)

        # Step 10: Mark meeting as completed
        try:
            async with async_session_factory() as db:
                await db.execute(
                    update(Meeting)
                    .where(Meeting.id == uuid.UUID(meeting_id))
                    .values(status="completed", ended_at=datetime.utcnow())
                )
                await db.commit()
            logger.info("[Step 10] Meeting %s marked as completed", meeting_id)
        except Exception as exc:
            logger.error("[Step 10] Failed to update meeting status: %s", exc, exc_info=True)

        # Cleanup temp files
        try:
            recording_manager.cleanup_temp_files(meeting_id)
        except Exception:
            pass

        logger.info("=== Post-processing complete for meeting %s ===", meeting_id)

    # ------------------------------------------------------------------
    # Step 1-2: Transcribe individual tracks + VADER sentiment
    # ------------------------------------------------------------------

    async def _step_transcribe_and_sentiment(self, meeting_id: str) -> list[dict[str, Any]]:
        """Transcribe each individual audio track via WhisperX, run VADER on segments."""
        all_segments: list[dict[str, Any]] = []

        async with async_session_factory() as db:
            # Get all individual recordings for this meeting
            result = await db.execute(
                select(IndividualRecording).where(
                    IndividualRecording.meeting_id == uuid.UUID(meeting_id)
                )
            )
            individual_recordings = result.scalars().all()

            if not individual_recordings:
                logger.warning("No individual recordings found for meeting %s", meeting_id)
                return all_segments

            for rec in individual_recordings:
                speaker_name = rec.speaker_name
                file_path = rec.file_path

                if not file_path:
                    logger.warning("No file path for recording %s (speaker: %s)", rec.id, speaker_name)
                    continue

                logger.info("Transcribing track for %s: %s", speaker_name, file_path)

                try:
                    # Update transcription status
                    rec.transcription_status = "processing"
                    await db.commit()

                    # Send to WhisperX
                    segments = await whisperx_client.transcribe_file(
                        file_path, language=settings.DEFAULT_LANGUAGE
                    )

                    # Process each segment: VADER sentiment + save to DB
                    for seg in segments:
                        text = seg.get("text", "").strip()
                        if not text:
                            continue

                        # VADER sentiment
                        sentiment = sentiment_service.analyze_segment(text)

                        # Create DB record
                        db_segment = TranscriptionSegment(
                            id=uuid.uuid4(),
                            meeting_id=uuid.UUID(meeting_id),
                            speaker_name=speaker_name,
                            text=text,
                            language=seg.get("language"),
                            start_time=seg.get("start", 0.0),
                            end_time=seg.get("end", 0.0),
                            confidence=seg.get("confidence"),
                            sentiment_score=sentiment["compound"],
                            sentiment_label=sentiment["label"],
                            word_count=len(text.split()),
                            source="post_processing",
                            metadata_={"words": seg.get("words", [])},
                        )
                        db.add(db_segment)

                        all_segments.append({
                            "speaker": speaker_name,
                            "text": text,
                            "start": seg.get("start", 0.0),
                            "end": seg.get("end", 0.0),
                            "sentiment": sentiment,
                        })

                    rec.transcription_status = "completed"
                    await db.commit()
                    logger.info("Transcribed %d segments for %s", len(segments), speaker_name)

                except Exception as exc:
                    logger.error(
                        "Failed to transcribe track for %s: %s",
                        speaker_name,
                        exc,
                        exc_info=True,
                    )
                    rec.transcription_status = "failed"
                    await db.commit()

        return all_segments

    # ------------------------------------------------------------------
    # Step 3: Merge transcript
    # ------------------------------------------------------------------

    @staticmethod
    def _step_merge_transcript(
        segments: list[dict[str, Any]],
    ) -> tuple[str, list[str]]:
        """Merge all segments into a single chronological transcript.

        Args:
            segments: List of segment dicts with speaker, text, start, end.

        Returns:
            Tuple of (merged_transcript_text, list_of_speaker_names).
        """
        if not segments:
            return "", []

        # Sort by start time
        sorted_segs = sorted(segments, key=lambda s: s.get("start", 0.0))

        lines: list[str] = []
        speakers: set[str] = set()

        for seg in sorted_segs:
            speaker = seg.get("speaker", "Unknown")
            start = seg.get("start", 0.0)
            text = seg.get("text", "")
            speakers.add(speaker)

            # Format: [MM:SS] Speaker: text
            minutes = int(start // 60)
            seconds = int(start % 60)
            lines.append(f"[{minutes:02d}:{seconds:02d}] {speaker}: {text}")

        return "\n".join(lines), sorted(speakers)

    # ------------------------------------------------------------------
    # Step 4-5: Chunk + embed
    # ------------------------------------------------------------------

    async def _step_chunk_and_embed(
        self,
        meeting_id: str,
        segments: list[dict[str, Any]],
    ) -> None:
        """Chunk transcript and embed each chunk via Ollama."""
        if not segments:
            logger.info("No segments to chunk/embed for meeting %s", meeting_id)
            return

        chunks = self.chunk_transcript(segments)
        logger.info("Created %d chunks for meeting %s", len(chunks), meeting_id)

        # Generate embeddings for all chunks
        chunk_texts = [c["text"] for c in chunks]
        embeddings = await ollama_client.generate_embeddings_batch(chunk_texts)

        # Save to DB
        async with async_session_factory() as db:
            for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                db_embedding = TranscriptEmbedding(
                    id=uuid.uuid4(),
                    meeting_id=uuid.UUID(meeting_id),
                    chunk_text=chunk["text"],
                    chunk_index=idx,
                    speaker_name=chunk.get("speaker"),
                    start_time=chunk.get("start"),
                    end_time=chunk.get("end"),
                    embedding=embedding,
                    model_used=settings.EMBEDDING_MODEL,
                )
                db.add(db_embedding)
            await db.commit()

        logger.info("Stored %d embeddings for meeting %s", len(embeddings), meeting_id)

    @staticmethod
    def chunk_transcript(
        segments: list[dict[str, Any]],
        chunk_size: int = 500,
        overlap: int = 50,
    ) -> list[dict[str, Any]]:
        """Split transcript segments into overlapping chunks for embedding.

        Args:
            segments: List of segment dicts with speaker, text, start, end.
            chunk_size: Approximate token (word) count per chunk.
            overlap: Token overlap between consecutive chunks.

        Returns:
            List of chunk dicts with text, speaker, start, end.
        """
        if not segments:
            return []

        sorted_segs = sorted(segments, key=lambda s: s.get("start", 0.0))

        # Build a flat list of (word, speaker, timestamp)
        words_with_meta: list[tuple[str, str, float]] = []
        for seg in sorted_segs:
            speaker = seg.get("speaker", "Unknown")
            start = seg.get("start", 0.0)
            text = seg.get("text", "")
            for word in text.split():
                words_with_meta.append((word, speaker, start))

        if not words_with_meta:
            return []

        chunks: list[dict[str, Any]] = []
        i = 0
        total = len(words_with_meta)

        while i < total:
            end_idx = min(i + chunk_size, total)
            chunk_words = words_with_meta[i:end_idx]

            text = " ".join(w[0] for w in chunk_words)
            # Collect unique speakers
            speakers = list({w[1] for w in chunk_words})
            start_time = chunk_words[0][2]
            end_time = chunk_words[-1][2]

            chunks.append({
                "text": text,
                "speaker": ", ".join(speakers) if len(speakers) > 1 else speakers[0],
                "start": start_time,
                "end": end_time,
            })

            # Advance with overlap
            i += chunk_size - overlap
            if i >= total:
                break

        return chunks

    # ------------------------------------------------------------------
    # Step 6: Summarise
    # ------------------------------------------------------------------

    async def _step_summarise(
        self,
        meeting_id: str,
        transcript_text: str,
    ) -> dict[str, Any]:
        """Send transcript to Ollama for summarisation and save to DB."""
        if not transcript_text:
            logger.info("No transcript text to summarise for meeting %s", meeting_id)
            return {}

        # Get meeting title
        async with async_session_factory() as db:
            result = await db.execute(
                select(Meeting).where(Meeting.id == uuid.UUID(meeting_id))
            )
            meeting = result.scalar_one_or_none()
            title = meeting.title if meeting else "Untitled Meeting"

        summary_data = await ollama_client.summarize_transcript(transcript_text, title)

        # Save summary records
        async with async_session_factory() as db:
            # Executive summary
            db.add(Summary(
                id=uuid.uuid4(),
                meeting_id=uuid.UUID(meeting_id),
                summary_type="executive",
                content=summary_data.get("executive_summary", ""),
                structured_data=summary_data,
                model_used=summary_data.get("_model", settings.OLLAMA_MODEL),
                generation_time=datetime.utcnow(),
            ))

            # Key points
            db.add(Summary(
                id=uuid.uuid4(),
                meeting_id=uuid.UUID(meeting_id),
                summary_type="key_points",
                content="\n".join(summary_data.get("key_points", [])),
                structured_data={"key_points": summary_data.get("key_points", [])},
                model_used=summary_data.get("_model", settings.OLLAMA_MODEL),
                generation_time=datetime.utcnow(),
            ))

            # Decisions
            db.add(Summary(
                id=uuid.uuid4(),
                meeting_id=uuid.UUID(meeting_id),
                summary_type="decisions",
                content="\n".join(summary_data.get("decisions_made", [])),
                structured_data={"decisions_made": summary_data.get("decisions_made", [])},
                model_used=summary_data.get("_model", settings.OLLAMA_MODEL),
                generation_time=datetime.utcnow(),
            ))

            await db.commit()

        return summary_data

    # ------------------------------------------------------------------
    # Step 7: Extract tasks
    # ------------------------------------------------------------------

    async def _step_extract_tasks(
        self,
        meeting_id: str,
        transcript_text: str,
    ) -> list[dict[str, Any]]:
        """Extract tasks from the transcript via Ollama and save to DB."""
        if not transcript_text:
            return []

        tasks_data = await ollama_client.extract_tasks(transcript_text)

        async with async_session_factory() as db:
            for task in tasks_data:
                due_date = None
                if task.get("due_date"):
                    try:
                        from datetime import date as date_cls
                        due_date = date_cls.fromisoformat(task["due_date"])
                    except (ValueError, TypeError):
                        due_date = None

                priority = task.get("priority", "medium")
                if priority not in ("low", "medium", "high", "critical"):
                    priority = "medium"

                db.add(Task(
                    id=uuid.uuid4(),
                    meeting_id=uuid.UUID(meeting_id),
                    title=task.get("title", "Untitled Task"),
                    description=task.get("context", ""),
                    assignee=task.get("assignee"),
                    due_date=due_date,
                    priority=priority,
                    status="pending",
                ))
            await db.commit()

        return tasks_data

    # ------------------------------------------------------------------
    # Step 8: Deep sentiment
    # ------------------------------------------------------------------

    async def _step_deep_sentiment(
        self,
        meeting_id: str,
        transcript_text: str,
        speaker_names: list[str],
    ) -> None:
        """Deep sentiment analysis via Ollama and save to DB."""
        if not transcript_text:
            return

        sentiment_data = await ollama_client.analyze_sentiment(transcript_text, speaker_names)

        async with async_session_factory() as db:
            db.add(Summary(
                id=uuid.uuid4(),
                meeting_id=uuid.UUID(meeting_id),
                summary_type="sentiment",
                content=str(sentiment_data.get("overall_sentiment", "")),
                structured_data=sentiment_data,
                model_used=settings.OLLAMA_MODEL,
                generation_time=datetime.utcnow(),
            ))
            await db.commit()

    # ------------------------------------------------------------------
    # Step 9: Calendar export
    # ------------------------------------------------------------------

    async def _step_calendar_export(
        self,
        meeting_id: str,
        tasks_data: list[dict[str, Any]],
    ) -> None:
        """Generate .ics file if tasks have due dates."""
        tasks_with_dates = [t for t in tasks_data if t.get("due_date")]

        if not tasks_with_dates:
            logger.info("No tasks with due dates — skipping .ics generation for meeting %s", meeting_id)
            return

        async with async_session_factory() as db:
            result = await db.execute(
                select(Meeting).where(Meeting.id == uuid.UUID(meeting_id))
            )
            meeting = result.scalar_one_or_none()
            if not meeting:
                logger.warning("Meeting %s not found for calendar export", meeting_id)
                return

            # Gather attendee names
            attendees: list[str] = []
            from app.models.participant import Participant
            part_result = await db.execute(
                select(Participant).where(Participant.meeting_id == meeting.id)
            )
            for p in part_result.scalars().all():
                attendees.append(p.display_name)

            file_path, ics_content = calendar_generator.generate_ics(
                title=meeting.title,
                description=meeting.description or "",
                start_time=meeting.started_at or meeting.created_at,
                duration_minutes=int(
                    ((meeting.ended_at or datetime.utcnow()) - (meeting.started_at or meeting.created_at)).total_seconds() / 60
                ),
                attendees=attendees,
                tasks=tasks_with_dates,
                meeting_id=meeting_id,
            )

            # Save calendar export record
            db.add(CalendarExport(
                id=uuid.uuid4(),
                meeting_id=meeting.id,
                file_path=file_path,
                export_type="ics",
                tasks_included=[t.get("title") for t in tasks_with_dates],
            ))
            await db.commit()


# Singleton instance
post_processing = PostProcessingPipeline()
