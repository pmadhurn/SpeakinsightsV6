-- =============================================================================
-- SpeakInsights v3 — Database Initialization
-- =============================================================================
-- This script runs automatically when the PostgreSQL container starts for the
-- first time. It enables required extensions and creates all tables, indexes,
-- and views for the SpeakInsights platform.
--
-- Extensions: uuid-ossp, pg_trgm, pgvector
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trigram matching for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- pgvector for embedding similarity search
CREATE EXTENSION IF NOT EXISTS vector;


-- ---------------------------------------------------------------------------
-- TABLE: users
-- Stores display names and avatar colors. No auth — identity only.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_name    VARCHAR(100)  NOT NULL,
    email           VARCHAR(255)  UNIQUE,                         -- nullable
    avatar_color    VARCHAR(7)    NOT NULL DEFAULT '#22D3EE',     -- Electric Cyan
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- TABLE: meetings
-- Each row = one video-conference session.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meetings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           VARCHAR(255)  NOT NULL,
    description     TEXT,
    room_id         VARCHAR(100)  NOT NULL UNIQUE,                -- LiveKit room, e.g. 'si-a1b2c3d4'
    host_id         UUID          REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR(20)   NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled','active','processing','ended','archived')),
    language        VARCHAR(10)   NOT NULL DEFAULT 'auto',        -- WhisperX language hint
    scheduled_at    TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    duration_sec    INTEGER,                                      -- computed on end
    settings        JSONB         NOT NULL DEFAULT '{"max_participants":20,"auto_record":true,"auto_transcribe":true}'::jsonb,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_status  ON meetings (status);
CREATE INDEX IF NOT EXISTS idx_meetings_host_id ON meetings (host_id);
CREATE INDEX IF NOT EXISTS idx_meetings_room_id ON meetings (room_id);


-- ---------------------------------------------------------------------------
-- TABLE: participants
-- Tracks everyone who joins (or tries to join) a meeting.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS participants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id      UUID          NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id         UUID          REFERENCES users(id) ON DELETE CASCADE,   -- nullable
    display_name    VARCHAR(100)  NOT NULL,
    role            VARCHAR(20)   NOT NULL DEFAULT 'participant'
                        CHECK (role IN ('host','participant','viewer')),
    status          VARCHAR(20)   NOT NULL DEFAULT 'waiting'
                        CHECK (status IN ('waiting','approved','declined','joined','left')),
    joined_at       TIMESTAMPTZ,
    left_at         TIMESTAMPTZ,
    duration_sec    INTEGER,
    UNIQUE (meeting_id, display_name)
);

CREATE INDEX IF NOT EXISTS idx_participants_meeting_id ON participants (meeting_id);
CREATE INDEX IF NOT EXISTS idx_participants_status     ON participants (status);


