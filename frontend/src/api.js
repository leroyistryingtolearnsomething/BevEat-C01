// Calls to the Express backend (see backend/README.md for the route table)
const BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, token } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body && JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach KiddyEats right now. Check your internet and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || "Something went wrong. Please try again.");
  return data;
}

// Live in the backend: returns { token, child: { id, username, displayName, avatarEmoji } }
export const childLogin = (username, pin) =>
  request("/auth/child-login", { method: "POST", body: { username, pin } });

// Not in the backend yet. Agreed shapes:
// parent-login  { email, password }               -> { token, parent: { id, name, email } }
// parent-signup { name, mobile, email, password } -> { token, parent: { id, name, email } }
// POST /children { displayName, username, pin, colour, dailyLimitCents, allergens } -> { child }
export const parentLogin = (email, password) =>
  request("/auth/parent-login", { method: "POST", body: { email, password } });

export const parentSignup = (form) =>
  request("/auth/parent-signup", { method: "POST", body: form });

export const addChild = (token, child) =>
  request("/children", { method: "POST", body: child, token });
