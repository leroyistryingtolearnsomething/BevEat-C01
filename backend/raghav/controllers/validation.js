// Input checks shared by my controllers. Checking what the client sent is the controller's job
// in our team pattern, so these live next to the controllers that use them.

// "5" -> 5. Anything that isn't a whole number above 0 ("abc", "0", "-1", "1.5") -> null.
// Used for URL params, which always arrive as strings.
function toId(value) {
  if (typeof value !== "string") return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// For JSON bodies: the id must already be a number. "5" is rejected, so the app has to send the
// right type, and a value like true or [] can never be turned into a number by accident.
function isId(value) {
  return Number.isInteger(value) && value > 0;
}

// ---------- tray (POST /api/tray/quote, and Leroy's POST /api/checkout) ----------

const MAX_TRAY_LINES = 20;
const MAX_QUANTITY = 10;

// A plain { ... } object: not null, not an array, not a string
const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

// What's wrong with one tray line, or null if it's fine. `n` is the 1-based line number, so the
// message points at the right line.
function trayLineError(line, n) {
  if (!isPlainObject(line)) return `Line ${n} must be an object`;
  if (!isId(line.itemId)) return `Line ${n}: itemId must be a positive whole number`;
  // Number.isInteger also rejects "2" (a string), 1.5, NaN and Infinity
  if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY)
    return `Line ${n}: quantity must be a whole number from 1 to ${MAX_QUANTITY}`;
  if (!Array.isArray(line.addOnIds) || !line.addOnIds.every(isId))
    return `Line ${n}: addOnIds must be a list of add-on ids`;
  // The same add-on twice would charge for it twice, so it's a broken request, not "2 eggs"
  if (new Set(line.addOnIds).size !== line.addOnIds.length) return `Line ${n}: the same add-on is listed twice`;
  return null;
}

// body { items: [{ itemId, quantity, addOnIds }] } -> { items } (a clean copy) or { error }.
// Only the three known fields are copied. Anything else the client sends, like a price or a
// total, is dropped here, so it can't reach the pricing code even by mistake.
function parseTrayItems(body) {
  const items = isPlainObject(body) ? body.items : undefined;
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_TRAY_LINES)
    return { error: `items must be a list of 1 to ${MAX_TRAY_LINES} dishes` };

  for (let i = 0; i < items.length; i++) {
    const error = trayLineError(items[i], i + 1);
    if (error) return { error };
  }
  return {
    items: items.map(({ itemId, quantity, addOnIds }) => ({ itemId, quantity, addOnIds: [...addOnIds] })),
  };
}

// ---------- Ask Mum note (POST /api/ask-mum) ----------

// The same limit as the CHECK on ask_mum_requests.child_note (docs/schema-requests.md #11)
const MAX_NOTE_CHARS = 100;

// Control characters: newlines, tabs, NUL, bell and the like (C0, DEL and C1). A one-line note
// for Mum never needs them, and they can break how the parent screen lays it out.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

// The kid's optional note -> { note } (a trimmed string, or null for "no note") or { error }.
// Characters are counted with [...note] so an emoji like 🍕 counts as 1, the same way Postgres's
// char_length does. ("🍕".length is 2 in JavaScript.)
function parseAskMumNote(value) {
  if (value === undefined || value === null) return { note: null };
  if (typeof value !== "string") return { error: "note must be text" };
  if (CONTROL_CHARS.test(value)) return { error: "note can't have line breaks or special characters" };
  const note = value.trim();
  if (note === "") return { note: null };
  if ([...note].length > MAX_NOTE_CHARS) return { error: `note can be at most ${MAX_NOTE_CHARS} characters` };
  return { note };
}

module.exports = { toId, isId, parseTrayItems, parseAskMumNote, MAX_TRAY_LINES, MAX_QUANTITY, MAX_NOTE_CHARS };
