// Calls to the Express backend (see backend/README.md for the route table)
import { clearSession, getSession } from "./session.js";

const BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  // body = the whole JSON error reply, for errors that carry more than a message
  // (e.g. the tray's 409 lists which dishes can't be ordered)
  constructor(status, message, body = {}) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = "GET", body, token } = {}) {
  let res;
  // a file upload (FormData) is sent as-is: the browser sets its own Content-Type with the file boundary
  const isForm = body instanceof FormData;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: {
        ...(!isForm && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: isForm ? body : body && JSON.stringify(body),
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
  if (!res.ok) throw new ApiError(res.status, data.error || "Something went wrong. Please try again.", data);
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
// Snap your food: the kid's recent dishes they can take a photo of
export const getMyDishes = (token) => request("/photos/my-dishes", { token });
// Snap your food: send the photo (a JPEG Blob) + which dish/order it is. Returns { photo: { photo, imageUrl, aiStatus } }
export function uploadPhoto(token, photo, itemId, orderId) {
  const form = new FormData();          // like a form with a file field, the backend's multer reads it
  form.append("photo", photo, "snap.jpg");
  form.append("itemId", itemId);
  form.append("orderId", orderId);
  return request("/photos", { method: "POST", body: form, token });
}
// Retake: delete the kid's own photo (the row and the picture file)
export const deletePhoto = (token, photoId) => request(`/photos/${photoId}`, { method: "DELETE", token });
// All pics of one dish (most hearts first): { photos: [{ photo, imageUrl, hearts, likedByMe, uploaderUsername, mine }] }
export const getDishPhotos = (token, itemId) => request(`/dishes/${itemId}/photos`, { token });
// Heart / un-heart a photo: both return { photoId, hearts, likedByMe }
export const votePhoto = (token, photoId) => request(`/photos/${photoId}/vote`, { method: "POST", token });
export const unvotePhoto = (token, photoId) => request(`/photos/${photoId}/vote`, { method: "DELETE", token });
// Live in the backend: change a kid's allergies (keys like "peanut") and daily food money
export const setAllergies = (token, childId, allergens) =>
  request(`/children/${childId}/allergies`, { method: "PUT", body: { allergens }, token });

// Live in the backend: the parent's Menu screen. Every dish with allergyBlocked and locked flags,
// and lock / unlock a dish (the kid's menu then shows it as "Mum says no")
export const getChildMenu = (token, childId) => request(`/children/${childId}/menu`, { token });

export const setDishLocked = (token, childId, itemId, locked) =>
  request(`/children/${childId}/blocked-items/${itemId}`, { method: "PUT", body: { locked }, token });

// Live in the backend: allergies the parent types in themselves (Leslie, migration 005)
// list/add -> { customAllergies: [{ id, label, icon, blockedDishes: ["Dish name", ...] }] }
export const listCustomAllergies = (token, childId) => request(`/children/${childId}/custom-allergies`, { token });

export const addCustomAllergy = (token, childId, label) =>
  request(`/children/${childId}/custom-allergies`, { method: "POST", body: { label }, token });

export const removeCustomAllergy = (token, childId, customAllergyId) =>
  request(`/children/${childId}/custom-allergies/${customAllergyId}`, { method: "DELETE", token });

export const setDailyLimit = (token, childId, dailyLimitCents) =>
  request(`/children/${childId}/daily-limit`, { method: "PUT", body: { dailyLimitCents }, token });

// parent money stuff + PIN reset (Xin Sheng)
export const getSpending = (token, childId, period) =>
  request(`/children/${childId}/spending?period=${period}`, { token });

export const getParentAlerts = (token) => request("/children/alerts", { token });

export const getDayLimits = (token, childId) => request(`/children/${childId}/day-limits`, { token });

// days = { mon: 300, fri: 600 } in cents, null = normal limit
export const setDayLimits = (token, childId, days) =>
  request(`/children/${childId}/day-limits`, { method: "PUT", body: { days }, token });

export const resetChildPin = (token, childId, pin) =>
  request(`/children/${childId}/pin`, { method: "PUT", body: { pin }, token });

// Live in the backend: live queue + order ready ping (Xin Sheng)
export const getOrderQueue = (token, orderId) => request(`/orders/${orderId}/queue`, { token });

export const getStallWait = (token, stallId) => request(`/stalls/${stallId}/wait`, { token });

export const getReadyOrders = (token) => request("/me/ready-orders", { token });

// kid home card: today's orders not picked up yet
export const getMyOrders = (token) => request("/me/orders", { token });

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

// Live in the backend: My tray (Raghav). Sends ids and quantities only; the server prices it.
export const quoteTray = (token, items) => request("/tray/quote", { method: "POST", body: { items }, token });

// Pay for the tray from the wallet. The server prices it again, so only the dishes are sent.
//   -> { orders: [{ orderId, stallId, stallName, queueNumber, total }], total, walletBalance }
export const checkout = (token, items) => request("/checkout", { method: "POST", body: { items }, token });

// Live in the backend: parent macros + order history (Leslie, CB69-50). date / start look like "2026-11-06"
export const getMacrosDay = (token, childId, date) =>
  request(`/children/${childId}/macros/day${date ? `?date=${date}` : ""}`, { token });

export const getMacrosWeek = (token, childId, start) =>
  request(`/children/${childId}/macros/week${start ? `?start=${start}` : ""}`, { token });

// range: "this_week" | "last_week" | "this_month"
export const getChildOrders = (token, childId, range = "this_week") =>
  request(`/children/${childId}/orders?range=${range}`, { token });

// Live in the backend: Ask Mum, parent side + Mum's rules switches (Leslie, CB69-26 / CB69-18)
// pending -> { requests: [{ requestId, childId, childName, itemId, dishName, stallName, price, imageUrl,
//              ruleLabel, status, parentNote, createdAt, decidedAt }] }  (today, all of this parent's kids)
export const getAskMumPending = (token) => request("/ask-mum/pending", { token });

export const getAskMumRequest = (token, requestId) => request(`/ask-mum/requests/${encodeURIComponent(requestId)}`, { token });

// decision = "approved" | "denied", note is optional (max 200 characters)
export const decideAskMum = (token, requestId, decision, note) =>
  request(`/ask-mum/${encodeURIComponent(requestId)}`, { method: "PUT", body: { decision, note }, token });

// -> { noFried, noSugary }
export const getFoodRules = (token, childId) => request(`/children/${childId}/food-rules`, { token });

// rules = { noFried?: boolean, noSugary?: boolean } -> { noFried, noSugary }
export const setFoodRules = (token, childId, rules) =>
  request(`/children/${childId}/food-rules`, { method: "PUT", body: rules, token });
