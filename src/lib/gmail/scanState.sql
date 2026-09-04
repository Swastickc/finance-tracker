-- Schema for the Gmail scan-state persistence layer (src/lib/gmail/scanState.ts).
-- Apply with: wrangler d1 execute finance-tracker-gmail-scan-state --file=src/lib/gmail/scanState.sql
--
-- state is one of: 'pending' | 'importing' | 'imported'. There is no stored
-- "ambiguous" value — it's derived at read time in scanState.ts from an
-- "importing" row whose claimed_at is older than AMBIGUOUS_AFTER_MS, and is
-- NEVER automatically resolved back to another state; only a human, after
-- checking the actual Sheet, should do that (not yet built as a UI action).
CREATE TABLE IF NOT EXISTS gmail_scan_state (
  message_id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  claimed_at TEXT,
  imported_at TEXT
);
