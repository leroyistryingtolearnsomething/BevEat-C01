// spending report filter: keep only the days the parent picked, then add them up again
export const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const round2 = (n) => Math.round(n * 100) / 100;

// from / to are "YYYY-MM-DD" (same as d.date) so normal string compare works
export function filterDays(days, { from, to, weekdays = WEEK } = {}) {
  return days.filter((d) => (!from || d.date >= from) && (!to || d.date <= to) && weekdays.includes(d.day));
}

// same numbers the API gives, but only for the days left after filtering
export function sumUp(days) {
  const total = round2(days.reduce((sum, d) => sum + d.spent, 0));
  const totalLimit = round2(days.reduce((sum, d) => sum + (d.limit || 0), 0));
  return {
    total,
    averagePerDay: days.length ? round2(total / days.length) : 0,
    usedPct: totalLimit ? Math.round((total / totalLimit) * 100) : 0,
  };
}
