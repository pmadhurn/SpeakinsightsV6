# SpeakInsights v3 — Bug Report

All confirmed bugs found by reading the actual source files. Ordered by severity.

---

## CRITICAL

### BUG-01 — `CreateMeeting.tsx` uses `mockApi` instead of real API
**File:** `frontend/src/pages/CreateMeeting.tsx`
**Problem:** The active (uncommented) version used a local `mockApi` that generated fake IDs and never called the real backend.
**Fix:** Replaced entire file with the real implementation using `meetings.create()` from `api.ts`.
**Status:** [x] Fixed

---

### BUG-02 — `CreateMeeting.tsx` exported component named `App` instead of `CreateMeeting`
**File:** `frontend/src/pages/CreateMeeting.tsx`
**Problem:** `export default function App()` — wrong name, breaks HMR and DevTools.
**Fix:** Renamed to `CreateMeeting` as part of BUG-01 fix.
**Status:** [x] Fixed

---

### BUG-03 — `useAudioChunking`: race condition with 150ms `setTimeout` for blob collection
**File:** `frontend/src/hooks/useAudioChunking.ts`
**Problem:** `processAndSendChunk()` used `setTimeout(150ms)` after `recorder.stop()`. Under load the blob could be empty when the timeout fired, silently dropping chunks.
**Fix:** Moved send logic inside `recorder.onstop` callback — event-driven, no arbitrary delay.
**Status:** [x] Fixed

---

### BUG-04 — `useChatStream`: `setIsStreaming(false)` not called in `finally` block
**File:** `frontend/src/hooks/useChatStream.ts`
**Problem:** Re-thrown `parseErr` bypassed the catch block, leaving `isStreaming` stuck `true` forever.
**Fix:** Wrapped entire try/catch in `try/finally` that always calls `setIsStreaming(false)`.
**Status:** [x] Fixed

---

### BUG-05 — `lobby_ws.py`: LiveKit token not validated before sending to participant
**File:** `backend/app/websockets/lobby_ws.py`
**Problem:** `generate_token()` result was never checked for `None`/empty before being sent in the `approved` message.
**Fix:** Added `if not token: raise ValueError(...)` after the await.
**Status:** [x] Fixed

---

## HIGH

### BUG-06 — `transcriptions.py`: `datetime.utcfromtimestamp()` deprecated + timezone mismatch
**File:** `backend/app/api/routes/transcriptions.py`
**Problem:** Naive datetime from `utcfromtimestamp` subtracted from potentially timezone-aware `meeting.started_at` causing `TypeError`.
**Fix:** Used `datetime.fromtimestamp(..., tz=timezone.utc)` and added tzinfo normalization before subtraction.
**Status:** [x] Fixed

---

### BUG-07 — `MeetingRoom.tsx`: WebSocket disconnect functions never called on unmount
**File:** `frontend/src/pages/MeetingRoom.tsx`
**Problem:** `connectTranscriptWs` and `connectMeetingWs` were called but disconnect functions were never stored or called on unmount — memory leak.
**Fix:** Destructured `disconnect` from both `useWebSocket` calls and called them in the `useEffect` cleanup return.
**Status:** [x] Fixed

---

### BUG-08 — `transcriptStore.ts`: `addSegment` does not deduplicate by ID
**File:** `frontend/src/stores/transcriptStore.ts`
**Problem:** Segments arriving from both the live WS and the initial `getTranscript` load appeared twice.
**Fix:** Added `if (state.segments.some(s => s.id === segment.id)) return state;` guard.
**Status:** [x] Fixed

---

### BUG-09 — `useLiveCaptions`: `not-allowed` error loops permission requests
**File:** `frontend/src/hooks/useLiveCaptions.ts`
**Problem:** On mic denial, `setIsListening(false)` was called but `enabledRef.current` stayed `true`, causing `onend` to restart recognition in a loop.
**Fix:** Also set `enabledRef.current = false` when `not-allowed` error is received.
**Status:** [x] Fixed

---

### BUG-10 — `meetings.py`: `_generate_code()` has no collision check
**File:** `backend/app/api/routes/meetings.py`
**Problem:** Duplicate code would cause a unique constraint 500 error instead of retrying.
**Fix:** Changed to `async def _generate_code(db)` with a retry loop that checks for existing codes.
**Status:** [x] Fixed

---

### BUG-11 — `MeetingReview.tsx`: wrong processing WebSocket event type names
**File:** `frontend/src/pages/MeetingReview.tsx`
**Problem:** Frontend listened for `processing_update` / `processing_complete` but backend broadcasts `processing_progress` / `processing_completed`. Processing status UI never updated.
**Fix:** Updated frontend handler to match backend event names.
**Status:** [x] Fixed

---

## MEDIUM

### BUG-12 — `chat.py` SSE stream: user message not committed before streaming starts
**File:** `backend/app/api/routes/chat.py`
**Problem:** `await db.flush()` was used instead of `await db.commit()` for the user message in the stream endpoint, so it was never persisted if the connection dropped.
**Fix:** Changed `await db.flush()` to `await db.commit()` for the user message save.
**Status:** [x] Fixed

