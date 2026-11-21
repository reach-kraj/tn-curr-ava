"use client";

import { useEffect, useRef } from "react";
import type { Map as MlMap } from "maplibre-gl";

/**
 * Drifting clouds anchored to real coordinates, so they pan and tilt with the map.
 *
 * Three kinds, so the sky reads as natural rather than uniform:
 *  - cumulus: big, bright, billowy, with a soft blue-grey underside
 *  - wisp:    thin, light, stretched high-altitude streaks that move faster
 *  - storm:   darker grey rain clouds that sit lower, move slower and cast deeper shadows
 *
 * Motion: a gusting westward breeze, slow sway, puffs that swell and shift, altitude parallax,
 * and fading in/out at the edges of the cloud field. The layer clears between zoom 7 and 9.5.
 */
type Kind = "cumulus" | "wisp" | "storm";
interface Puff { dx: number; dy: number; r: number; phase: number; rate: number }
interface Cloud { kind: Kind; lon: number; lat: number; km: number; speed: number; alt: number; phase: number; puffs: Puff[] }

const WEST = 74.6, SPAN = 9.2; // longitude band the clouds circulate through

const LOOK: Record<Kind, {
  top: [number, number, number]; mid: [number, number, number]; base: [number, number, number];
  body: number; under: number; shadow: number; squash: number;
}> = {
  cumulus: { top: [255, 255, 255], mid: [246, 249, 253], base: [214, 226, 239], body: 0.9, under: 0.32, shadow: 0.09, squash: 1 },
  wisp: { top: [255, 255, 255], mid: [250, 252, 255], base: [236, 243, 250], body: 0.42, under: 0, shadow: 0.025, squash: 0.32 },
  storm: { top: [226, 232, 239], mid: [184, 195, 208], base: [132, 145, 161], body: 0.82, under: 0.45, shadow: 0.16, squash: 0.9 },
};

function rng(seed: number) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

function makeClouds(): Cloud[] {
  const r = rng(7);
  const plan: Kind[] = [
    ...Array<Kind>(10).fill("cumulus"),
    ...Array<Kind>(7).fill("wisp"),
    ...Array<Kind>(3).fill("storm"),
  ];
  return plan.map((kind) => {
    const n = kind === "wisp" ? 4 + Math.floor(r() * 3) : 7 + Math.floor(r() * 7);
    const spread = kind === "wisp" ? 2.6 : kind === "storm" ? 1.9 : 1.6;
    const puffs = Array.from({ length: n }, () => ({
      dx: (r() - 0.5) * spread,
      dy: (r() - 0.5) * (kind === "wisp" ? 0.2 : 0.55),
      r: (kind === "storm" ? 0.38 : 0.3) + r() * 0.45,
      phase: r() * Math.PI * 2,
      rate: 0.1 + r() * 0.2,
    }));
    const km = kind === "cumulus" ? 18 + r() * 40 : kind === "storm" ? 34 + r() * 30 : 20 + r() * 26;
    return {
      kind, lon: WEST + r() * SPAN, lat: 7.4 + r() * 7.2, km,
      speed: kind === "wisp" ? 1.4 + r() * 0.5 : kind === "storm" ? 0.55 + r() * 0.25 : 0.75 + r() * 0.5,
      alt: kind === "wisp" ? 1 : kind === "storm" ? 0.3 + r() * 0.2 : 0.45 + r() * 0.4,
      phase: r() * Math.PI * 2, puffs,
    };
  });
}

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rgba = ([r, g, b]: [number, number, number], a: number) => `rgba(${r},${g},${b},${a})`;

