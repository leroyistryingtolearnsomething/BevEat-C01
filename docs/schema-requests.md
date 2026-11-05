# Schema requests (Raghav → Leslie)

Proposed changes for Raghav's features (stall menu, cart, add-ons, comments, stall discovery, allergen tags and safe-only menu, stall story cards).
**Nothing here has been applied.** Leslie, please review and run whatever you agree with. The SQL is written for Postgres/Supabase. Each change is additive and safe for existing rows.

Checked against the live schema on 2026-11-05.

## Already in the schema (no change needed)

| Need | Where it already lives |
|---|---|
| Calories / protein / carbs / fat | `menu_items`, `add_ons`, `order_items` (snapshot) |
| Stall story | `stalls.story_text`, `stalls.year_started`, `stalls.seeking_successor`, owner via `stalls.owner_id → users.display_name` |
| Cuisine type | `stalls.cuisine` (free text) |
| Halal flag | `stalls.is_halal` |
| Comment on an order line | `order_items.comment` |
| Add-ons with price and macros | `add_ons` + `order_item_add_ons` (snapshot name/price) |
| Allergen tags with icons | `allergens.icon`, `menu_item_allergens` |

---

## 1. Allergen data "checked" flag on menu_items (HIGH, safety)

**Problem:** A dish with no `menu_item_allergens` rows could mean "contains no allergens" (e.g. Fresh Watermelon Juice, item 12) or "nobody has entered allergen data yet". Our safety rule says fail closed, but the API can't tell these two cases apart. So it would have to hide every allergen-free dish from every child with allergies.

**Proposal:** add an explicit flag. A dish is only shown to a child with allergies if `allergens_checked = true` and none of its allergens match.

```sql
ALTER TABLE public.menu_items
  ADD COLUMN allergens_checked boolean NOT NULL DEFAULT false;

-- The 12 seeded dishes have been reviewed, so mark them as checked.
-- (Leslie: please confirm each one's allergen list before running this.)
UPDATE public.menu_items SET allergens_checked = true WHERE item_id BETWEEN 1 AND 12;
```

## 2. Multiple allergens per add-on (HIGH, safety)

**Problem:** `add_ons.allergen_id` holds **one** allergen. A real add-on can contain several, e.g. "Add otah" = fish + egg, or a satay-sauce add-on = peanuts + soy. The safe-only filter would miss the second allergen.

**Proposal:** a join table that mirrors `menu_item_allergens`. Keep `add_ons.allergen_id` for now so nothing breaks, and backfill from it.

```sql
CREATE TABLE public.add_on_allergens (
  add_on_id   integer NOT NULL REFERENCES public.add_ons(add_on_id) ON DELETE CASCADE,
  allergen_id integer NOT NULL REFERENCES public.allergens(allergen_id),
  PRIMARY KEY (add_on_id, allergen_id)
);
ALTER TABLE public.add_on_allergens ENABLE ROW LEVEL SECURITY;

INSERT INTO public.add_on_allergens (add_on_id, allergen_id)
SELECT add_on_id, allergen_id FROM public.add_ons WHERE allergen_id IS NOT NULL;

-- Later, once code reads only from add_on_allergens:
-- ALTER TABLE public.add_ons DROP COLUMN allergen_id;
```

## 3. Ingredients list on menu_items (MEDIUM)

**Why:** parents and kids want to see what's in a dish ("chicken, rice, cucumber, soy sauce"). It also helps parents double-check allergens.

```sql
ALTER TABLE public.menu_items
  ADD COLUMN ingredients text[] NOT NULL DEFAULT '{}';
```

(`text[]` so the UI can render chips. Use a plain `text` column instead if you prefer.)

## 4. Comment length limit on order_items (MEDIUM, data integrity)

The API will enforce ≤ 200 characters. A DB constraint backs that up, the same way the brief asks us to validate everywhere.

```sql
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_comment_length_check
  CHECK (comment IS NULL OR char_length(comment) <= 200);
```

Existing data passes (the longest current comment is "No chilli please").

## 5. Fixed cuisine values on stalls (LOW)

We're standardising on 5 stalls: Chinese, Malay, Indian, Western, Drinks. A CHECK stops typos ("chinese", "Western Food") from breaking the discovery filter.

```sql
ALTER TABLE public.stalls
  ADD CONSTRAINT stalls_cuisine_check
  CHECK (cuisine IN ('Chinese', 'Malay', 'Indian', 'Western', 'Drinks'));
```

All 4 current stalls already use values from this list.

## 6. Add-on availability (LOW, optional)

A stall may run out of one add-on (e.g. no more braised eggs) without the whole dish being unavailable.

```sql
ALTER TABLE public.add_ons
  ADD COLUMN is_available boolean NOT NULL DEFAULT true;
```
