import { useState } from "react";

// Shown when a dish has no photo, or its file is missing (docs/dish-photos.md)
export const PLACEHOLDER_DISH = "/images/menu/placeholder-dish.svg";

// A dish picture that never shows as broken: if the file can't load, swap in the placeholder.
// It remembers WHICH url failed, so a new photo for the same card is still tried, and if the
// placeholder itself failed nothing would loop (the state doesn't change a second time).
export default function DishPhoto({ src, name, className }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const url = !src || failedSrc === src ? PLACEHOLDER_DISH : src;
  return <img className={className} src={url} alt={`Photo of ${name}`} onError={() => setFailedSrc(src)} loading="lazy" />;
}
