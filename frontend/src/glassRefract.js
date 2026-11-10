// Real Liquid Glass refraction for the web: an SVG displacement map (the bezel bends what is behind the glass)
// used as a backdrop-filter. Only Chromium accepts SVG filters in backdrop-filter, so other browsers keep the
// plain blur + highlight look from glass.css. Values follow Apple's iOS 26 Figma kit: bezel depth 16, refraction 1,
// light from 315 degrees. Method: kube.io/blog/liquid-glass-css-svg (convex-squircle bezel, map encoded as R=x, G=y).
const NS = "http://www.w3.org/2000/svg";
const cache = new Map();
let holder = null;

export const supportsRefraction = () =>
  typeof navigator !== "undefined" && !!navigator.userAgentData?.brands?.some((b) => /Chromium/.test(b.brand));

// signed distance from a point to a rounded rectangle centred on the origin (negative inside)
function sdRoundBox(px, py, hw, hh, r) {
  const qx = Math.abs(px) - (hw - r);
  const qy = Math.abs(py) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

// 0..1 across the bezel (0 = outer edge) -> glass height, convex squircle
const height = (x) => Math.pow(1 - Math.pow(1 - x, 4), 0.25);

function buildMap(w, h, radius, depth) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(w, h);
  const hw = w / 2, hh = h / 2, r = Math.min(radius, hw, hh), e = 0.5;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - hw, py = y + 0.5 - hh;
      const d = -sdRoundBox(px, py, hw, hh, r); // distance in from the edge
      let ox = 0, oy = 0;
      if (d >= 0 && d < depth) {
        const t = d / depth;
        const m = 1 - height(t); // bends hardest at the very edge, none at the flat middle
        // inward normal from the distance field
        const gx = sdRoundBox(px + e, py, hw, hh, r) - sdRoundBox(px - e, py, hw, hh, r);
        const gy = sdRoundBox(px, py + e, hw, hh, r) - sdRoundBox(px, py - e, hw, hh, r);
        const len = Math.hypot(gx, gy) || 1;
        ox = (gx / len) * m; // sample from outside the edge: the rim squeezes the background
        oy = (gy / len) * m;
      }
      const i = (y * w + x) * 4;
      img.data[i] = 128 + ox * 127;
      img.data[i + 1] = 128 + oy * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

// returns "url(#id)" for a glass of this size, or "" where refraction is not supported
export function refractFilter(w, h, radius = h / 2, depth = 16, strength = 18) {
  if (!supportsRefraction() || w < 8 || h < 8) return "";
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}r${Math.round(radius)}d${depth}s${strength}`;
  if (cache.has(key)) return cache.get(key);
  if (!holder) {
    holder = document.createElementNS(NS, "svg");
    holder.setAttribute("width", "0"); holder.setAttribute("height", "0");
    holder.setAttribute("aria-hidden", "true");
    holder.style.cssText = "position:absolute;pointer-events:none";
    document.body.appendChild(holder);
  }
  const id = `glass-${cache.size}`;
  const f = document.createElementNS(NS, "filter");
  f.setAttribute("id", id);
  f.setAttribute("color-interpolation-filters", "sRGB");
  f.setAttribute("filterUnits", "userSpaceOnUse");
  f.setAttribute("x", "0"); f.setAttribute("y", "0"); f.setAttribute("width", w); f.setAttribute("height", h);
  const fi = document.createElementNS(NS, "feImage");
  fi.setAttribute("href", buildMap(w, h, radius, depth));
  fi.setAttribute("x", "0"); fi.setAttribute("y", "0"); fi.setAttribute("width", w); fi.setAttribute("height", h);
  fi.setAttribute("preserveAspectRatio", "none");
  fi.setAttribute("result", "map");
  const dm = document.createElementNS(NS, "feDisplacementMap");
  dm.setAttribute("in", "SourceGraphic"); dm.setAttribute("in2", "map");
  dm.setAttribute("scale", String(strength * 2)); // the map spans -127..127, so scale is total travel in px
  dm.setAttribute("xChannelSelector", "R"); dm.setAttribute("yChannelSelector", "G");
  f.append(fi, dm);
  holder.appendChild(f);
  const url = `url(#${id})`;
  cache.set(key, url);
  return url;
}
