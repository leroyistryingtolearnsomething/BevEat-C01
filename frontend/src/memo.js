// What a page last loaded, kept for the tab's lifetime. A page opens with it straight away (then refreshes), so going
// back to a screen shows it at once instead of "Loading…", which is what lets a transition land on real content.
const seen = new Map();
export const recall = (key) => seen.get(key) ?? null;
export const remember = (key, value) => { seen.set(key, value); return value; };
