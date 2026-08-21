-- Castle Defense global leaderboard schema (Cloudflare D1 / SQLite)
--
-- Privacy note: this table deliberately holds NO personal data. There is no
-- email, no free-text name, and no stored IP address. A "player" is an opaque
-- random token the browser generates for itself, and a display name is only
-- ever an index into the fixed word lists in worker.js — so no arbitrary text
-- can ever reach the database. See README.md.

CREATE TABLE IF NOT EXISTS scores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  token       TEXT    NOT NULL,           -- opaque client-generated player id
  adj         INTEGER NOT NULL,           -- index into ADJECTIVES
  noun        INTEGER NOT NULL,           -- index into NOUNS
  num         INTEGER NOT NULL,           -- 0-9999 discriminator
  score       INTEGER NOT NULL,           -- waves survived
  world       INTEGER NOT NULL,
  wave        INTEGER NOT NULL,
  kills       INTEGER NOT NULL,
  bosses      INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  mode        TEXT    NOT NULL DEFAULT 'run',  -- 'run' | 'daily'
  created_at  INTEGER NOT NULL            -- unix seconds
);

-- Leaderboard reads: top N by score within a time window.
CREATE INDEX IF NOT EXISTS idx_scores_board ON scores (mode, score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_recent ON scores (created_at);
-- "Your best" lookups and the one-row-per-player rollup.
CREATE INDEX IF NOT EXISTS idx_scores_token ON scores (token, score DESC);

-- Rate limiting. Holds a rotating-salt hash of the submitter, never a raw IP,
-- and rows are disposable — the cleanup job drops anything older than a day.
CREATE TABLE IF NOT EXISTS rate_limit (
  bucket     TEXT PRIMARY KEY,  -- hash(salt-of-the-day + token-or-ip)
  count      INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
