"""
SpeakInsights v3 — LiveKit Service
Handles room management, token generation, and egress (recording) operations.
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import httpx
from livekit.api import (
    AccessToken,
    VideoGrants,
    LiveKitAPI,
    CreateRoomRequest,
    ListParticipantsRequest,
    RoomCompositeEgressRequest,
    TrackEgressRequest,
    StopEgressRequest,
    ListEgressRequest,
    EncodedFileOutput,
    DirectFileOutput,
    EncodedFileType,
)

from app.config import settings

logger = logging.getLogger(__name__)


class LiveKitService:
    """Service for LiveKit room management, token generation, and recording."""

    def __init__(self) -> None:
        self._api_key: str = settings.LIVEKIT_API_KEY
        self._api_secret: str = settings.LIVEKIT_API_SECRET
        self._livekit_url: str = settings.LIVEKIT_URL
        self._storage_path: str = settings.STORAGE_PATH
        logger.info("LiveKitService initialised (url=%s)", self._livekit_url)

    def _get_api(self) -> LiveKitAPI:
        """Create a LiveKit API client."""
        return LiveKitAPI(
            url=self._livekit_url,
            api_key=self._api_key,
            api_secret=self._api_secret,
        )

    # ------------------------------------------------------------------
    # Token generation
    # ------------------------------------------------------------------

    async def generate_token(
        self,
        room_name: str,
        participant_name: str,
        is_host: bool = False,
    ) -> str:
        """Generate a LiveKit JWT access token for a participant.

        Args:
            room_name: The LiveKit room name to grant access to.
            participant_name: Display / identity name for the participant.
            is_host: Whether the participant has host (admin) privileges.

        Returns:
            Signed JWT token string valid for 24 hours.
        """
        try:
            grant = VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
            )

            if is_host:
                grant.room_admin = True
                grant.room_record = True

            token = (
                AccessToken(self._api_key, self._api_secret)
                .with_identity(participant_name)
                .with_name(participant_name)
                .with_grants(grant)
                .with_ttl(timedelta(hours=24))
            )

            jwt_str = token.to_jwt()
            logger.info(
                "Generated token for %s in room %s (host=%s)",
                participant_name,
                room_name,
                is_host,
            )
            return jwt_str
        except Exception as exc:
            logger.error("Failed to generate token: %s", exc, exc_info=True)
            raise

    # ------------------------------------------------------------------
    # Room management
    # ------------------------------------------------------------------

    async def create_room(
        self,
        room_name: str,
        max_participants: int = 20,
    ) -> dict:
        """Create a LiveKit room.

        Args:
            room_name: Unique room name.
            max_participants: Maximum allowed participants (default 20).

        Returns:
            Room information dict.
        """
        try:
            api = self._get_api()
            req = CreateRoomRequest(
                name=room_name,
                max_participants=max_participants,
                empty_timeout=300,  # 5 min empty timeout
            )
            room = await api.room.create_room(req)
            logger.info("Created room: %s (max=%d)", room_name, max_participants)
            await api.aclose()
            return room
        except Exception as exc:
            logger.error("Failed to create room %s: %s", room_name, exc, exc_info=True)
            raise

    async def list_participants(self, room_name: str) -> list:
        """List participants currently in a room.

        Args:
            room_name: The room to query.

        Returns:
            List of participant info objects.
        """
        try:
            api = self._get_api()
            req = ListParticipantsRequest(room=room_name)
            participants = await api.room.list_participants(req)
            participants_list = participants.participants
            logger.debug("Room %s has %d participants", room_name, len(participants_list))
            await api.aclose()
            return participants_list
        except Exception as exc:
            logger.error(
                "Failed to list participants for %s: %s", room_name, exc, exc_info=True
            )
            raise

    async def remove_participant(self, room_name: str, identity: str) -> None:
        """Remove (kick) a participant from a room.

        Args:
            room_name: The room name.
            identity: Participant identity to remove.
        """
        try:
            api = self._get_api()
            from livekit.api import RoomParticipantIdentity
            req = RoomParticipantIdentity(room=room_name, identity=identity)
            await api.room.remove_participant(req)
            logger.info("Removed participant %s from room %s", identity, room_name)
            await api.aclose()
        except Exception as exc:
            logger.error(
                "Failed to remove %s from %s: %s", identity, room_name, exc, exc_info=True
            )
            raise

    # ------------------------------------------------------------------
    # Egress / recording
    # ------------------------------------------------------------------

    async def start_track_egress(
        self,
        room_name: str,
        participant_identity: str,
        meeting_id: Optional[str] = None,
    ) -> str:
        """Start individual audio track recording for a specific participant.

        Records the participant's audio track for later
        speaker-attributed transcription.
        For LiveKit Cloud: recordings are stored on LiveKit's infrastructure
        and downloaded via URL after egress completes.

        Args:
            room_name: LiveKit room name.
            participant_identity: Identity of the participant to record.
            meeting_id: Optional meeting UUID for file naming.

        Returns:
            Egress ID string.
        """
        try:
            api = self._get_api()
            # LiveKit Cloud needs a local Egress worker to write local files.
            # We provide a filepath so LiveKit Cloud routes the recording job
            # explicitly to our self-hosted Egress worker.
            file_name = f"{participant_identity}_{meeting_id or 'unknown'}.ogg"
            output_path = f"{self._storage_path}/recordings/{meeting_id or 'misc'}/{file_name}"
            output = DirectFileOutput(filepath=output_path)

            # List room participants to find the audio track SID
            req = ListParticipantsRequest(room=room_name)
            participants_resp = await api.room.list_participants(req)
            track_sid: Optional[str] = None
            for p in participants_resp.participants:
                if p.identity == participant_identity:
                    for track in p.tracks:
                        if track.type == 1:  # AUDIO
                            track_sid = track.sid
                            break
                    break

            if not track_sid:
                raise ValueError(
                    f"No audio track found for participant {participant_identity} in {room_name}"
                )

            egress_req = TrackEgressRequest(
                room_name=room_name,
                track_id=track_sid,
                file=output,
            )
            egress_info = await api.egress.start_track_egress(egress_req)

            egress_id = egress_info.egress_id
            logger.info(
                "Started track egress %s for %s in %s (LiveKit Cloud storage)",
                egress_id,
                participant_identity,
                room_name,
            )
            await api.aclose()
            return egress_id
        except Exception as exc:
            logger.error(
                "Failed to start track egress for %s: %s",
                participant_identity,
                exc,
                exc_info=True,
            )
            raise

    async def start_room_composite_egress(
        self,
        room_name: str,
        meeting_id: Optional[str] = None,
    ) -> str:
        """Start a composite room recording with active-speaker layout.

        Records the full room video/audio to an MP4 file.
        For LiveKit Cloud: recordings are stored on LiveKit's infrastructure
        and downloaded via URL after egress completes.

        Args:
            room_name: LiveKit room name.
            meeting_id: Optional meeting UUID for file naming.

        Returns:
            Egress ID string.
        """
        try:
            api = self._get_api()
            # LiveKit Cloud needs a local Egress worker to write local files.
            # We provide a filepath so LiveKit Cloud routes the recording job
            # explicitly to our self-hosted Egress worker instead of its own cloud workers.
            file_name = f"composite_{meeting_id or 'unknown'}.mp4"
            output_path = f"{self._storage_path}/recordings/{meeting_id or 'misc'}/{file_name}"

            output = EncodedFileOutput(
                file_type=EncodedFileType.MP4,
                filepath=output_path,
            )

            egress_req = RoomCompositeEgressRequest(
                room_name=room_name,
                layout="speaker",
                file=output,
            )
            egress_info = await api.egress.start_room_composite_egress(egress_req)

            egress_id = egress_info.egress_id
            logger.info(
                "Started composite egress %s for room %s (LiveKit Cloud storage)",
                egress_id,
                room_name,
            )
            await api.aclose()
            return egress_id
        except Exception as exc:
            logger.error(
                "Failed to start composite egress for %s: %s",
                room_name,
                exc,
                exc_info=True,
            )
            raise

    async def stop_egress(self, egress_id: str) -> dict:
        """Stop an active egress (recording).

        Args:
            egress_id: The egress process ID to stop.

        Returns:
            Egress info dict.
        """
        try:
            api = self._get_api()
            req = StopEgressRequest(egress_id=egress_id)
            info = await api.egress.stop_egress(req)
            logger.info("Stopped egress %s", egress_id)
            await api.aclose()
            return info
        except Exception as exc:
            logger.error("Failed to stop egress %s: %s", egress_id, exc, exc_info=True)
            raise

    async def list_egress(self, room_name: str) -> list:
        """List active egress processes for a room.

        Args:
            room_name: The room name to query.

        Returns:
            List of active egress info objects.
        """
        try:
            api = self._get_api()
            req = ListEgressRequest(room_name=room_name)
            egress_resp = await api.egress.list_egress(req)
            egress_list = egress_resp.items
            logger.debug("Room %s has %d active egress processes", room_name, len(egress_list))
            await api.aclose()
            return egress_list
        except Exception as exc:
            logger.error(
                "Failed to list egress for %s: %s", room_name, exc, exc_info=True
            )
            raise

    # ------------------------------------------------------------------
    # Egress download helpers (LiveKit Cloud)
    # ------------------------------------------------------------------

    async def get_egress_info(self, egress_id: str) -> Optional[object]:
        """Get info for a specific egress by ID.

        Args:
            egress_id: The egress process ID.

        Returns:
            EgressInfo object or None.
        """
        try:
            api = self._get_api()
            req = ListEgressRequest(egress_id=egress_id)
            egress_resp = await api.egress.list_egress(req)
            await api.aclose()
            items = egress_resp.items if hasattr(egress_resp, 'items') else []
            return items[0] if items else None
        except Exception as exc:
            logger.error("Failed to get egress info for %s: %s", egress_id, exc)
            return None

    async def wait_for_egress_complete(
        self,
        egress_id: str,
        timeout_seconds: int = 300,
        poll_interval: int = 5,
    ) -> Optional[object]:
        """Poll an egress until it reaches COMPLETE status or times out.

        Args:
            egress_id: The egress to poll.
            timeout_seconds: Max wait time in seconds.
            poll_interval: Seconds between polls.

        Returns:
            Final EgressInfo object or None if timed out.
        """
        logger.info("Waiting for egress %s to complete (timeout=%ds)...", egress_id, timeout_seconds)
        elapsed = 0

        while elapsed < timeout_seconds:
            info = await self.get_egress_info(egress_id)
            if info is None:
                logger.warning("Egress %s not found", egress_id)
                return None

            # EgressStatus: EGRESS_STARTING=0, EGRESS_ACTIVE=1, EGRESS_ENDING=2,
            #               EGRESS_COMPLETE=3, EGRESS_FAILED=4
            status = getattr(info, 'status', None)
            # Handle both enum and int values
            status_val = status if isinstance(status, int) else getattr(status, 'value', status)

            logger.debug("Egress %s status: %s (elapsed=%ds)", egress_id, status, elapsed)

            if status_val == 3:  # EGRESS_COMPLETE
                logger.info("Egress %s completed!", egress_id)
                return info
            elif status_val == 4:  # EGRESS_FAILED
                logger.error("Egress %s failed!", egress_id)
                return info

            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

        logger.warning("Timed out waiting for egress %s to complete", egress_id)
        return None

    def _extract_download_urls(self, egress_info: object) -> list[dict[str, str]]:
        """Extract download URLs from an EgressInfo object.

        Args:
            egress_info: LiveKit EgressInfo protobuf object.

        Returns:
            List of dicts with 'url', 'filename', and 'type' keys.
        """
        results = []

        # Check file_results (for EncodedFileOutput — composite recordings)
        file_results = getattr(egress_info, 'file_results', [])
        if file_results:
            for fr in (file_results if isinstance(file_results, list) else [file_results]):
                url = getattr(fr, 'download_url', '') or ''
                filename = getattr(fr, 'filename', '') or ''
                if url:
                    results.append({'url': url, 'filename': filename, 'type': 'composite'})
                elif filename:
                    # Produced by local egress worker
                    results.append({'url': '', 'filename': filename, 'type': 'composite', 'is_local': True})

        # Check file result (singular — for TrackEgressRequest)
        file_result = getattr(egress_info, 'file', None)
        if file_result:
            url = getattr(file_result, 'download_url', '') or ''
            filename = getattr(file_result, 'filename', '') or ''
            if url:
                results.append({'url': url, 'filename': filename, 'type': 'track'})
            elif filename:
                results.append({'url': '', 'filename': filename, 'type': 'track', 'is_local': True})

        # Newer SDK versions may use stream/segments — also check
        stream_results = getattr(egress_info, 'stream_results', [])
        segment_results = getattr(egress_info, 'segment_results', [])

        logger.debug(
            "Extracted %d download URLs from egress (file_results=%s, file=%s)",
            len(results),
            bool(file_results),
            bool(file_result),
        )
        return results

    async def download_egress_recording(
        self,
        egress_id: str,
        meeting_id: str,
        wait: bool = True,
    ) -> list[str]:
        """Download recording files from LiveKit Cloud after egress completes.

        This is the key method for LiveKit Cloud: after an egress completes,
        the recording isn't on your local disk — it's on LiveKit's infrastructure.
        We get the download URL and save the file locally.

        Args:
            egress_id: The egress process ID.
            meeting_id: Meeting UUID for organising local files.
            wait: Whether to wait for egress to complete first.

        Returns:
            List of local file paths where recordings were saved.
        """
        saved_files: list[str] = []

        if wait:
            info = await self.wait_for_egress_complete(egress_id)
        else:
            info = await self.get_egress_info(egress_id)

        if info is None:
            logger.error("No egress info for %s — cannot download", egress_id)
            return saved_files

        download_items = self._extract_download_urls(info)
        if not download_items:
            logger.warning("No download URLs found for egress %s", egress_id)
            return saved_files

        # Ensure local directory exists
        meeting_dir = Path(self._storage_path) / "recordings" / meeting_id
        meeting_dir.mkdir(parents=True, exist_ok=True)

        for item in download_items:
            url = item.get('url', '')
            filename = item.get('filename', '')
            is_local = item.get('is_local', False)

            # If the egress worker wrote this file natively, we don't need to download it!
            if is_local and filename and os.path.exists(filename):
                file_size = os.path.getsize(filename)
                logger.info(
                    "Recording already successfully generated at local path: %s (%.2f MB)",
                    filename,
                    file_size / (1024 * 1024),
                )
                saved_files.append(filename)
                continue

            # Fallback to HTTP download for LiveKit Cloud external storage (S3/GCP/Azure)
            if not url:
                logger.warning("No URL found to download egress item: %s", item)
                continue

            # Determine local filename
            if item.get('type') == 'composite':
                local_filename = f"composite_{meeting_id}.mp4"
            elif filename:
                local_filename = Path(filename).name
            else:
                local_filename = f"recording_{egress_id}.mp4"

            local_path = str(meeting_dir / local_filename)

            try:
                logger.info("Downloading recording from LiveKit Cloud: %s → %s", url[:80], local_path)
                async with httpx.AsyncClient(timeout=600.0, follow_redirects=True) as client:
                    async with client.stream("GET", url) as response:
                        response.raise_for_status()
                        with open(local_path, "wb") as f:
                            async for chunk in response.aiter_bytes(chunk_size=65536):
                                f.write(chunk)

                file_size = os.path.getsize(local_path)
                logger.info(
                    "Downloaded recording: %s (%.2f MB)",
                    local_path,
                    file_size / (1024 * 1024),
                )
                saved_files.append(local_path)

            except Exception as exc:
                logger.error("Failed to download recording from %s: %s", url[:80], exc, exc_info=True)

        return saved_files


# Singleton instance
livekit_service = LiveKitService()

