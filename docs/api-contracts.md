# API contracts: stall menu, food detail and tray (Raghav)

**Status: PROPOSED, 2026-11-06.** These are the shapes Raghav's screens (Kids Figma 03 Stall menu, 04 Food detail, 05 Oops allergy, 05b Mum says not today, 06 My tray) need from teammates, plus the endpoints Raghav provides for others. Until a teammate's piece exists, Raghav's code calls a clearly marked mock with exactly this shape:
`// MOCK: replace when <name>'s endpoint is ready`.

All JSON uses camelCase. Money is a JS number in dollars with 2 decimal places (e.g. `3.5` = S$3.50). Errors are always `{ "error": "message" }`.

---

## 1. Frontend URLs (for linking)

| Screen | URL | Who links to it |
|---|---|---|
| 03 Stall menu | `/kid/stalls/:stallId` | **Gabriel**: each "Stalls near you" card on Home |
| 04 Food detail (shows 05 or 05b instead if the dish is locked for this child) | `/kid/dishes/:itemId` | Stall menu cards; Gabriel's "Today's yummiest pics" cards (optional) |
| 06 My tray | `/kid/tray` | Footer button on 03 |
| 15 All pics for a dish (Gabriel) | `/kid/dishes/:itemId/pics` | "See all N pics" button on 04 |

Only `child` sessions can open these pages; the API re-checks the role.

---

## 2. What Raghav needs from teammates

### 2a. Child's allergies: Xin Sheng (allergy profile)

Server-side function (not HTTP), called with the logged-in child's id:

```js
getChildAllergies(childId) -> Promise<Array<{ allergenId: number, name: string, icon: string, severity: "avoid" | "severe" }>>
```

- An empty array means "this child has no allergies".
- It must **throw** if the profile can't be loaded. Raghav's menu then returns a 500 and shows no dishes at all (fail closed). It must never return `[]` on an error.
- **Today:** no shared function exists. Raghav reads `child_allergies` through Gabriel's existing `backend/gabriel/models/homeModel.js → getRules(childId)` (read-only reuse, no edits). Note: the endpoints that *write* allergies (`PUT /api/children/:childId/allergies`) currently live in `backend/leroy/`.

### 2b. Parent food rules ("Mum says no"): Leroy

Server-side function:

```js
getFoodRules(childId) -> Promise<Array<
  | { type: "no_fried",     label: "No fried food" }
  | { type: "blocked_item", itemId: number, label: string }
>>
```

- Used for the `blocked_parent` status and the 05b copy: *"{Dish} is fried, and Mum picked "No fried food" for school days."*
- **Today:** no table, model or endpoint exists. See `docs/schema-requests.md` #7 and #8.
  `// MOCK: replace when Leroy's getFoodRules is ready`, which returns `[]`, so no dish shows "Mum says no" until the real rules exist.

### 2c. Money left today: Xin Sheng (daily spending limit)

Server-side function:

```js
getMoneyToday(childId) -> Promise<{ dailyLimit: number, spentToday: number, leftToday: number, walletBalance: number }>
```

- `leftToday = max(dailyLimit - spentToday, 0)`, with the day counted in Asia/Singapore time and cancelled orders left out (the same rule as Home).
- What the child can spend right now = `min(leftToday, walletBalance)`. The menu marks dishes above this as `overBudget` (Safety rule 4).
- **Today:** Raghav reuses Gabriel's `homeModel.getChildSummary` + `homeModel.getSpentToday` (read-only), which already compute this for Home.

### 2d. Dish photos and hearts: Gabriel

Server-side function, one call per screen (not one per dish):

```js
getTopPhotos(itemIds: number[], viewerId: number) -> Promise<Map<itemId, {
  photoId: number,
  imageUrl: string,
  hearts: number,          // photo_votes on this photo
  likedByMe: boolean,      // viewer has hearted it (HeartVote button on 04)
  uploaderUsername: string,// "Pic by @kai_snaps"
  totalPics: number        // "See all 12 pics": approved pics for the dish
}>>
```

