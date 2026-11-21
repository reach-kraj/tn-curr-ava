"use client";

import { useEffect, useRef } from "react";
import type { Map as MlMap } from "maplibre-gl";

/**
 * Drifting clouds anchored to real coordinates, so they pan and tilt with the map.
 * Each cloud casts a soft shadow on the ground; the whole layer clears between zoom 7 and 9.5.
 */
interface Cloud { lon: number; lat: number; km: number; seed: number; puffs: { dx: number; dy: number; r: number }[] }

function rng(seed: number) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

function makeClouds(): Cloud[] {
  const r = rng(42);
  return Array.from({ length: 16 }, (_, i) => {
    const puffs = Array.from({ length: 6 + Math.floor(r() * 6) }, () => ({ dx: (r() - 0.5) * 1.6, dy: (r() - 0.5) * 0.55, r: 0.35 + r() * 0.45 }));
    return { lon: 75.2 + r() * 7.6, lat: 7.4 + r() * 7.2, km: 16 + r() * 30, seed: i, puffs };
  });
}

export default function Clouds({ map }: { map: MlMap | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!map || !canvas.current) return;
    const cv = canvas.current, ctx = cv.getContext("2d")!;
    const clouds = makeClouds();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, last = 0;
    const start = performance.now();

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 33) return; // ~30 fps is plenty for clouds
      last = t;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const z = map.getZoom();
      const alpha = Math.max(0, Math.min(1, (9.5 - z) / 2.5));
      if (alpha <= 0.01) return;
      const drift = reduce ? 0 : ((t - start) / 1000) * 0.0025; // degrees per second, westward breeze
      const pxPerKm = (() => {
        const c = map.getCenter();
        const a = map.project([c.lng, c.lat]), b = map.project([c.lng + 0.09, c.lat]);
        return Math.hypot(b.x - a.x, b.y - a.y) / 10;
      })();

      for (const cl of clouds) {
        let lon = cl.lon - drift;
        lon = 75 + ((((lon - 75) % 8.4) + 8.4) % 8.4);
        const p = map.project([lon, cl.lat]);
        const size = cl.km * pxPerKm;
        if (p.x < -size * 2 || p.y < -size * 2 || p.x > w + size * 2 || p.y > h + size * 2) continue;
        // shadow on the ground, offset south-east
        for (const pf of cl.puffs) {
          const x = p.x + pf.dx * size + size * 0.35, y = p.y + pf.dy * size + size * 0.45, r = pf.r * size;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(30,60,90,${0.09 * alpha})`);
          g.addColorStop(1, "rgba(30,60,90,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        for (const pf of cl.puffs) {
          const x = p.x + pf.dx * size, y = p.y + pf.dy * size, r = pf.r * size;
          const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
          g.addColorStop(0, `rgba(255,255,255,${0.85 * alpha})`);
          g.addColorStop(0.55, `rgba(248,251,255,${0.55 * alpha})`);
          g.addColorStop(1, "rgba(240,246,252,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [map]);

  return <canvas ref={canvas} className="clouds" aria-hidden="true" />;
}
