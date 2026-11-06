// Logged-in user, kept in localStorage: { token, role: "parent" | "child", name }
const KEY = "kiddyeats.session";

// login token is a JWT, the "exp" in the middle part is when it runs out (8h for kids)
export function isExpired(token) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(part));
    return !exp || exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function getSession() {
  let s;
  try {
    s = JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
  // expired token: remove it so the user has to log in again
  if (s && isExpired(s.token)) {
    clearSession();
    return null;
  }
  return s;
}

export function saveSession(session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export const homeFor = (role) => (role === "child" ? "/kid/home" : "/parent/home");
