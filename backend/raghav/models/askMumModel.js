// MOCK: replace when Leslie creates ask_mum_requests (docs/schema-requests.md #9).
// Same function names and row shapes (snake_case, like pg rows) as the real model will have,
// so only this file changes when the table exists. Rows live in memory and are lost on restart.
//
// The real table's unique index allows ONE request per child, per dish, per Singapore day,
// whatever Mum answered. create() below copies that rule, including Postgres's error code.

const requests = [];
let nextId = 1;

// "YYYY-MM-DD" for the current day in Singapore (en-CA formats dates that way).
// Same idea as the column default: (now() AT TIME ZONE 'Asia/Singapore')::date
function singaporeToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(now);
}

// Copies, so a caller can't change the stored row by accident
const copy = (row) => (row ? { ...row } : undefined);

async function findToday(childId, itemId) {
  const today = singaporeToday();
  return copy(requests.find((r) => r.child_id === childId && r.item_id === itemId && r.request_date === today));
}

async function create(childId, itemId) {
  if (await findToday(childId, itemId)) {
    const err = new Error("duplicate key value violates unique constraint \"ask_mum_one_per_day\"");
    err.code = "23505"; // what pg throws, so the controller's handling works unchanged later
    throw err;
  }
  const row = {
    request_id: nextId++,
    child_id: childId,
    item_id: itemId,
    status: "pending",
    request_date: singaporeToday(),
    created_at: new Date(),
    decided_at: null,
  };
  requests.push(row);
  return copy(row);
}

// Dishes Mum said yes to TODAY. Yesterday's yes doesn't count ("just this once").
async function approvedItemIdsToday(childId) {
  const today = singaporeToday();
  return requests
    .filter((r) => r.child_id === childId && r.status === "approved" && r.request_date === today)
    .map((r) => r.item_id);
}

// ---- Test helpers only: stand-ins for Leroy's parent-side approve/deny (§2f) ----

function mockDecide(requestId, status) {
  const row = requests.find((r) => r.request_id === requestId);
  if (row) Object.assign(row, { status, decided_at: new Date() });
}

function mockSetDate(requestId, requestDate) {
  const row = requests.find((r) => r.request_id === requestId);
  if (row) row.request_date = requestDate;
}

function mockReset() {
  requests.length = 0;
  nextId = 1;
}

module.exports = { findToday, create, approvedItemIdsToday, singaporeToday, mockDecide, mockSetDate, mockReset };
