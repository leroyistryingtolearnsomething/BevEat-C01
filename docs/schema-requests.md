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

---

# Added 2026-11-06: stall menu, food detail and tray (Kids Figma 03–06)

Checked against the live schema on 2026-11-06. Requests #1 (`allergens_checked`), #2 (`add_on_allergens`) and #3 (`ingredients`) above are **still not applied**. The new screens depend on them:
- **#1**: without it, Chendol (11) and Fresh Watermelon Juice (12) stay locked for every child with allergies (fail closed).
- **#3**: without it, the "What's inside" chips on Food detail are empty. The ingredient lists are already written in `backend/raghav/db/seed/02_after_schema_update.sql`.

## 7. Dish health info on menu_items (MEDIUM)

**Why:** The Figma menu and Food detail show **"Healthy pick"**, **"Less sugar"**, **"✓ Not fried"** and a **Healthy meter** (0–5 leaves + "Great pick!"). The 05b rule "No fried food" also needs to know which dishes are fried. None of this is in the schema.

```sql
ALTER TABLE public.menu_items
  ADD COLUMN is_fried     boolean  NOT NULL DEFAULT false,
  ADD COLUMN is_low_sugar boolean  NOT NULL DEFAULT false,
  ADD COLUMN health_score smallint CHECK (health_score BETWEEN 0 AND 5);  -- NULL = not rated yet, meter hidden
```

"Healthy pick" = `health_score >= 4`, so it doesn't need its own column. Raghav will write a seed file that fills these for dishes 1–30 once the columns exist.

## 8. Parent food rules ("Mum says no") (HIGH, needed for 05b)

**Why:** PRODUCT.md lists "Mum's rules (allergies, blocked items)", and the 05b screen says *"Mum picked 'No fried food' for school days"*. No table exists, so no dish can be `blocked_parent`. **Owner: Leroy** (parent food rules). The parent-side Ask Mum approval (#9) is **Leslie's**.

```sql
CREATE TABLE public.child_food_rules (
  rule_id    integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  child_id   integer NOT NULL REFERENCES public.child_profiles(child_id) ON DELETE CASCADE,
  rule_type  text    NOT NULL CHECK (rule_type IN ('no_fried', 'blocked_item')),
  item_id    integer REFERENCES public.menu_items(item_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((rule_type = 'blocked_item') = (item_id IS NOT NULL))
);
CREATE UNIQUE INDEX child_food_rules_unique ON public.child_food_rules (child_id, rule_type, COALESCE(item_id, 0));
ALTER TABLE public.child_food_rules ENABLE ROW LEVEL SECURITY;
```

`no_fried` depends on `menu_items.is_fried` (#7).

## 9. Ask Mum requests (MEDIUM, needed for the 05b "Ask Mum" button)

**Why:** 05b has an **Ask Mum** button: *"Mum gets a ping on her phone and can say yes just this once."* The kid's button and request endpoints are **Raghav's**. Notifying and approving/denying on the parent side is **Leslie's**. An approval lets the child order that one dish **today only**, and it can only lift a parent food rule (#8). **An allergy block can never be lifted this way.**

```sql
CREATE TABLE public.ask_mum_requests (
  request_id   integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  child_id     integer NOT NULL REFERENCES public.child_profiles(child_id) ON DELETE CASCADE,
  item_id      integer NOT NULL REFERENCES public.menu_items(item_id) ON DELETE CASCADE,
  status       text    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  -- The Singapore calendar day the request belongs to. "Just this once" = this day only.
  -- A plain column (not an expression) keeps the unique index and the "today" check easy to read.
  request_date date    NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Singapore')::date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  decided_at   timestamptz,
  CHECK ((status = 'pending') = (decided_at IS NULL))
);

-- ONE request per child per dish per day, whatever Mum answered: tapping Ask Mum again,
-- even after a "no", can't spam the parent. The child can ask again tomorrow.
CREATE UNIQUE INDEX ask_mum_one_per_day
  ON public.ask_mum_requests (child_id, item_id, request_date);

-- The parent screen lists a child's pending requests; the menu looks up today's approvals.
CREATE INDEX ask_mum_child_date ON public.ask_mum_requests (child_id, request_date);

ALTER TABLE public.ask_mum_requests ENABLE ROW LEVEL SECURITY;
```

Who writes what: Raghav's API only **INSERTs** `pending` rows. Leslie's API only **UPDATEs** `status` + `decided_at` on rows that are still `pending`. Contract: `docs/api-contracts.md` §2f.

## 10. Data fix: hidden egg in "Add vanilla ice cream" (HIGH, safety, no schema change)

Add-on 12 (Ice Kacang → "Add vanilla ice cream") contains **milk and egg**, but `add_ons.allergen_id` only holds Milk, and Ice Kacang itself has no Egg tag. So a child allergic to egg (but not peanuts or milk) could add it. Until #2 (`add_on_allergens`) exists, the safest single value is **Egg**: Ice Kacang already contains milk, so a milk-allergic child never sees the dish anyway. Raghav's `03_more_add_ons.sql` makes this change (it's Raghav's own seed row) and explains why.
