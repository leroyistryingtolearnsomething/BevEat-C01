-- =============================================================================
-- KiddyEats migration 007: kid's note on an Ask Mum request (Leslie, 12 Nov 2026)
-- Raghav's request, docs/schema-requests.md #11. Lets a kid send Mum a short note
-- ("I finished my veg yesterday!") with the request. Shown on the parent's bell card
-- and request page. Applied to the live DB 12 Nov 2026. Safe to run more than once.
-- =============================================================================

ALTER TABLE public.ask_mum_requests
  ADD COLUMN IF NOT EXISTS child_note text
  CHECK (child_note IS NULL OR char_length(child_note) <= 100);
