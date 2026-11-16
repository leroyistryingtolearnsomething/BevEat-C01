// Mum's changes on an Ask Mum "yes" (CB69-74, Figma 09e / 09f / 09g).
// One list for food, one for drinks. The parent screen gets the right list from the API,
// so the chips only live here.
const FOOD_CHANGES = ["Less salt", "Less oil", "No chilli", "No bean sprouts", "More veg", "Smaller portion"];
const DRINK_CHANGES = ["Less ice", "No ice", "Less sugar", "No sugar (kosong)", "Hot instead"];

// Drinks stall (stalls.cuisine = 'Drinks') gets the drink chips, every other stall the food chips
const kindFor = (cuisine) => (String(cuisine || "").toLowerCase() === "drinks" ? "drink" : "food");
const optionsFor = (kind) => (kind === "drink" ? DRINK_CHANGES : FOOD_CHANGES);

// Picks that don't make sense together: keep the last one tapped wins on the screen,
// and refuse both here so a bad request can't print "Less ice, No ice" on the ticket
const CLASHES = [["Less ice", "No ice"], ["Less sugar", "No sugar (kosong)"], ["Less ice", "Hot instead"], ["No ice", "Hot instead"]];

// changes from the request body -> { changes: string[] } or { error }
function cleanChanges(changes, kind) {
  if (changes === undefined || changes === null) return { changes: [] };
  if (!Array.isArray(changes) || changes.some((c) => typeof c !== "string"))
    return { error: "changes must be a list of options" };
  const allowed = optionsFor(kind);
  const unknown = changes.find((c) => !allowed.includes(c));
  if (unknown) return { error: `"${unknown}" isn't an option for this ${kind}` };
  const unique = allowed.filter((c) => changes.includes(c)); // same order as the chips, no repeats
  const clash = CLASHES.find(([a, b]) => unique.includes(a) && unique.includes(b));
  if (clash) return { error: `Pick either "${clash[0]}" or "${clash[1]}"` };
  return { changes: unique };
}

// What gets printed on the stall's order ticket (order_items.comment), or null if nothing.
// Only the chips go on it. Mum's free-text note is for her kid ("Eat some veg tonight"), not the stall.
function ticketText(changes) {
  return changes && changes.length ? `Mum asks: ${changes.join(", ")}` : null;
}

module.exports = { FOOD_CHANGES, DRINK_CHANGES, kindFor, optionsFor, cleanChanges, ticketText };
