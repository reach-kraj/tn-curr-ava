"use client";

import { useEffect, useRef } from "react";
import type { Map as MlMap } from "maplibre-gl";

/**
 * Drifting clouds anchored to real coordinates, so they pan and tilt with the map.
 *
 * Motion that reads as natural:
 *  - a north-east monsoon breeze (towards the west) with gusts, each cloud at its own speed
 *  - a slow vertical sway, and puffs that swell and shift so outlines keep changing
 *  - altitude parallax: higher clouds slide a little more than the ground when you pan or tilt
 *  - clouds fade in and out as they cross the edges of the cloud field (no popping on wrap)
 *  - soft ground shadows offset by altitude; the whole layer clears between zoom 7 and 9.5
 */
interface Puff { dx: number; dy: number; r: number; phase: number; rate: number }
interface Cloud { lon: number; lat: number; km: number; speed: number; alt: number; phase: number; puffs: Puff[] }

const WEST = 74.6, SPAN = 9.2; // longitude band the clouds circulate through

function rng(seed: number) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

function makeClouds(): Cloud[] {
  const r = rng(42);
  return Array.from({ length: 18 }, () => {
    const puffs = Array.from({ length: 6 + Math.floor(r() * 7) }, () => ({
      dx: (r() - 0.5) * 1.6, dy: (r() - 0.5) * 0.55, r: 0.32 + r() * 0.45, phase: r() * Math.PI * 2, rate: 0.12 + r() * 0.2,
    }));
    return {
      lon: WEST + r() * SPAN, lat: 7.4 + r() * 7.2, km: 16 + r() * 30,
      speed: 0.7 + r() * 0.6, alt: 0.4 + r() * 0.6, phase: r() * Math.PI * 2, puffs,
    };
  });
}

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export default function Clouds({ map }: { map: MlMap | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!map || !canvas.current) return;
    const cv = canvas.current, ctx = cv.getContext("2d")!;
    const clouds = makeClouds();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, last = 0, travelled = 0;
    const start = performance.now();

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
        const u = ((((cl.lon - travelled * cl.speed - WEST) % SPAN) + SPAN) % SPAN) / SPAN; // 0 = west edge, 1 = east edge
        const lon = WEST + u * SPAN;
        const lat = cl.lat + 0.08 * Math.sin(t * 0.045 + cl.phase);
        const edge = smooth(0, 0.14, u) * smooth(1, 0.86, u); // fade at both ends of the band
        const alpha = zoomAlpha * edge;
        if (alpha < 0.02) continue;

        const g0 = map.project([lon, lat]);
        // parallax: clouds sit above the ground, so they spread from the screen centre and lift with tilt
        const par = 1 + cl.alt * 0.06;
        const size = cl.km * pxPerKm;
        const x0 = cx + (g0.x - cx) * par;
        const y0 = cy + (g0.y - cy) * par - cl.alt * size * 0.55 * tilt;
        if (x0 < -size * 2 || y0 < -size * 2 || x0 > w + size * 2 || y0 > h + size * 2) continue;

        const puffs = cl.puffs.map((p) => {
          const breathe = 1 + 0.07 * Math.sin(t * p.rate + p.phase);
          return {
            x: x0 + (p.dx + 0.05 * Math.sin(t * p.rate * 0.6 + p.phase)) * size,
            y: y0 + (p.dy + 0.03 * Math.cos(t * p.rate * 0.5 + p.phase)) * size,
            r: p.r * size * breathe,
          };
        });

        // ground shadow: further away and softer for higher clouds
        const sx = size * (0.25 + cl.alt * 0.25), sy = size * (0.35 + cl.alt * 0.35) * (1 - 0.5 * tilt) + g0.y - y0;
        for (const p of puffs) {
          const x = p.x + sx, y = p.y + sy, r = p.r * 1.05;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(30,60,90,${0.085 * alpha})`);
          g.addColorStop(1, "rgba(30,60,90,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        // cloud body: soft white with a sunlit top-left and a faint blue-grey base
        for (const p of puffs) {
          const g = ctx.createRadialGradient(p.x - p.r * 0.25, p.y - p.r * 0.32, p.r * 0.08, p.x, p.y, p.r);
          g.addColorStop(0, `rgba(255,255,255,${0.88 * alpha})`);
          g.addColorStop(0.5, `rgba(249,251,255,${0.6 * alpha})`);
          g.addColorStop(0.82, `rgba(226,236,246,${0.22 * alpha})`);
          g.addColorStop(1, "rgba(226,236,246,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [map]);

  return <canvas ref={canvas} className="clouds" aria-hidden="true" />;
}
