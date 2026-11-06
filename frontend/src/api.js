// Calls to the Express backend (see backend/README.md for the route table)
import { clearSession } from "./session.js";

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
  // token expired or bad: forget it (the page decides where to send the user)
  if (res.status === 401 && token) clearSession();
  if (!res.ok) throw new ApiError(res.status, data.error || "Something went wrong. Please try again.");
  return data;
}

// Live in the backend: returns { token, child: { id, username, displayName, avatarEmoji } }
export const childLogin = (username, pin) =>
  request("/auth/child-login", { method: "POST", body: { username, pin } });

// Live in the backend: { email, password } -> { token, parent: { id, name, email } }
// Live in the backend: parent-signup { name, mobile, email, password } -> { token, parent: { id, name, email } }
// Live in the backend: POST /children { displayName, username, pin, dailyLimitCents, allergens } -> { child }
// (colour is sent but not saved yet: no column for it)
export const parentLogin = (email, password) =>
  request("/auth/parent-login", { method: "POST", body: { email, password } });

export const parentSignup = (form) =>
  request("/auth/parent-signup", { method: "POST", body: form });

export const addChild = (token, child) =>
  request("/children", { method: "POST", body: child, token });

// Live in the backend: NETS QR top-ups (parent). Kids + wallets, make a QR, then check if it's paid
export const listChildren = (token) => request("/children", { token });

export const createTopUp = (token, childId, amount) =>
  request(`/children/${childId}/top-ups`, { method: "POST", body: { amount }, token });

export const getTopUp = (token, topUpId) => request(`/top-ups/${topUpId}`, { token });

export const getHome = (token) => request("/home", { token });
// Live in the backend: change a kid's allergies (keys like "peanut") and daily food money
export const setAllergies = (token, childId, allergens) =>
  request(`/children/${childId}/allergies`, { method: "PUT", body: { allergens }, token });

export const setDailyLimit = (token, childId, dailyLimitCents) =>
  request(`/children/${childId}/daily-limit`, { method: "PUT", body: { dailyLimitCents }, token });

// Live in the backend: live queue + order ready ping (Xin Sheng)
export const getOrderQueue = (token, orderId) => request(`/orders/${orderId}/queue`, { token });

export const getStallWait = (token, stallId) => request(`/stalls/${stallId}/wait`, { token });

export const getReadyOrders = (token) => request("/me/ready-orders", { token });

export const getStallOrders = (token) => request("/stall/orders", { token });

export const markOrderReady = (token, orderId) =>
  request(`/orders/${orderId}/ready`, { method: "PUT", token });

export const markOrderCollected = (token, orderId) =>
  request(`/orders/${orderId}/collected`, { method: "PUT", token });
