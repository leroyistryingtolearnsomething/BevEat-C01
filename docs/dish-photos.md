# Dish photos (default images)

Every dish has a `menu_items.default_image_url` such as `/images/menu/chicken-rice.jpg`. The app shows this picture when a dish has no approved community photo yet. Community photos are Gabriel's (the top-voted photo replaces this image).

**Right now none of these files exist**, so every dish picture is broken. This page lists exactly which file each dish needs and where it goes.

## Where the files go

Put every file in:

```
frontend/public/images/menu/
```

Why this folder: Vite serves everything in `frontend/public/` from the site root, both in `npm run dev` and in the production build (it copies the folder into `dist/`, which Vercel serves). So `frontend/public/images/menu/chicken-rice.jpg` is reachable at `/images/menu/chicken-rice.jpg`, exactly the path stored in the database. No code or database change is needed. Just drop the files in with the exact names below.

- Don't put them in `frontend/src/assets/`. Vite renames files there (e.g. `chicken-rice.a1b2c3.jpg`), so the database path would no longer match.
- Don't put them in `frontend/dist/`. That folder is build output, is gitignored, and is deleted on every build.

## File rules

| Rule | Value |
|---|---|
| Format | `.jpg` |
| Width | about **800 px** (landscape, roughly 4:3; cards crop to fit) |
| Size | **under 300 KB** each (export at ~75–80% JPEG quality) |
| Name | exactly as in the table: lower case, hyphens, no spaces |
| Content | a real photo of that dish that we're allowed to use (our own, or royalty-free with the source noted in the "Source" column) |

## If a file is missing

The kids' screens never show a broken image. Each dish `<img>` has an `onError` fallback that swaps in `/images/menu/placeholder-dish.svg` (added in Raghav's PR A, in this same folder). A missing file therefore only shows the placeholder.

(Vercel's catch-all rewrite to `index.html` means a missing image comes back as an HTML page rather than a 404. The browser still can't decode it as an image, so `onError` fires and the placeholder shows.)

## All 30 dishes

| item_id | Stall | Dish | File (in `frontend/public/images/menu/`) | Have it? | Source |
|---|---|---|---|---|---|
| 1 | Lim's Chicken Rice | Steamed Chicken Rice | `chicken-rice.jpg` | ☐ | |
| 2 | Lim's Chicken Rice | Roasted Chicken Rice | `roast-chicken-rice.jpg` | ☐ | |
| 3 | Lim's Chicken Rice | Kids Chicken Rice Set | `kids-chicken-rice.jpg` | ☐ | |
| 13 | Lim's Chicken Rice | Char Siew Rice | `char-siew-rice.jpg` | ☐ | |
| 14 | Lim's Chicken Rice | Dry Wanton Noodles | `wanton-noodles.jpg` | ☐ | |
| 15 | Lim's Chicken Rice | Fishball Noodle Soup | `fishball-noodles.jpg` | ☐ | |
| 4 | Mariam Nasi Lemak | Nasi Lemak with Chicken Wing | `nasi-lemak.jpg` | ☐ | |
| 5 | Mariam Nasi Lemak | Mee Goreng | `mee-goreng.jpg` | ☐ | |
| 6 | Mariam Nasi Lemak | Plain Nasi Lemak (no sambal) | `plain-nasi-lemak.jpg` | ☐ | |
| 16 | Mariam Nasi Lemak | Mee Soto | `mee-soto.jpg` | ☐ | |
| 17 | Mariam Nasi Lemak | Kids Ayam Goreng Set | `kids-ayam-goreng.jpg` | ☐ | |
| 18 | Mariam Nasi Lemak | Mee Rebus | `mee-rebus.jpg` | ☐ | |
| 7 | Kumar's Prata Corner | Plain Prata with Dhal (2 pcs) | `prata.jpg` | ☐ | |
| 8 | Kumar's Prata Corner | Egg Prata with Dhal (2 pcs) | `egg-prata.jpg` | ☐ | |
| 9 | Kumar's Prata Corner | Cheese Prata with Dhal (2 pcs) | `cheese-prata.jpg` | ☐ | |
| 19 | Kumar's Prata Corner | Chicken Briyani | `chicken-briyani.jpg` | ☐ | |
| 20 | Kumar's Prata Corner | Plain Thosai with Dhal | `thosai.jpg` | ☐ | |
| 21 | Kumar's Prata Corner | Roti John | `roti-john.jpg` | ☐ | |
| 10 | Wong's Drinks & Desserts | Milo Ice | `milo.jpg` | ☐ | |
| 11 | Wong's Drinks & Desserts | Chendol | `chendol.jpg` | ☐ | |
| 12 | Wong's Drinks & Desserts | Fresh Watermelon Juice | `watermelon.jpg` | ☐ | |
| 22 | Wong's Drinks & Desserts | Soya Bean Milk | `soya-bean.jpg` | ☐ | |
| 23 | Wong's Drinks & Desserts | Barley Water | `barley.jpg` | ☐ | |
| 24 | Wong's Drinks & Desserts | Ice Kacang | `ice-kacang.jpg` | ☐ | |
| 25 | Hakim's Western Grill | Chicken Chop with Fries | `chicken-chop.jpg` | ☐ | |
| 26 | Hakim's Western Grill | Fish & Chips | `fish-and-chips.jpg` | ☐ | |
| 27 | Hakim's Western Grill | Spaghetti Bolognese | `spaghetti-bolognese.jpg` | ☐ | |
| 28 | Hakim's Western Grill | Chicken Nuggets & Fries | `chicken-nuggets.jpg` | ☐ | |
| 29 | Hakim's Western Grill | Grilled Chicken with Mashed Potato | `grilled-chicken.jpg` | ☐ | |
| 30 | Hakim's Western Grill | Mac & Cheese | `mac-and-cheese.jpg` | ☐ | |

Checked against the live database on 2026-11-06. If a dish is added or renamed, re-check with:

```sql
SELECT item_id, name, default_image_url FROM menu_items ORDER BY stall_id, item_id;
```

## Other images that are broken for the same reason

| Path the app asks for | Owner | Fix |
|---|---|---|
| `/images/stalls/placeholder.svg` (old stall cover fallback) | Raghav | Not restored. `GET /api/stalls` now returns `coverImageUrl: null` when a stall has no cover, and each screen shows its own empty state (Home already shows 🍽️) |
| `/uploads/photos/demo-1.jpg` … `demo-4.jpg` (`photos.image_url`) | Gabriel | Files don't exist, and nothing serves `/uploads`: Express has no static route, and the Vite proxy only forwards `/api`. Gabriel to decide where uploads are stored and served |
