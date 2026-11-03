// Logged-in user, kept in localStorage: { token, role: "parent" | "child", name }
const KEY = "kiddyeats.session";

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export const homeFor = (role) => (role === "child" ? "/kid/home" : "/parent/home");
