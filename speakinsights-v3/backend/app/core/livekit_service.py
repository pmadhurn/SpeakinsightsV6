"""
SpeakInsights v3 — LiveKit Service
Handles room management, token generation, and egress (recording) operations.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

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

        Records the participant's audio track to an OGG file for later
        speaker-attributed transcription.

        Args:
            room_name: LiveKit room name.
            participant_identity: Identity of the participant to record.
            meeting_id: Optional meeting UUID for file naming.

        Returns:
            Egress ID string.
        """
        try:
            api = self._get_api()
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
                "Started track egress %s for %s in %s → %s",
                egress_id,
                participant_identity,
                room_name,
                output_path,
            )
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

        Args:
            room_name: LiveKit room name.
            meeting_id: Optional meeting UUID for file naming.

        Returns:
            Egress ID string.
        """
        try:
            api = self._get_api()
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
                "Started composite egress %s for room %s → %s",
                egress_id,
                room_name,
                output_path,
            )
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


# Singleton instance
livekit_service = LiveKitService()