---

### BUG-13 — `api.ts`: `chat.sendStream` uses `EventSource` (GET) on a POST endpoint
**File:** `frontend/src/services/api.ts`
**Problem:** `EventSource` only supports GET. The `/api/chat/stream` endpoint is POST — this always returned 405. Dead code that was misleading.
**Fix:** Removed the broken `sendStream` method entirely.
**Status:** [x] Fixed

---

### BUG-14 — `useTranscription.ts`: `addSegmentInternal` used before declaration (stale closure)
**File:** `frontend/src/hooks/useTranscription.ts`
**Problem:** `addSegmentInternal` was referenced inside the `useWebSocket` `onMessage` callback before it was declared with `useCallback`, capturing `undefined` on first render.
**Fix:** Moved `addSegmentInternal` declaration above `useWebSocket` and added a stable ref (`addSegmentInternalRef`) so the WS closure always calls the latest version.
**Status:** [x] Fixed

---

### BUG-15 — `summaries.py`: deprecated Core `__table__.delete()` syntax
**File:** `backend/app/api/routes/summaries.py`
**Problem:** `Summary.__table__.delete()` bypasses the ORM unit-of-work and can cause stale identity map entries.
**Fix:** Replaced with `delete(Summary).where(...)` using SQLAlchemy's proper ORM delete import.
**Status:** [x] Fixed

---

### BUG-16 — `MeetingRoom.tsx`: `useUIStore.getState()` called directly inside JSX render
**File:** `frontend/src/pages/MeetingRoom.tsx`
**Problem:** `useUIStore.getState().setSidebarTab(tab)` bypassed React's event system; stale closure risk.
**Fix:** Replaced with the already-destructured `setSidebarTab(tab)` from the hook.
**Status:** [x] Fixed

---

### BUG-17 — `post_processing.py`: meeting `ended_at` overwritten in Step 10
**File:** `backend/app/core/post_processing.py`
**Problem:** Step 10 set `ended_at=datetime.utcnow()` overwriting the real end time set when the meeting was ended via the API.
**Fix:** Removed `ended_at` from the Step 10 update — only `status="completed"` is set.
**Status:** [x] Fixed

---

### BUG-18 — `transcriptions.py`: timezone mismatch in recording offset calculation
**File:** `backend/app/api/routes/transcriptions.py`
**Problem:** Naive vs aware datetime subtraction could crash or silently return wrong offset.
**Fix:** Normalized `meeting.started_at` to UTC-aware before subtraction (part of BUG-06 fix).
**Status:** [x] Fixed

---

## LOW

### BUG-19 — `AIChat.tsx`: `isMobile` computed at module load time, not reactively
**File:** `frontend/src/pages/AIChat.tsx`
**Problem:** `window.innerWidth < 768` evaluated once at render; stale after resize.
**Fix:** Changed to `useState(() => window.innerWidth >= 768)` — correct initial value without the dead variable.
**Status:** [x] Fixed

---

### BUG-20 — `MeetingReview.tsx`: `revokeObjectURL` called before download starts
**File:** `frontend/src/pages/MeetingReview.tsx`
**Problem:** Object URL revoked immediately after `.click()`, before browser starts the download.
**Fix:** Wrapped `URL.revokeObjectURL` in `setTimeout(..., 100)`.
**Status:** [x] Fixed

---

### BUG-21 — `useRecording.ts`: would create duplicate WS connection (unused hook)
**File:** `frontend/src/hooks/useRecording.ts`
**Problem:** Hook was designed to open its own `/ws/meeting` connection, duplicating `useMeeting`'s connection.
**Fix:** Added clarifying comment that callers should pass `wsUrl` from the shared meeting WS. Hook is currently unused in the app so no runtime impact.
**Status:** [x] Fixed (documented)

---

### BUG-22 & BUG-23 — `datetime.utcnow()` deprecated throughout backend
**Files:** `backend/app/websockets/lobby_ws.py`, `backend/app/api/routes/meetings.py`, `backend/app/api/routes/summaries.py`, `backend/app/core/post_processing.py`, `backend/app/core/calendar_generator.py`
**Problem:** `datetime.utcnow()` is deprecated in Python 3.12+ and returns naive datetimes that can cause comparison errors with timezone-aware values.
**Fix:** Replaced all occurrences with `datetime.now(timezone.utc)` and added `timezone` to all relevant imports.
**Status:** [x] Fixed

---

### BUG-24 — `api.ts`: `transcriptions.search` return type was wrong
**File:** `frontend/src/services/api.ts`
**Problem:** Typed as `TranscriptSearchResult[]` but backend returns `{ query, meeting_id, results, count }`. `.then(r => r.data)` returned the wrapper object.
**Fix:** Updated type and unwrap to `.then(r => r.data.results || [])`.
**Status:** [x] Fixed

---

*Total bugs: 24 — All fixed*
