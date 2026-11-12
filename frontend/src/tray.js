// The kid's tray, saved in sessionStorage with one tray per child, so siblings who share a
// tablet never mix up their food. It's emptied when the browser tab closes.
//
// Names and prices are kept ONLY so the screens can show them. They are never trusted: the
// server prices every dish and add-on again from the database before anything is paid.

export const MAX_QTY = 10; // the same limit the server enforces

export const toCents = (amount) => Math.round(Number(amount) * 100);
const cents = toCents;

export const formatSgd = (amountInCents) => `S$${(amountInCents / 100).toFixed(2)}`;

// One portion of a line: the dish plus the extras picked for it
export function unitCents(line) {
  return cents(line.price) + line.addOns.reduce((sum, a) => sum + cents(a.extraPrice), 0);
}

export const lineCents = (line) => unitCents(line) * line.quantity;

export const trayCount = (lines) => lines.reduce((n, l) => n + l.quantity, 0);

// The number on the Home cart badge: null when the tray is empty (no badge at all), and "9+"
// past 9 so a big tray can't stretch the little circle
export function trayBadge(lines) {
  const count = trayCount(lines);
  if (count === 0) return null;
  return count > 9 ? "9+" : String(count);
}

export const trayCents = (lines) => lines.reduce((sum, l) => sum + lineCents(l), 0);

// What the child can still spend once the food already in their tray is counted.
// The server's canSpend (today's limit left, never more than the wallet) can't know about the
// tray, because the tray only lives in this browser, so the screens take it off here.
// This only stops the kid picking more than they can pay for: PR B's POST /api/tray/quote
// re-checks the real total on the server, and checkout checks it again.
export function moneyLeftCents(canSpend, lines) {
  return Math.max(cents(canSpend) - trayCents(lines), 0);
}

// Same dish with the same extras = same line, whatever order the extras were tapped in
const addOnKey = (line) => line.addOns.map((a) => a.id).sort((a, b) => a - b).join(",");
const sameLine = (a, b) => a.itemId === b.itemId && addOnKey(a) === addOnKey(b);

// "1:2,3" = dish 1 with add-ons 2 and 3. A tray line and the server's priced line for it get the
// same key (both have itemId + addOns [{ id }]), so the screen can match them up even while a
// newer quote is still loading and the line numbers have moved.
export const lineKey = (line) => `${line.itemId}:${addOnKey(line)}`;

// Returns a NEW array (React state must not be changed in place). Adding the same dish with the
// same extras again just raises its quantity, capped at MAX_QTY.
export function addLine(lines, line) {
  const existing = lines.find((l) => sameLine(l, line));
  if (!existing) return [...lines, { ...line, quantity: Math.min(line.quantity, MAX_QTY) }];
  return lines.map((l) => (l === existing ? { ...l, quantity: Math.min(l.quantity + line.quantity, MAX_QTY) } : l));
}

// ---------- 06 My tray ----------

// Change one line's quantity. 0 or less takes the line out; more than MAX_QTY stays at MAX_QTY.
export function setQuantity(lines, index, quantity) {
  if (quantity <= 0) return removeLine(lines, index).lines;
  return lines.map((l, i) => (i === index ? { ...l, quantity: Math.min(quantity, MAX_QTY) } : l));
}

// Take a line out, and remember where it was so "Undo" can put it back in the same spot
export function removeLine(lines, index) {
  return { lines: lines.filter((_, i) => i !== index), removed: { line: lines[index], index } };
}

export function restoreLine(lines, removed) {
  const at = Math.min(removed.index, lines.length);
  return [...lines.slice(0, at), removed.line, ...lines.slice(at)];
}

// What POST /api/tray/quote (and Leroy's checkout) gets: ids and quantities ONLY. No names and
// no prices leave the browser, so the server has nothing to "trust" but its own database.
export function toQuoteItems(lines) {
  return lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, addOnIds: l.addOns.map((a) => a.id) }));
}

// Figma row subtitle: chosen extras, then the stall. "Less rice, Add egg · Lim's Chicken Rice"
export function lineSubtitle(line) {
  const extras = line.addOns.map((a) => a.name).join(", ");
  return extras ? `${extras} · ${line.stallName}` : line.stallName;
}

// Tray lines in stall order (each stall's lines together, stalls in the order first added).
// That's the order the server groups them in, and Leroy's checkout makes one order per stall.
// Each entry keeps its index in the saved tray, which the stepper needs to change it.
export function linesInStallOrder(lines) {
  const stallOrder = [...new Set(lines.map((l) => l.stallId))];
  return stallOrder.flatMap((stallId) =>
    lines.map((line, index) => ({ line, index })).filter(({ line }) => line.stallId === stallId)
  );
}

// The server's 409 says which LINE NUMBERS of the tray it was sent are a problem. Turn that
// into lineKey -> problem, so the right rows still show it after the kid removes another line.
export function problemsByKey(sentLines, problems) {
  const map = new Map();
  for (const p of problems) {
    const line = sentLines[p.lineIndex];
    if (line && !map.has(lineKey(line))) map.set(lineKey(line), p);
  }
  return map;
}

// Kid-friendly words for each reason the server can give (docs/api-contracts.md §3c)
export function problemMessage(problem) {
  if (problem.reason === "allergy")
    return problem.addOnId ? `${problem.name} isn't safe for you` : "Not safe for you";
  if (problem.reason === "parent_rule") return "Mum says not today";
  if (problem.reason === "sold_out") return "Sold out now";
  if (problem.reason === "stall_closed") return "This stall just closed";
  return "Can't order this now"; // a reason this app doesn't know yet
}

// ---------- storage ----------

// The child's id comes from their login token, so each child gets their own tray
function childIdFrom(token) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part)).id;
  } catch {
    return null;
  }
}

const keyFor = (token) => `kiddyeats.tray.${childIdFrom(token)}`;

export function loadTray(token) {
  try {
    const lines = JSON.parse(sessionStorage.getItem(keyFor(token)));
    return Array.isArray(lines) ? lines : [];
  } catch {
    return []; // storage blocked or broken: start with an empty tray rather than crash
  }
}

export function saveTray(token, lines) {
  try {
    sessionStorage.setItem(keyFor(token), JSON.stringify(lines));
  } catch {
    // storage blocked (e.g. private mode): the tray just won't survive a reload
  }
}
