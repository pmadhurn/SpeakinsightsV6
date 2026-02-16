-- =============================================================================
-- SpeakInsights v3 — Database Initialization
-- =============================================================================
-- This script runs automatically when the PostgreSQL container starts for the
-- first time. It enables required extensions only. Table creation is handled
-- by SQLAlchemy's Base.metadata.create_all() on backend startup.
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
-- Done — Extensions created. Tables will be created by SQLAlchemy on startup.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    RAISE NOTICE '=== SpeakInsights v3 database initialized ===';
    RAISE NOTICE 'Extensions : uuid-ossp, pg_trgm, vector';
    RAISE NOTICE 'Tables will be created by SQLAlchemy on backend startup.';
END $$;
