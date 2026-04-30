"""
SpeakInsights v3 — Post-Processing Pipeline
Orchestrates the full post-meeting pipeline: transcription, embedding,
summarisation, task extraction, sentiment analysis, and calendar export.
Designed to run as a background asyncio task.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.calendar_generator import calendar_generator
from app.core.livekit_service import livekit_service
from app.core.llm_provider import llm_provider
from app.core.recording_manager import recording_manager
from app.core.sentiment_service import sentiment_service
from app.core.whisperx_client import whisperx_client
from app.db.database import async_session_factory
from app.models.calendar_export import CalendarExport
from app.models.embedding import TranscriptEmbedding
from app.models.meeting import Meeting
from app.models.recording import IndividualRecording, Recording
from app.models.summary import Summary
from app.models.task import Task
from app.models.transcription import TranscriptionSegment

logger = logging.getLogger(__name__)


class PostProcessingPipeline:
    """Post-meeting processing pipeline.

    Runs as a background task after a meeting ends:
      0. Download recordings from LiveKit Cloud (if egress IDs provided)
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

    async def process_meeting(
        self,
        meeting_id: str,
        egress_ids: list[str] | None = None,
    ) -> None:
        """Orchestrate the full post-meeting pipeline.

        Each step is wrapped in its own try/except so that a failure in
        one step does not kill the entire pipeline.

        Args:
            meeting_id: UUID of the meeting to process.
            egress_ids: Optional list of egress IDs to download recordings from.
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

        # Step 0: Download recordings from LiveKit Cloud
        if egress_ids:
            try:
                await self._step_download_recordings(meeting_id, egress_ids)
                logger.info("[Step 0] Recording download complete for meeting %s", meeting_id)
            except Exception as exc:
                logger.error("[Step 0] Recording download failed for meeting %s: %s", meeting_id, exc, exc_info=True)
        else:
            logger.info("[Step 0] No egress IDs provided — skipping recording download for meeting %s", meeting_id)

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
                    .values(status="completed")
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
    # Step 0: Download recordings from LiveKit Cloud
    # ------------------------------------------------------------------

    async def _step_download_recordings(
        self,
        meeting_id: str,
        egress_ids: list[str],
    ) -> None:
        """Download recording files from LiveKit Cloud egress.

        LiveKit Cloud stores egress recordings on its infrastructure.
        After egress completes, we download the files to local storage.
        Also updates the Recording DB records with actual file paths and sizes.
        """
        for egress_id in egress_ids:
            try:
                logger.info(
                    "Downloading egress %s for meeting %s from LiveKit Cloud...",
                    egress_id, meeting_id,
                )
                saved_files = await livekit_service.download_egress_recording(
                    egress_id=egress_id,
                    meeting_id=meeting_id,
                    wait=True,
                )

                if saved_files:
                    logger.info(
                        "Downloaded %d recording files for egress %s: %s",
                        len(saved_files), egress_id, saved_files,
                    )

                    # Update the Recording DB record with actual file info
                    async with async_session_factory() as db:
                        result = await db.execute(
                            select(Recording).where(
                                Recording.meeting_id == uuid.UUID(meeting_id),
                                Recording.egress_id == egress_id,
                            )
                        )
                        recording = result.scalar_one_or_none()
                        if recording:
                            recording.file_path = saved_files[0]
                            recording.status = "completed"
                            try:
                                import os
                                recording.file_size = os.path.getsize(saved_files[0])
                            except Exception:
                                pass
                            try:
                                recording.duration = await recording_manager.get_audio_duration(saved_files[0])
                            except Exception:
                                pass
                            recording.completed_at = datetime.now(timezone.utc)
                            await db.commit()
                            logger.info(
                                "Updated recording DB record for egress %s (size=%s)",
                                egress_id, recording.file_size,
                            )
                else:
                    logger.warning(
                        "No files downloaded for egress %s — recording may not be available",
                        egress_id,
                    )
                    # Mark recording as failed if no files were downloaded
                    async with async_session_factory() as db:
                        result = await db.execute(
                            select(Recording).where(
                                Recording.meeting_id == uuid.UUID(meeting_id),
                                Recording.egress_id == egress_id,
                            )
                        )
                        recording = result.scalar_one_or_none()
                        if recording:
                            recording.status = "failed"
                            await db.commit()

            except Exception as exc:
                logger.error(
                    "Failed to download egress %s for meeting %s: %s",
                    egress_id, meeting_id, exc, exc_info=True,
                )

    # ------------------------------------------------------------------
    # Step 1-2: Transcribe individual tracks + VADER sentiment
    # ------------------------------------------------------------------

    async def _step_transcribe_and_sentiment(self, meeting_id: str) -> list[dict[str, Any]]:
        """Transcribe each individual audio track via WhisperX, run VADER on segments.

        Falls back to extracting audio from the composite MP4 recording
        when individual tracks are missing, and finally to existing live
        transcription segments from the DB if no recordings at all.
        """
        all_segments: list[dict[str, Any]] = []

        async with async_session_factory() as db:
            # Get all individual recordings for this meeting
            result = await db.execute(
                select(IndividualRecording).where(
                    IndividualRecording.meeting_id == uuid.UUID(meeting_id)
                )
            )
            individual_recordings = result.scalars().all()

            has_audio_files = False
            if individual_recordings:
                for rec in individual_recordings:
                    speaker_name = rec.speaker_name
                    file_path = rec.file_path

                    if not file_path:
                        logger.warning("No file path for recording %s (speaker: %s)", rec.id, speaker_name)
                        continue

                    # Check if the audio file actually exists
                    import os
                    if not os.path.exists(file_path):
                        logger.warning(
                            "Audio file not found for %s: %s — will try composite fallback",
                            speaker_name, file_path,
                        )
                        continue

                    has_audio_files = True
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

            # ---------------------------------------------------------------
            # FALLBACK 1: No individual audio tracks found — try extracting
            # audio from the composite MP4 recording.
            # ---------------------------------------------------------------
            if not has_audio_files or not all_segments:
                logger.info(
                    "No individual audio tracks for meeting %s — "
                    "attempting composite MP4 audio extraction",
                    meeting_id,
                )

                extracted_audio = await recording_manager.extract_audio_from_composite(
                    meeting_id,
                )

                if extracted_audio:
                    logger.info(
                        "Composite audio extracted: %s — sending to WhisperX with diarization",
                        extracted_audio,
                    )

                    # Determine fallback speaker name from the first participant, or use meeting host
                    fallback_speaker = "Speaker"
                    if individual_recordings:
                        fallback_speaker = individual_recordings[0].speaker_name or "Speaker"
                    else:
                        # Try to get the host name from the meeting
                        meeting_result = await db.execute(
                            select(Meeting).where(Meeting.id == uuid.UUID(meeting_id))
                        )
                        meeting_obj = meeting_result.scalar_one_or_none()
                        if meeting_obj and meeting_obj.host_name:
                            fallback_speaker = meeting_obj.host_name

                    try:
                        # Request diarization to identify different speakers
                        segments = await whisperx_client.transcribe_file(
                            extracted_audio,
                            language=settings.DEFAULT_LANGUAGE,
                            diarize=True,
                        )

                        for seg in segments:
                            text = seg.get("text", "").strip()
                            if not text:
                                continue

                            # Use diarization speaker label if available,
                            # otherwise fall back to meeting speaker name
                            speaker = seg.get("speaker") or fallback_speaker

                            sentiment = sentiment_service.analyze_segment(text)

                            db_segment = TranscriptionSegment(
                                id=uuid.uuid4(),
                                meeting_id=uuid.UUID(meeting_id),
                                speaker_name=speaker,
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
                                "speaker": speaker,
                                "text": text,
                                "start": seg.get("start", 0.0),
                                "end": seg.get("end", 0.0),
                                "sentiment": sentiment,
                            })

                        await db.commit()
                        logger.info(
                            "Transcribed %d segments from composite audio for meeting %s",
                            len(all_segments), meeting_id,
                        )

                    except Exception as exc:
                        logger.error(
                            "Failed to transcribe extracted composite audio: %s",
                            exc, exc_info=True,
                        )

            # ---------------------------------------------------------------
            # FALLBACK 2: If still no segments, use live transcription
            # segments already saved in the DB (if any survive deletion).
            # ---------------------------------------------------------------
            if not all_segments:
                logger.info(
                    "No audio-based transcription succeeded for meeting %s — "
                    "falling back to existing live transcription segments from DB",
                    meeting_id,
                )
                result = await db.execute(
                    select(TranscriptionSegment)
                    .where(TranscriptionSegment.meeting_id == uuid.UUID(meeting_id))
                    .order_by(TranscriptionSegment.start_time)
                )
                live_segments = result.scalars().all()

                if live_segments:
                    for seg in live_segments:
                        text = (seg.text or "").strip()
                        if not text:
                            continue

                        # Re-run VADER sentiment if not already present
                        sentiment_score = seg.sentiment_score
                        sentiment_label = seg.sentiment_label
                        if sentiment_score is None:
                            sentiment = sentiment_service.analyze_segment(text)
                            sentiment_score = sentiment["compound"]
                            sentiment_label = sentiment["label"]
                            seg.sentiment_score = sentiment_score
                            seg.sentiment_label = sentiment_label

                        all_segments.append({
                            "speaker": seg.speaker_name or "Unknown",
                            "text": text,
                            "start": seg.start_time or 0.0,
                            "end": seg.end_time or 0.0,
                            "sentiment": {
                                "compound": sentiment_score or 0.0,
                                "label": sentiment_label or "neutral",
                            },
                        })

                    await db.commit()
                    logger.info(
                        "Loaded %d live transcription segments for meeting %s",
                        len(all_segments), meeting_id,
                    )
                else:
                    logger.warning(
                        "No live transcription segments found either for meeting %s",
                        meeting_id,
                    )

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
        embeddings = await llm_provider.generate_embeddings_batch(chunk_texts)

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

        summary_data = await llm_provider.summarize_transcript(transcript_text, title)

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
                generation_time=datetime.now(timezone.utc),
            ))

            # Key points
            db.add(Summary(
                id=uuid.uuid4(),
                meeting_id=uuid.UUID(meeting_id),
                summary_type="key_points",
                content="\n".join(summary_data.get("key_points", [])),
                structured_data={"key_points": summary_data.get("key_points", [])},
                model_used=summary_data.get("_model", settings.OLLAMA_MODEL),
                generation_time=datetime.now(timezone.utc),
            ))

            # Decisions
            db.add(Summary(
                id=uuid.uuid4(),
                meeting_id=uuid.UUID(meeting_id),
                summary_type="decisions",
                content="\n".join(summary_data.get("decisions_made", [])),
                structured_data={"decisions_made": summary_data.get("decisions_made", [])},
                model_used=summary_data.get("_model", settings.OLLAMA_MODEL),
                generation_time=datetime.now(timezone.utc),
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

        tasks_data = await llm_provider.extract_tasks(transcript_text)

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

        sentiment_data = await llm_provider.analyze_sentiment(transcript_text, speaker_names)

        async with async_session_factory() as db:
            db.add(Summary(
                id=uuid.uuid4(),
                meeting_id=uuid.UUID(meeting_id),
                summary_type="sentiment",
                content=str(sentiment_data.get("overall_sentiment", "")),
                structured_data=sentiment_data,
                model_used=settings.OLLAMA_MODEL,
                generation_time=datetime.now(timezone.utc),
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
                    ((meeting.ended_at or datetime.now(timezone.utc)) - (meeting.started_at or meeting.created_at)).total_seconds() / 60
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
