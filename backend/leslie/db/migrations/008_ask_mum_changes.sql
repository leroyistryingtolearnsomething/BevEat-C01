-- =============================================================================
-- KiddyEats migration 008: Mum's changes on an Ask Mum "yes" (Leslie, 16 Nov 2026)
-- Jira: CB69-74. Teacher feedback: when Mum approves, she can ask for "Less salt",
-- "Less ice" etc. (Figma 09e / 09f / 09g). The chips she picks are stored here, the
-- kid sees them as tags, and checkout prints them on the order ticket
-- (order_items.comment, which already exists). Safe to run more than once.
-- =============================================================================

ALTER TABLE public.ask_mum_requests
  ADD COLUMN IF NOT EXISTS changes text[] NOT NULL DEFAULT '{}'
  CHECK (cardinality(changes) <= 6);

-- Check:
-- SELECT request_id, status, changes FROM ask_mum_requests ORDER BY request_id DESC LIMIT 5;
