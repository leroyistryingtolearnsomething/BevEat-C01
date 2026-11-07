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

// Returns a NEW array (React state must not be changed in place). Adding the same dish with the
// same extras again just raises its quantity, capped at MAX_QTY.
export function addLine(lines, line) {
  const existing = lines.find((l) => sameLine(l, line));
  if (!existing) return [...lines, { ...line, quantity: Math.min(line.quantity, MAX_QTY) }];
  return lines.map((l) => (l === existing ? { ...l, quantity: Math.min(l.quantity + line.quantity, MAX_QTY) } : l));
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