-- ---------------------------------------------------------------------------
-- TABLE: transcription_segments
-- Individual utterances produced by WhisperX (or browser speech fallback).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transcription_segments (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id        UUID          NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    participant_name  VARCHAR(100)  NOT NULL,
    segment_index     INTEGER       NOT NULL,
    start_time        FLOAT         NOT NULL,    -- seconds from meeting start
    end_time          FLOAT         NOT NULL,
    text              TEXT          NOT NULL,
    confidence        FLOAT,
    words             JSONB,                     -- [{word, start, end, confidence}, ...]
    language          VARCHAR(10)   NOT NULL DEFAULT 'en',
    sentiment_score   FLOAT,                     -- -1.0 … 1.0 (VADER)
    sentiment_label   VARCHAR(20),               -- positive / negative / neutral / mixed
    source            VARCHAR(20)   NOT NULL DEFAULT 'whisperx'
                        CHECK (source IN ('whisperx','browser_speech')),
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tseg_meeting_id        ON transcription_segments (meeting_id);
CREATE INDEX IF NOT EXISTS idx_tseg_meeting_start      ON transcription_segments (meeting_id, start_time);
CREATE INDEX IF NOT EXISTS idx_tseg_text_trgm          ON transcription_segments USING GIN (text gin_trgm_ops);


-- ---------------------------------------------------------------------------
-- TABLE: recordings
-- Composite (active-speaker) and screen-share recordings.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recordings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id      UUID          NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    file_path       VARCHAR(500)  NOT NULL,
    file_name       VARCHAR(255)  NOT NULL,
    file_size_bytes BIGINT,
    mime_type       VARCHAR(50)   NOT NULL DEFAULT 'video/webm',
    duration_sec    FLOAT,
    resolution      VARCHAR(20),
    record_type     VARCHAR(20)   NOT NULL DEFAULT 'composite'
                        CHECK (record_type IN ('composite','screen_share')),
    status          VARCHAR(20)   NOT NULL DEFAULT 'recording'
                        CHECK (status IN ('recording','processing','ready','error')),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recordings_meeting_id ON recordings (meeting_id);


-- ---------------------------------------------------------------------------
-- TABLE: individual_recordings
-- Per-participant audio tracks for speaker-attributed transcription.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS individual_recordings (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id            UUID          NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    participant_name      VARCHAR(100)  NOT NULL,
    file_path             VARCHAR(500)  NOT NULL,
    file_size_bytes       BIGINT,
    duration_sec          FLOAT,
    mime_type             VARCHAR(50)   NOT NULL DEFAULT 'audio/ogg',
    transcription_status  VARCHAR(20)   NOT NULL DEFAULT 'pending'
                              CHECK (transcription_status IN ('pending','processing','done','error')),
    language_detected     VARCHAR(10),
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_indiv_rec_meeting_id ON individual_recordings (meeting_id);


-- ---------------------------------------------------------------------------
-- TABLE: summaries
-- AI-generated post-meeting summary, key points, decisions, sentiment.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS summaries (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id          UUID          NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    executive_summary   TEXT,
    key_points          JSONB,                       -- ["point 1", "point 2", ...]
    decisions_made      JSONB,                       -- ["decision 1", ...]
    follow_ups          JSONB,                       -- ["follow-up 1", ...]
    sentiment_overview  JSONB,                       -- {overall_score, overall_label, meeting_mood}
    speaker_sentiments  JSONB,                       -- [{speaker_name, avg_score, label, summary_text}, ...]
    sentiment_arc       JSONB,                       -- [{timestamp, score, label}, ...]
    model_used          VARCHAR(100),
    prompt_tokens       INTEGER,
    completion_tokens   INTEGER,
    processing_time_ms  INTEGER,
    generated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_summaries_meeting_id ON summaries (meeting_id);


-- ---------------------------------------------------------------------------
-- TABLE: tasks
-- Action items extracted by the LLM from the meeting transcript.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id        UUID          NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    summary_id        UUID          REFERENCES summaries(id) ON DELETE SET NULL,
    title             VARCHAR(500)  NOT NULL,
    description       TEXT,
    assignee_name     VARCHAR(100),
    due_date          DATE,
    priority          VARCHAR(10)   NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('low','medium','high','urgent')),
    status            VARCHAR(20)   NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','in_progress','completed','cancelled')),
    source_timestamp  FLOAT,                          -- seconds into meeting when mentioned
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_meeting_id    ON tasks (meeting_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_name ON tasks (assignee_name);


-- ---------------------------------------------------------------------------
-- TABLE: transcript_embeddings
-- Vectorised chunks of transcript for RAG similarity search.
-- Uses nomic-embed-text (768-dim) via Ollama.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transcript_embeddings (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id    UUID          NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    segment_id    UUID          REFERENCES transcription_segments(id) ON DELETE SET NULL,
    chunk_text    TEXT          NOT NULL,
    chunk_index   INTEGER,
    speaker_name  VARCHAR(100),
    embedding     vector(768)   NOT NULL,              -- nomic-embed-text dimension
    metadata      JSONB,                               -- {start_time, end_time, meeting_title, …}
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- HNSW index for fast approximate nearest-neighbour cosine search
CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw
    ON transcript_embeddings
    USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_embeddings_meeting_id ON transcript_embeddings (meeting_id);


-- ---------------------------------------------------------------------------
-- TABLE: chat_messages
-- Conversation history for the RAG-powered AI chat interface.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID          NOT NULL,            -- groups a conversation thread
    role            VARCHAR(20)   NOT NULL
                        CHECK (role IN ('user','assistant','system')),
    content         TEXT          NOT NULL,
    model_used      VARCHAR(100),
    meeting_context UUID[],                            -- array of meeting IDs used for RAG
    tokens_used     INTEGER,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_session_created ON chat_messages (session_id, created_at);


-- ---------------------------------------------------------------------------
-- TABLE: calendar_exports
-- .ics file records for task → calendar export.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_exports (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id        UUID          NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    file_path         VARCHAR(500),
    event_title       VARCHAR(255),
    event_start       TIMESTAMPTZ,
    event_end         TIMESTAMPTZ,
    event_description TEXT,
    tasks_included    JSONB,                           -- array of task UUIDs
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- VIEW: meeting_overview
-- Aggregated view used by the history page.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW meeting_overview AS
SELECT
    m.id,
    m.title,
    m.description,
    m.room_id,
    m.status,
    m.language,
    m.started_at,
    m.ended_at,
    m.duration_sec,
    m.created_at,
    u.display_name  AS host_name,
    u.avatar_color  AS host_avatar_color,
    COALESCE(p.participant_count, 0)  AS participant_count,
    COALESCE(ts.segment_count, 0)    AS segment_count,
    (s.id IS NOT NULL)               AS has_summary,
    (r.id IS NOT NULL)               AS has_recording
FROM meetings m
LEFT JOIN users u
    ON m.host_id = u.id
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS participant_count
    FROM participants pp
    WHERE pp.meeting_id = m.id
) p ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS segment_count
    FROM transcription_segments seg
    WHERE seg.meeting_id = m.id
) ts ON true
LEFT JOIN LATERAL (
    SELECT id FROM summaries sm WHERE sm.meeting_id = m.id LIMIT 1
) s ON true
LEFT JOIN LATERAL (
    SELECT id FROM recordings rec WHERE rec.meeting_id = m.id LIMIT 1
) r ON true;


-- ---------------------------------------------------------------------------
-- Helper: auto-update updated_at on row modification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables that have updated_at
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_meetings_updated_at
    BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ---------------------------------------------------------------------------
-- Done
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    RAISE NOTICE '=== SpeakInsights v3 database initialized ===';
    RAISE NOTICE 'Extensions : uuid-ossp, pg_trgm, vector';
    RAISE NOTICE 'Tables     : users, meetings, participants, transcription_segments,';
    RAISE NOTICE '             recordings, individual_recordings, summaries, tasks,';
    RAISE NOTICE '             transcript_embeddings, chat_messages, calendar_exports';
    RAISE NOTICE 'Views      : meeting_overview';
    RAISE NOTICE 'Triggers   : updated_at on users, meetings, tasks';
END $$;
