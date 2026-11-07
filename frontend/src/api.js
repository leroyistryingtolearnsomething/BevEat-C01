// Calls to the Express backend (see backend/README.md for the route table)
import { clearSession, getSession } from "./session.js";

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
  // token expired or bad: forget it and go back to the log in page
  // (if 2 calls fail at once only the first one does this)
  const s = getSession();
  if (res.status === 401 && token && s) {
    clearSession();
    window.location.replace(s.role === "child" ? "/kid/login" : "/parent/login");
  }
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

// "See all" for Today's yummiest pics: { pics: [stall-menu dish cards] }
export const getAllPics = (token) => request("/home/pics", { token });
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

// code = the kid's 4 digit pickup code
export const markOrderCollected = (token, orderId, code) =>
  request(`/orders/${orderId}/collected`, { method: "PUT", body: { code }, token });

// Live in the backend: stall menu, food detail and Ask Mum (Raghav). Each dish's status is decided by the server.
export const getStallMenu = (token, stallId, view = "safe") =>
  request(`/stalls/${encodeURIComponent(stallId)}/menu?view=${view}`, { token });

export const getDish = (token, itemId) => request(`/menu-items/${encodeURIComponent(itemId)}`, { token });

export const askMum = (token, itemId) => request("/ask-mum", { method: "POST", body: { itemId }, token });

export const getAskMum = (token, itemId) => request(`/ask-mum/${encodeURIComponent(itemId)}`, { token });

// Live in the backend: parent macros + order history (Leslie, CB69-50). date / start look like "2026-11-06"
export const getMacrosDay = (token, childId, date) =>
  request(`/children/${childId}/macros/day${date ? `?date=${date}` : ""}`, { token });

export const getMacrosWeek = (token, childId, start) =>
  request(`/children/${childId}/macros/week${start ? `?start=${start}` : ""}`, { token });

// range: "this_week" | "last_week" | "this_month"
export const getChildOrders = (token, childId, range = "this_week") =>
  request(`/children/${childId}/orders?range=${range}`, { token });
