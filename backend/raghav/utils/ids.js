// "5" -> 5. Anything that isn't a whole number above 0 ("abc", "0", "-1", "1.5") -> null.
// Used for URL params, which always arrive as strings.
function toId(value) {
  if (typeof value !== "string") return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// For JSON bodies: the id must already be a number. "5" is rejected, so the app has to send the
// right type, and a value like true or [] can never be turned into a number by accident.
function isId(value) {
  return Number.isInteger(value) && value > 0;
}

module.exports = { toId, isId };
