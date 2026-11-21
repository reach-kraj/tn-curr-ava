"use client";

import { useEffect, useRef } from "react";
import { select, type Selection } from "d3-selection";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import type { Dataset, Station } from "@/lib/types";
import { shortName } from "@/lib/booking";

interface Props {
  data: Dataset;
  stations: Station[];
  selected: Station;
  route: Station[] | null;
  flyKey: number;
  onSelect: (s: Station) => void;
}

const LAT0 = Math.cos((11 * Math.PI) / 180);
const major = (s: Station) => s.n >= 60;
const baseR = (s: Station) => (major(s) ? 2.6 + Math.sqrt(s.n) * 0.22 : 2.1);
const grow = (k: number) => Math.min(1.8, 0.8 + k * 0.2);

type G = Selection<SVGGElement, unknown, null, undefined>;

/**
 * The map is drawn imperatively with d3 so pan/zoom stays smooth with ~2.5k SVG nodes:
 * React owns only the <svg> element; geometry and labels are updated directly.
 */
export default function RailMap({ data, stations, selected, route, flyKey, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const api = useRef<{
    restyle: () => void;
    drawRoute: (r: Station[] | null) => void;
    fly: (s: Station) => void;
    setSelected: (s: Station) => void;
    fit: () => void;
    zoomBy: (f: number) => void;
  } | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  const selRef = useRef(selected);
  const routeRef = useRef(route);

  useEffect(() => {
    const svgEl = svgRef.current!;
    const svg = select(svgEl);
    svg.selectAll("g.root").remove();
    const root = svg.append("g").attr("class", "root");
    const layer = (cls: string): G => root.append("g").attr("class", cls);
    const gGrid = layer("grid"), gNb = layer("nb"), gRegion = layer("regions"), gLand = layer("landg").attr("filter", "url(#land-shadow)");
    const gCase = layer("cases"), gTrk = layer("tracks"), gHl = layer("hlg"), gPulse = layer("pulses"), gStn = layer("stns"), gLbl = layer("lbls");

    const ext = [Infinity, Infinity, -Infinity, -Infinity];
    data.b.flat().forEach(([x, y]) => { ext[0] = Math.min(ext[0], x); ext[1] = Math.min(ext[1], y); ext[2] = Math.max(ext[2], x); ext[3] = Math.max(ext[3], y); });
    const ranked = [...stations].sort((a, b) => b.n - a.n);
    let W = 0, H = 0, sc = 1, ox = 0, oy = 0;
    let T: ZoomTransform = zoomIdentity;
    const P = (lon: number, lat: number): [number, number] => [ox + (lon - ext[0]) * LAT0 * sc, oy + (ext[3] - lat) * sc];
    const proj = (s: Station) => P(s.lon, s.lat);
    const ring = (r: [number, number][]) => "M" + r.map(([x, y]) => P(x, y).map((v) => v.toFixed(1)).join(",")).join("L") + "Z";

    function layout() {
      const box = svgEl.getBoundingClientRect();
      W = box.width; H = box.height;
      const narrow = W < 720;
      const padTop = narrow ? 170 : 48, padL = narrow ? 20 : Math.min(470, W * 0.38), padR = narrow ? 20 : 80, padB = narrow ? 24 : 70;
      const gw = (ext[2] - ext[0]) * LAT0, gh = ext[3] - ext[1];
      sc = Math.min((W - padL - padR) / gw, (H - padTop - padB) / gh);
      ox = padL + (W - padL - padR - gw * sc) / 2;
      oy = padTop + (H - padTop - padB - gh * sc) / 2;

      // graticule every half degree, labelled on whole degrees
      const lons: number[] = [], lats: number[] = [];
      for (let x = 74; x <= 83; x += 0.5) lons.push(x);
      for (let y = 6; y <= 15; y += 0.5) lats.push(y);
      gGrid.selectAll("line.lon").data(lons).join("line").attr("class", (d) => "lon gl" + (d % 1 === 0 ? " whole" : ""))
        .attr("x1", (d) => P(d, 15)[0]).attr("x2", (d) => P(d, 15)[0]).attr("y1", P(0, 16)[1]).attr("y2", P(0, 5)[1]);
      gGrid.selectAll("line.lat").data(lats).join("line").attr("class", (d) => "lat gl" + (d % 1 === 0 ? " whole" : ""))
        .attr("y1", (d) => P(78, d)[1]).attr("y2", (d) => P(78, d)[1]).attr("x1", P(72, 0)[0]).attr("x2", P(85, 0)[0]);

      gNb.selectAll("path").data(data.nb).join("path").attr("class", "neigh").attr("d", (d) => ring(d.r));
      const regions: [string, number, number][] = [["KERALA", 76.35, 10.1], ["KARNATAKA", 77.0, 12.6], ["ANDHRA PRADESH", 79.4, 13.55]];
      const seas: [string, number, number][] = [["Bay of Bengal", 80.85, 11.3], ["Gulf of Mannar", 78.55, 8.7], ["Palk Strait", 79.8, 9.8]];
      gRegion.selectAll("text.region").data(regions).join("text").attr("class", "region").attr("x", (d) => P(d[1], d[2])[0]).attr("y", (d) => P(d[1], d[2])[1]).text((d) => d[0]);
      gRegion.selectAll("text.sea").data(seas).join("text").attr("class", "sea").attr("x", (d) => P(d[1], d[2])[0]).attr("y", (d) => P(d[1], d[2])[1]).text((d) => d[0]);
      gLand.selectAll("path").data(data.b).join("path").attr("class", "land").attr("d", ring);

      const seg = (sel: Selection<SVGLineElement, [number, number], SVGGElement, unknown>) =>
        sel.attr("x1", ([a]) => proj(stations[a])[0]).attr("y1", ([a]) => proj(stations[a])[1])
          .attr("x2", ([, b]) => proj(stations[b])[0]).attr("y2", ([, b]) => proj(stations[b])[1]);
      seg(gCase.selectAll<SVGLineElement, [number, number]>("line").data(data.e).join("line").attr("class", "case"));
      seg(gTrk.selectAll<SVGLineElement, [number, number]>("line").data(data.e).join("line").attr("class", "trk"));

      gStn.selectAll<SVGCircleElement, Station>("circle").data([...stations].sort((a, b) => a.n - b.n), (d) => d.code).join("circle")
        .attr("class", (s) => "stn" + (major(s) ? "" : " minor"))
        .attr("cx", (s) => proj(s)[0]).attr("cy", (s) => proj(s)[1])
        .attr("tabindex", 0).attr("role", "button").attr("aria-label", (s) => `${s.name} (${s.code}), ${s.n} trains`)
        .on("click", (_e, s) => onSelectRef.current(s))
        .on("keydown", (e: KeyboardEvent, s) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectRef.current(s); } })
        .on("mouseenter", (_e, s) => showTip(s))
        .on("mouseleave", () => { if (tipRef.current) tipRef.current.hidden = true; });

      gLbl.selectAll<SVGTextElement, Station>("text").data(stations, (d) => d.code).join("text")
        .attr("class", (s) => "lbl" + (major(s) ? " major" : ""))
        .attr("x", (s) => proj(s)[0]).attr("y", (s) => proj(s)[1]).text((s) => shortName(s.name));
      restyle();
      drawRoute(routeRef.current);
    }

    function restyle() {
      const k = T.k, g = grow(k);
      gStn.selectAll<SVGCircleElement, Station>("circle").attr("r", (s) => (baseR(s) * g) / k);
      gLbl.selectAll<SVGTextElement, Station>("text")
        .attr("font-size", (s) => (major(s) ? 12 : 11) / k).attr("dx", (s) => (baseR(s) * g + 4) / k).attr("dy", 4 / k)
        .style("stroke-width", 3.5 / k + "px");
      gRegion.selectAll("text").attr("font-size", 12.5 / k);
      gHl.selectAll("circle").attr("r", 3.2 / k);
      placeLabels();
      drawSelected();
    }

    /** Greedy label placement in screen space: busiest first, skip collisions. */
    function placeLabels() {
      const k = T.k, sel = selRef.current, show = new Set<Station>(), boxes: number[][] = [];
      const budget = Math.round(14 * Math.pow(k, 1.6));
      for (const s of [sel, ...ranked.filter((x) => x !== sel)]) {
        if (show.size > budget) break;
        const [px, py] = proj(s), x = T.applyX(px), y = T.applyY(py);
        if (x < -60 || y < -20 || x > W + 60 || y > H + 20) continue;
        const r = baseR(s) * grow(k), w = shortName(s.name).length * (major(s) ? 7 : 6.4) + 4;
        const b = [x + r + 3, y - 9, x + r + 3 + w, y + 7];
        if (s !== sel && boxes.some((o) => !(b[2] < o[0] || b[0] > o[2] || b[3] < o[1] || b[1] > o[3]))) continue;
        boxes.push(b); show.add(s);
      }
      gLbl.selectAll<SVGTextElement, Station>("text").attr("display", (s) => (show.has(s) ? null : "none")).classed("sel", (s) => s === sel);
    }

    function drawSelected() {
      const sel = selRef.current, [x, y] = proj(sel), r = (baseR(sel) * grow(T.k)) / T.k;
      gPulse.selectAll("circle").data([sel]).join("circle").attr("class", "pulse").attr("cx", x).attr("cy", y).attr("r", r);
      gStn.selectAll<SVGCircleElement, Station>("circle").classed("sel", (s) => s === sel);
      gStn.select<SVGCircleElement>("circle.sel").raise();
    }

    function drawRoute(r: Station[] | null) {
      const pts = r ? r.map(proj) : [];
      const d = pts.length > 1 ? "M" + pts.map((p) => p.join(",")).join("L") : null;
      gHl.selectAll("path.hl-case").data(d ? [d] : []).join("path").attr("class", "hl-case").attr("d", (x) => x);
      gHl.selectAll("path.hl").data(d ? [d] : []).join("path").attr("class", "hl").attr("d", (x) => x);
      gHl.selectAll("circle").data(pts).join("circle").attr("class", "hl-dot").attr("cx", (p) => p[0]).attr("cy", (p) => p[1]).attr("r", 3.2 / T.k);
    }

    function showTip(s: Station) {
      const tip = tipRef.current;
      if (!tip) return;
      const [px, py] = proj(s);
      tip.innerHTML = "";
      const b = document.createElement("b"); b.textContent = s.name;
      const c = document.createElement("span"); c.className = "tip-code"; c.textContent = s.code;
      const n = document.createElement("span"); n.className = "tip-n"; n.textContent = `${s.n} trains stop here`;
      tip.append(b, " ", c, document.createElement("br"), n);
      tip.style.left = `${T.applyX(px)}px`;
      tip.style.top = `${T.applyY(py) - baseR(s) * grow(T.k)}px`;
      tip.hidden = false;
    }

    const zoom: ZoomBehavior<SVGSVGElement, unknown> = d3zoom<SVGSVGElement, unknown>().scaleExtent([1, 40]).on("zoom", (e) => {
      T = e.transform; root.attr("transform", T.toString());
      if (tipRef.current) tipRef.current.hidden = true;
      restyle();
    });
    svg.call(zoom).on("dblclick.zoom", null);

    api.current = {
      restyle,
      drawRoute,
      setSelected: (s) => { selRef.current = s; placeLabels(); drawSelected(); },
      fly: (s) => {
        const [x, y] = proj(s), k = Math.max(T.k, 5);
        svg.transition().duration(750).call(zoom.transform, zoomIdentity.translate(W / 2 - x * k, H / 2 - y * k).scale(k));
      },
      fit: () => { svg.transition().duration(600).call(zoom.transform, zoomIdentity); },
      zoomBy: (f) => { svg.transition().duration(300).call(zoom.scaleBy, f); },
    };

    layout();
    const ro = new ResizeObserver(() => layout());
    ro.observe(svgEl);
    return () => { ro.disconnect(); svg.on(".zoom", null); };
  }, [data, stations]);

  useEffect(() => { selRef.current = selected; api.current?.setSelected(selected); }, [selected]);
  useEffect(() => { routeRef.current = route; api.current?.drawRoute(route); }, [route]);
  useEffect(() => { if (flyKey) api.current?.fly(selRef.current); }, [flyKey]);

  return (
    <div className="map-canvas">
      <svg ref={svgRef} role="img" aria-label="Rail map of Tamil Nadu. Select a station to see its trains.">
        <defs>
          <filter id="land-shadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="#24476b" floodOpacity=".16" />
          </filter>
        </defs>
      </svg>
      <div ref={tipRef} className="tip" hidden />
      <div className="zoom-ctl">
        <button type="button" aria-label="Zoom in" onClick={() => api.current?.zoomBy(1.7)}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => api.current?.zoomBy(1 / 1.7)}>−</button>
        <button type="button" aria-label="Show whole state" onClick={() => api.current?.fit()}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
        </button>
      </div>
    </div>
  );
}