export default function Clouds({ map }: { map: MlMap | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!map || !canvas.current) return;
    const cv = canvas.current, ctx = cv.getContext("2d")!;
    // draw wisps last so they sit "above" the lower clouds
    const order: Record<Kind, number> = { storm: 0, cumulus: 1, wisp: 2 };
    const clouds = makeClouds().sort((a, b) => order[a.kind] - order[b.kind]);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, last = 0, travelled = 0;
    const start = performance.now();

    /** an ellipse-shaped radial puff */
    const blob = (x: number, y: number, r: number, squash: number, stops: [number, string][], hx = 0, hy = 0) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, squash);
      const g = ctx.createRadialGradient(hx * r, hy * r, r * 0.06, 0, 0, r);
      for (const [o, c] of stops) g.addColorStop(o, c);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 33) return; // ~30 fps is plenty for clouds
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      const t = reduce ? 0 : (now - start) / 1000;

      // breeze with slow gusts (degrees of longitude per second)
      const wind = reduce ? 0 : 0.011 * (1 + 0.35 * Math.sin(t * 0.07) + 0.15 * Math.sin(t * 0.23 + 1.3));
      travelled += wind * dt;

      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const z = map.getZoom();
      const zoomAlpha = Math.max(0, Math.min(1, (9.5 - z) / 2.5));
      if (zoomAlpha <= 0.01) return;
      const c = map.getCenter();
      const a = map.project([c.lng, c.lat]), b = map.project([c.lng + 0.09, c.lat]);
      const pxPerKm = Math.hypot(b.x - a.x, b.y - a.y) / 10;
      const tilt = Math.sin((map.getPitch() * Math.PI) / 180);
      const cx = w / 2, cy = h / 2;

      for (const cl of clouds) {
        const look = LOOK[cl.kind];
        const u = ((((cl.lon - travelled * cl.speed - WEST) % SPAN) + SPAN) % SPAN) / SPAN; // 0 = west edge, 1 = east edge
        const lon = WEST + u * SPAN;
        const lat = cl.lat + 0.08 * Math.sin(t * 0.045 + cl.phase);
        const alpha = zoomAlpha * smooth(0, 0.14, u) * smooth(1, 0.86, u);
        if (alpha < 0.02) continue;

        const g0 = map.project([lon, lat]);
        const size = cl.km * pxPerKm;
        const par = 1 + cl.alt * 0.06; // higher clouds slide a little more when panning
        const x0 = cx + (g0.x - cx) * par;
        const y0 = cy + (g0.y - cy) * par - cl.alt * size * 0.55 * tilt;
        if (x0 < -size * 3 || y0 < -size * 2 || x0 > w + size * 3 || y0 > h + size * 2) continue;

        const puffs = cl.puffs.map((p) => {
          const breathe = 1 + 0.07 * Math.sin(t * p.rate + p.phase);
          return {
            x: x0 + (p.dx + 0.05 * Math.sin(t * p.rate * 0.6 + p.phase)) * size,
            y: y0 + (p.dy + 0.03 * Math.cos(t * p.rate * 0.5 + p.phase)) * size,
            r: p.r * size * breathe,
          };
        });

        // ground shadow, further and softer for higher clouds
        const sx = size * (0.25 + cl.alt * 0.25), sy = size * (0.35 + cl.alt * 0.35) * (1 - 0.5 * tilt) + (g0.y - y0);
        for (const p of puffs) {
          blob(p.x + sx, p.y + sy, p.r * 1.05, look.squash, [[0, `rgba(25,50,80,${look.shadow * alpha})`], [1, "rgba(25,50,80,0)"]]);
        }
        // shaded underside
        if (look.under > 0) {
          for (const p of puffs) {
            blob(p.x, p.y + p.r * 0.22, p.r * 0.95, look.squash, [[0, rgba(look.base, look.under * alpha)], [1, rgba(look.base, 0)]]);
          }
        }
        // sunlit body (light from the top-left)
        for (const p of puffs) {
          blob(p.x, p.y, p.r, look.squash, [
            [0, rgba(look.top, look.body * alpha)],
            [0.5, rgba(look.mid, look.body * 0.68 * alpha)],
            [0.82, rgba(look.base, look.body * 0.25 * alpha)],
            [1, rgba(look.base, 0)],
          ], -0.25, -0.32);
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [map]);

  return <canvas ref={canvas} className="clouds" aria-hidden="true" />;
}