- Rule: top photo = `ai_status = 'passed'` AND `approval_status IN ('approved','not_needed')`, most votes, newest first on a tie (the same rule as Home's `getTopPics`). **Gabriel, please confirm.**
- A dish with no entry in the map uses `menu_items.default_image_url`, and the frontend falls back to a placeholder if that file fails to load.
- HTTP endpoints the 04 heart button calls (Gabriel):
  - `POST /api/photos/:photoId/vote` → `{ photoId, hearts, likedByMe: true }`
  - `DELETE /api/photos/:photoId/vote` → `{ photoId, hearts, likedByMe: false }`
- **Today:** `// MOCK: replace when Gabriel's getTopPhotos is ready`. This is a read-only query that uses the rule above. The heart button is shown but disabled until the vote endpoint exists.

**Gabriel, about "N safe picks for you" on Home:** today's `getStalls` counts a dish with **no allergen rows** as safe, and ignores Mum's rules. The menu fails closed on those dishes, so for an allergic child the two numbers can differ (e.g. Wong's Drinks: Home says 5, the menu "Safe for me" shows 3). Proposal: Home calls Raghav's exported `countSafeDishesByStall(childId)` (same rules as the menu) so the number on the card always matches what the child sees.

### 2e. Pay with my wallet: Leroy

HTTP endpoint the 06 footer button calls:

```
POST /api/checkout            (child only)
body: { items: [{ itemId: number, quantity: number, addOnIds: number[] }] }
201 → { orders: [{ orderId, stallId, stallName, queueNumber, total }], total, walletBalance }
400 → bad body            409 → dish/add-on no longer allowed, or not enough money
```

- Leroy's controller must **not** trust any price from the client. It calls Raghav's exported service, which re-runs every safety and money check and prices the tray from the database:

  ```js
  priceTray(childId, items) -> Promise<{ lines: [...], total: number, problems: string[] }>   // see 3c
  ```

  Then, in **one transaction**, it inserts `orders` + `order_items` (with `item_name`, `unit_price` and macro snapshots; `comment` stays NULL because there's no comments feature) + `order_item_add_ons` (name/price snapshots), and deducts `wallet_balance`.
- **Decided (2026-11-06): a tray may hold dishes from more than one stall** (the Figma tray does). `orders` holds one stall per order, so checkout creates **one order per stall**, each with its own `queue_number`, all inside **one transaction** together with the single wallet deduction for the whole tray total. If any part fails (e.g. a dish became locked, or not enough money), nothing is saved and the wallet is not touched. The response lists every order so the kid sees one pickup number per stall.
- **Today:** `// MOCK: replace when Leroy's checkout endpoint is ready`. The button calls the mock, which only shows a "coming soon" message. It never writes to the database.

### 2f. Ask Mum: Raghav (kid side) + Leroy (parent side)

**How it works:** on 05b ("Mum says not today") the child taps **Ask Mum**. Raghav's API saves a `pending` row in `ask_mum_requests` (`docs/schema-requests.md` #9). Leroy's parent app shows it, and the parent approves or denies it. An approval makes that one dish `allowed` for that child **for that Singapore day only** ("just this once").

**Safety rules, enforced in Raghav's `dishSafety` and re-checked by `priceTray` at checkout:**
- Ask Mum can only lift a **parent food rule** (`blocked_parent`). A `blocked_allergy` dish stays locked even if a request for it is somehow approved. Raghav's API also refuses to create a request for one.
- Only an approval for **today's** `request_date` counts. An approval from yesterday has no effect.

**Kid endpoints (Raghav):** see §3d and §3e.

**Parent endpoints (Leroy).** These are what the parent app needs. Both are `requireAuth, requireRole("parent")`, and the parent can only see or decide requests for their own children:

```
GET /api/children/:childId/ask-mum?status=pending        (requireOwnChild)
200 → { "requests": [{
          "requestId": 7, "itemId": 5, "dishName": "Mee Goreng", "stallName": "Mariam Nasi Lemak",
          "price": 3.5, "ruleLabel": "No fried food", "createdAt": "2026-11-19T07:05:00Z"
        }] }
        // only today's requests (request_date = today in Asia/Singapore), newest first

PUT /api/ask-mum/:requestId        body: { "decision": "approved" | "denied" }
200 → { "requestId": 7, "status": "approved", "decidedAt": "2026-11-19T07:06:10Z" }
400 → decision is not "approved" or "denied"
404 → no such request, or it belongs to another parent's child (same 404, so ids can't be probed)
409 → already decided, or it's from an earlier day (expired)
```

Leroy's UPDATE must change only a row that is still pending, from today, and belongs to this parent's child, so a double tap or a stale screen can't flip a decision:

```sql
UPDATE ask_mum_requests r
   SET status = $2, decided_at = now()
  FROM child_profiles c
 WHERE r.request_id = $1
   AND r.status = 'pending'
   AND r.request_date = (now() AT TIME ZONE 'Asia/Singapore')::date
   AND c.child_id = r.child_id
   AND c.parent_id = $3
RETURNING r.request_id, r.status, r.decided_at;
```

The "ping" on Mum's phone is the parent app polling the GET above, the same way the kid app polls `/api/me/ready-orders`.

**Today:** the table doesn't exist yet. Raghav's kid endpoints use an in-memory store:
`// MOCK: replace when Leslie creates ask_mum_requests`. It has the same functions and return shapes as the real model, and is emptied when the server restarts. Leroy's food rules are also still a mock that returns `[]` (§2b), so no dish is `blocked_parent` yet and 05b can't be reached from real data. The tests drive 05b and Ask Mum through the mocks.

---

## 3. Endpoints Raghav provides

All require `Authorization: Bearer <token>` with role `child` (a parent gets 403). IDs must be positive integers (otherwise 400).

### 3a. `GET /api/stalls/:stallId/menu?view=safe|all`

`view` defaults to `safe`. With `safe`, locked dishes are **left out of the response completely**. With `all` (the "Everything" chip) they are included, but only as locked cards: no add-ons, and they can't be ordered.

```json
{
  "stall": { "id": 1, "name": "Lim's Chicken Rice", "unitNo": "#01-05", "isOpen": true, "prepMinutes": 4, "coverImageUrl": "..." },
  "money": { "canSpend": 5.0 },
  "counts": { "safe": 6, "total": 7 },
  "dishes": [
    {
      "id": 2, "name": "Roasted Chicken Rice", "price": 3.8,
      "imageUrl": "/uploads/photos/demo-1.jpg", "hearts": 203,
      "badges": ["healthy_pick"],
      "status": "allowed",
      "overBudget": false
    },
    {
      "id": 14, "name": "Dry Wanton Noodles", "price": 3.5, "imageUrl": "...", "hearts": 0, "badges": [],
      "status": "blocked_allergy",
      "blockedAllergens": [{ "name": "Shellfish", "icon": "🦐" }],
      "overBudget": false
    },
    {
      "id": 5, "name": "Mee Goreng", "price": 3.5, "imageUrl": "...", "hearts": 0, "badges": [],
      "status": "blocked_parent",
      "parentRule": { "type": "no_fried", "label": "No fried food" },
      "overBudget": false
    }
  ]
}
```

- `status` is one of `allowed`, `blocked_allergy`, `blocked_parent`. Allergy wins if both apply.
- `blocked_allergy` with `"reason": "unknown_allergens"` (and `blockedAllergens: []`) = the dish has no allergen data and this child has allergies (fail closed).
- `overBudget` is only ever true on `allowed` dishes (price > `money.canSpend`).
- 404 `{ "error": "Stall not found" }`. 500 if allergies can't be loaded (no partial menu).

### 3b. `GET /api/menu-items/:itemId`

```json
{
  "dish": {
    "id": 2, "stallId": 1, "stallName": "Lim's Chicken Rice",
    "name": "Roasted Chicken Rice", "price": 3.8, "description": "...",
    "photo": { "photoId": 1, "imageUrl": "...", "hearts": 203, "likedByMe": false, "uploaderUsername": "kai_snaps", "totalPics": 12 },
    "imageUrl": "...",
    "status": "allowed",
    "overBudget": false,
    "safeChecks": ["No shellfish", "No peanuts", "Not fried"],
    "healthScore": 4,
    "ingredients": ["roast chicken", "chicken rice", "cucumber", "soy sauce"],
    "addOns": [
      { "id": 16, "name": "Less rice", "extraPrice": 0, "allergen": null, "locked": false },
      { "id": 18, "name": "Add hard-boiled egg", "extraPrice": 0.8, "allergen": { "name": "Egg", "icon": "🥚" }, "locked": true, "lockReason": "allergy" }
    ]
  },
  "money": { "canSpend": 5.0 },
  "alternatives": [ /* 0–2 dish cards from the same stall, same shape as 3a, always status "allowed" */ ]
}
```

- `photo` is `null` when there's no approved community photo.
- For a locked dish, `addOns` is `[]`. The frontend then shows 05 or 05b, and `alternatives` fills "Try these yummy picks instead" / "Or try these".
- `healthScore` (0–5), `ingredients` and "Not fried" come back as `null` / `[]` / missing until the columns exist (`docs/schema-requests.md` #3 and #7).

### 3c. `POST /api/tray/quote` (PR B)

The tray screen calls this every time the tray changes. The client never sends prices.

```
body: { "items": [{ "itemId": 2, "quantity": 1, "addOnIds": [16] }] }     // 1–20 lines, quantity 1–10
200 → {
  "lines": [{ "itemId": 2, "name": "Roasted Chicken Rice", "stallName": "Lim's Chicken Rice", "imageUrl": "...",
              "quantity": 1, "unitPrice": 3.8, "addOns": [{ "id": 16, "name": "Less rice", "extraPrice": 0 }], "lineTotal": 3.8 }],
  "total": 3.8,
  "money": { "canSpend": 6.5, "leftAfter": 2.7 },
  "canPay": true
}
400 → invalid body, unknown dish, or an add-on that doesn't belong to that dish
409 → a dish or add-on is now locked for this child   { "error": "...", "itemId": 14 }
```

`canPay` is false (still 200) when `total > money.canSpend`, so the screen can show a kid-friendly "Not enough food money" message.

### 3d. `POST /api/ask-mum` (PR A)

```
body: { "itemId": 5 }
201 → { "requestId": 7, "status": "pending" }        // new request; button shows the Figma "Sent" state
200 → { "requestId": 7, "status": "pending" | "approved" | "denied" }   // already asked about this dish today: the existing request, no new row
400 → itemId is not a positive integer
404 → no such dish
409 → { "error": "Ask Mum can't unlock allergies" }        // dish is blocked_allergy
409 → { "error": "This dish isn't locked" }               // dish is already allowed
```

There is **one request per child per dish per day, whatever the answer** (decided 2026-11-06), so a child can't keep asking after Mum says no. The unique index backs this up, so if two taps race, the second gets the existing request back. The child can ask again tomorrow.

### 3e. `GET /api/ask-mum/:itemId` (PR A)

Today's latest request from this child for this dish, so 05b shows "Sent" again when the kid comes back:

```
200 → { "request": { "requestId": 7, "status": "pending" | "approved" | "denied", "createdAt": "...", "decidedAt": null } }
200 → { "request": null }                            // not asked today
400 → bad itemId
```

On 3a and 3b, a dish unlocked by an approval today has `"status": "allowed"` and `"askMumApproved": true`, so the card can show "Mum said yes!".
