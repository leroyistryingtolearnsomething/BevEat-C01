// Form checks shared by the pages. The backend must check again: these only help the user.
export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
export const isSgMobile = (s) => /^[89]\d{7}$/.test(s.replace(/\s/g, ""));
export const isPassword = (s) => s.length >= 8 && /\d/.test(s);
export const isUsername = (s) => /^[a-z0-9_]{3,20}$/i.test(s);
export const isPin = (s) => /^\d{4}$/.test(s);

// Puts the cursor in the first wrong field (field keys match the input ids)
export function focusFirst(errors) {
  document.getElementById(Object.keys(errors)[0])?.focus();
}

// Each returns { field: message } for the fields that are wrong; empty object means OK
export function loginErrors({ email, password }) {
  const e = {};
  if (!isEmail(email)) e.email = "Enter your email, like name@example.com.";
  if (!password) e.password = "Enter your password.";
  return e;
}

export function signupErrors({ name, mobile, email, password, agreed }) {
  const e = {};
  if (!name.trim()) e.name = "Enter your name.";
  if (!isSgMobile(mobile)) e.mobile = "Enter an 8-digit Singapore mobile number starting with 8 or 9.";
  if (!isEmail(email)) e.email = "Enter your email, like name@example.com.";
  if (!isPassword(password)) e.password = "Use 8 or more characters with at least one number.";
  if (!agreed) e.agreed = "Tick the box to agree before creating your account.";
  return e;
}

export function childErrors({ displayName, username, pin }) {
  const e = {};
  if (!displayName.trim()) e.displayName = "Enter your child's name.";
  if (!isUsername(username)) e.username = "Use 3 to 20 letters, numbers or _ (no spaces).";
  if (!isPin(pin)) e.pin = "The secret code must be exactly 4 numbers.";
  return e;
}
