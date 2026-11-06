// Stall discovery: list stalls (filter by cuisine / halal) and get one stall
const Stall = require("../models/stallModel");

// stalls.cuisine is free text in the DB, so the API decides which values are valid.
// A whitelist also means odd input (e.g. SQL injection attempts) is rejected before any query runs.
const ALLOWED_CUISINES = ["Chinese", "Malay", "Indian", "Western", "Drinks"];

// Every stall's cover_image_url is NULL for now, so the app always gets an image to show
const PLACEHOLDER_COVER = "/images/stalls/placeholder.svg";

// "malay" -> "Malay"; returns undefined for anything not on the list
function matchCuisine(input) {
  return ALLOWED_CUISINES.find((c) => c.toLowerCase() === input.trim().toLowerCase());
}

// DB row (snake_case) -> API shape (camelCase, same as the rest of the team's API)
function toStallJson(row) {
  return {
    id: row.stall_id,
    name: row.name,
    unitNo: row.unit_no,
    cuisine: row.cuisine,
    isHalal: row.is_halal,
    description: row.description,
    yearStarted: row.year_started,
    isOpen: row.is_open,
    prepMinutes: row.avg_prep_minutes,
    coverImageUrl: row.cover_image_url || PLACEHOLDER_COVER,
  };
}

// GET /api/stalls?cuisine=Malay&halal=true  (both optional)
async function listStalls(req, res, next) {
  const { cuisine, halal } = req.query;

  // typeof check also rejects ?cuisine=a&cuisine=b, which Express turns into an array
  let cuisineFilter = null;
  if (cuisine !== undefined) {
    cuisineFilter = typeof cuisine === "string" ? matchCuisine(cuisine) : undefined;
    if (!cuisineFilter)
      return res
        .status(400)
        .json({ error: `Unknown cuisine. Use one of: ${ALLOWED_CUISINES.join(", ")}` });
  }

  // Only "true" is allowed: the halal toggle is either on (filter) or off (leave it out).
  // Accepting "false" would raise the question "non-halal only, or everything?"
  let halalOnly = null;
  if (halal !== undefined) {
    if (halal !== "true") return res.status(400).json({ error: "halal can only be true" });
    halalOnly = true;
  }

  try {
    const rows = await Stall.listStalls(cuisineFilter, halalOnly);
    res.json({ stalls: rows.map(toStallJson) }); // no match = empty array, still 200
  } catch (err) {
    next(err);
  }
}

// GET /api/stalls/:id
async function getStall(req, res, next) {
  // Number("abc") is NaN, Number("1.5") is not an integer: both are bad ids
  const stallId = Number(req.params.id);
  if (!Number.isInteger(stallId) || stallId <= 0)
    return res.status(400).json({ error: "Invalid stall id" });

  try {
    const row = await Stall.getStallById(stallId);
    if (!row) return res.status(404).json({ error: "Stall not found" });
    res.json({ stall: toStallJson(row) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listStalls, getStall };
