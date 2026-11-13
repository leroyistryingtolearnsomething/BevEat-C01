import { useLayoutEffect, useRef } from "react";

// FLIP for a list: when `changeKey` changes, every child that stayed (matched by its data-flip) slides from where it was
// to where it is now, so a removed row closes the gap instead of everything jumping up. Only transform moves.
// Children that are new simply appear (they have their own entrance); respects reduced motion.
export default function useFlip(listRef, changeKey) {
  const tops = useRef(new Map());
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const next = new Map();
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    for (const el of list.children) {
      const key = el.dataset.flip;
      if (!key) continue;
      const top = el.getBoundingClientRect().top;
      next.set(key, top);
      const before = tops.current.get(key);
      if (!still && before != null && Math.abs(before - top) > 1) {
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: "none" }], { duration: 240, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });
      }
    }
    tops.current = next;
  }, [listRef, changeKey]);
}
