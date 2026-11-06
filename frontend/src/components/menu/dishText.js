// Kid-friendly words for a locked dish, shared by the menu cards and the locked screens

// ["Peanuts", "Shellfish"] -> "peanuts and shellfish"; 3+ -> "peanuts, egg and shellfish"
export function joinNames(names, lower = true) {
  const list = names.map((n) => (lower ? n.toLowerCase() : n));
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

// Pink note on an allergy-locked card, e.g. "Shellfish!" or "Peanuts + Shellfish!"
export function allergyNote(dish) {
  if (dish.reason === "unknown_allergens") return "Not checked yet!";
  return `${dish.blockedAllergens.map((a) => a.name).join(" + ")}!`;
}

// Screen-reader label for a whole card, so the lock is announced, not just seen
export function cardLabel(dish) {
  if (dish.status === "blocked_allergy") {
    return dish.reason === "unknown_allergens"
      ? `${dish.name}, locked: allergens not checked yet`
      : `${dish.name}, locked: contains ${joinNames(dish.blockedAllergens.map((a) => a.name))}`;
  }
  if (dish.status === "blocked_parent") return `${dish.name}, locked: Mum says no`;
  if (dish.overBudget) return `${dish.name}, not enough money today`;
  return dish.name;
}
