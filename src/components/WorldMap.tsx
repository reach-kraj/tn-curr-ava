"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, {
  type GeoJSONSource, type LayerSpecification, type Map as MlMap, type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Dataset, Station } from "@/lib/types";
import { shortName } from "@/lib/booking";
import Clouds from "./Clouds";

/**
 * 3D world map: OpenFreeMap vector tiles (OpenStreetMap data) restyled for a bright game-map look,
 * AWS Open Data terrain, 3D building extrusions, sky/haze, and a cloud layer that clears as you zoom in.
 */
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const TERRAIN_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const HOME = { center: [78.45, 10.85] as [number, number], zoom: 6.35, pitch: 48, bearing: -14 };

const C = {
  sea: "#7fcdea", land: "#f3f1e8", park: "#cfe6b4", wood: "#bfdc9f", sand: "#f1e4bf",
  track: "#1c2432", casing: "#ffffff", accent: "#1f5eff", board: "#ffd31a",
};

export interface MapPadding { top: number; right: number; bottom: number; left: number }
interface Props {
  data: Dataset;
  stations: Station[];
  selected: Station;
  route: Station[] | null;
  fitRouteKey: number;
  flyKey: number;
  padding: MapPadding;
  onSelect: (s: Station) => void;
}

function restyle(style: StyleSpecification): StyleSpecification {
  const drop = /^(poi_|highway-shield|road_shield|road_one_way|highway-name-path|waterway_line_label|aeroway)/;
  const layers: LayerSpecification[] = [];
  for (const l of style.layers) {
    if (drop.test(l.id)) continue;
    const p = ("paint" in l ? (l.paint ?? {}) : {}) as Record<string, unknown>;
    if (l.id === "background") p["background-color"] = C.land;
    if (l.id === "water") { p["fill-color"] = C.sea; p["fill-opacity"] = 1; }
    if (l.id === "park") p["fill-color"] = C.park;
    if (l.id === "landcover_wood") p["fill-color"] = C.wood;
    if (l.id === "landcover_grass") p["fill-color"] = C.park;
    if (l.id === "landcover_sand") p["fill-color"] = C.sand;
    if (l.id === "natural_earth") p["raster-opacity"] = 0.35;
    if (l.id === "building") p["fill-color"] = "#e7e2d6";
    if (l.id === "building-3d") {
      (l as { minzoom?: number }).minzoom = 12.5;
      p["fill-extrusion-color"] = ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 6], 0, "#fbf8f1", 20, "#efe9dc", 45, "#dfe6ef", 100, "#c9d6e8"];
      p["fill-extrusion-opacity"] = 0.94;
      p["fill-extrusion-vertical-gradient"] = true;
    }
    if ("paint" in l || Object.keys(p).length) (l as { paint?: unknown }).paint = p;
    if (l.id === "water") {
      layers.push({
        id: "hillshade", type: "hillshade", source: "dem-hs",
        paint: { "hillshade-exaggeration": 0.42, "hillshade-shadow-color": "#53664f", "hillshade-highlight-color": "#ffffff", "hillshade-accent-color": "#9fb08b" },
      });
    }
    layers.push(l);
  }
  return {
    ...style,
    sources: {
      ...style.sources,
      dem: { type: "raster-dem", tiles: [TERRAIN_TILES], encoding: "terrarium", tileSize: 256, maxzoom: 13, attribution: "Terrain: Mapzen, AWS Open Data" },
      "dem-hs": { type: "raster-dem", tiles: [TERRAIN_TILES], encoding: "terrarium", tileSize: 256, maxzoom: 13 },
    },
    layers,
  };
}

/** Used if the tile service is unreachable: sea + Tamil Nadu outline from our own data. */
function fallbackStyle(data: Dataset): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      tn: { type: "geojson", data: { type: "FeatureCollection", features: [...data.b, ...data.nb.map((n) => n.r)].map((r) => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [r] } })) } },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": C.sea } },
      { id: "tn-land", type: "fill", source: "tn", paint: { "fill-color": C.land, "fill-outline-color": "#b9c8d6" } },
    ],
  };
}

const fc = <G,>(features: G[]) => ({ type: "FeatureCollection" as const, features });

export default function WorldMap({ data, stations, selected, route, fitRouteKey, flyKey, padding, onSelect }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  const paddingRef = useRef(padding);
  const flyRef = useRef(flyKey);
  useEffect(() => { flyRef.current = flyKey; }, [flyKey]);
  const [ready, setReady] = useState(false);
  const [mode3d, setMode3d] = useState(true);
  const [mapState, setMapState] = useState<MlMap | null>(null);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    (async () => {
      let style: StyleSpecification;
      try {
        const res = await fetch(STYLE_URL);
        if (!res.ok) throw new Error(String(res.status));
        style = restyle(await res.json());
      } catch {
        style = fallbackStyle(data);
      }
      if (cancelled || !box.current) return;
      map = new maplibregl.Map({
        container: box.current,
        style,
        center: HOME.center,
        zoom: 5.4,
        pitch: 0,
        bearing: 0,
        maxPitch: 78,
        attributionControl: { compact: true },
        canvasContextAttributes: { antialias: true },
      });
      mapRef.current = map;
      setMapState(map);
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showZoom: true }), "bottom-left");

      map.on("load", () => {
        const m = map!;
        if (m.getSource("dem")) m.setTerrain({ source: "dem", exaggeration: 1.35 });
        m.setSky({
          "sky-color": "#6fbff0", "horizon-color": "#e8f4fb", "fog-color": "#eaf3f8",
          "sky-horizon-blend": 0.55, "horizon-fog-blend": 0.6, "fog-ground-blend": 0.35, "atmosphere-blend": 0.7,
        });

        const pts = fc(stations.map((s) => ({
          type: "Feature" as const, id: s.i,
          properties: { code: s.code, name: shortName(s.name), n: s.n, major: s.n >= 60 ? 1 : 0 },
          geometry: { type: "Point" as const, coordinates: [s.lon, s.lat] },
        })));
        const lines = fc(data.e.map(([a, b]) => ({
          type: "Feature" as const, properties: {},
          geometry: { type: "LineString" as const, coordinates: [[stations[a].lon, stations[a].lat], [stations[b].lon, stations[b].lat]] },
        })));
        m.addSource("rail", { type: "geojson", data: lines });
        m.addSource("stations", { type: "geojson", data: pts });
        m.addSource("route", { type: "geojson", data: fc([]) });

        const w = (lo: number, hi: number) => ["interpolate", ["exponential", 1.6], ["zoom"], 5, lo, 13, hi] as unknown as number;
        m.addLayer({ id: "rail-case", type: "line", source: "rail", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": C.casing, "line-width": w(3.2, 9) } });
        m.addLayer({ id: "rail-line", type: "line", source: "rail", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": C.track, "line-width": w(1.3, 3.4) } });
        m.addLayer({ id: "route-glow", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": C.accent, "line-width": w(10, 22), "line-opacity": 0.22, "line-blur": 6 } });
        m.addLayer({ id: "route-case", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": w(6.5, 13) } });
        m.addLayer({ id: "route-line", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": C.accent, "line-width": w(3.6, 7) } });
        m.addLayer({
          id: "stn", type: "circle", source: "stations",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, ["case", ["==", ["get", "major"], 1], 4.2, 1.3], 10, ["case", ["==", ["get", "major"], 1], 8, 2.8], 14, ["case", ["==", ["get", "major"], 1], 11, 5]],
            "circle-color": ["case", ["boolean", ["feature-state", "hover"], false], C.accent, ["==", ["get", "major"], 1], "#ffffff", C.track],
            "circle-stroke-color": ["case", ["==", ["get", "major"], 1], C.track, "#ffffff"],
            "circle-stroke-width": ["case", ["==", ["get", "major"], 1], 1.8, 0.7],
            "circle-pitch-alignment": "map",
          },
        });
        m.addLayer({
          id: "stn-label", type: "symbol", source: "stations",
          layout: {
            "text-field": ["get", "name"],
            "text-font": ["Noto Sans Bold"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 5, ["case", ["==", ["get", "major"], 1], 11.5, 9], 12, ["case", ["==", ["get", "major"], 1], 15, 11.5]],
            "text-variable-anchor": ["left", "right", "top", "bottom"],
            "text-radial-offset": 0.9,
            "text-justify": "auto",
            "symbol-sort-key": ["-", 0, ["get", "n"]],
            "text-optional": true,
          },
          paint: { "text-color": "#101826", "text-halo-color": "#ffffff", "text-halo-width": 1.8, "text-halo-blur": 0.4 },
        });

        let hoverId: number | null = null;
        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "map-tip", offset: 14 });
        m.on("mousemove", "stn", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          m.getCanvas().style.cursor = "pointer";
          if (hoverId !== null) m.setFeatureState({ source: "stations", id: hoverId }, { hover: false });
          hoverId = f.id as number;
          m.setFeatureState({ source: "stations", id: hoverId }, { hover: true });
          const s = stations[hoverId];
          const el = document.createElement("div");
          const b = document.createElement("b"); b.textContent = s.name;
          const c = document.createElement("span"); c.className = "tip-code"; c.textContent = ` ${s.code}`;
          const n = document.createElement("div"); n.className = "tip-n"; n.textContent = `${s.n} trains stop here`;
          el.append(b, c, n);
          popup.setLngLat([s.lon, s.lat]).setDOMContent(el).addTo(m);
        });
        m.on("mouseleave", "stn", () => {
          m.getCanvas().style.cursor = "";
          if (hoverId !== null) m.setFeatureState({ source: "stations", id: hoverId }, { hover: false });
          hoverId = null;
          popup.remove();
        });
        m.on("click", "stn", (e) => {
          const f = e.features?.[0];
          if (f) { popup.remove(); onSelectRef.current(stations[f.id as number]); }
        });

        m.setPadding(paddingRef.current);
        // keep the credits collapsed to an (i) button on small screens
        if (m.getContainer().clientWidth < 900) m.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
        setReady(true);
        // opening shot: tilt up from a flat overview into the 3D view
        if (!flyRef.current) m.easeTo({ ...HOME, duration: 2600, essential: true });
      });
    })();
    return () => { cancelled = true; markerRef.current?.remove(); map?.remove(); mapRef.current = null; };
  }, [data, stations]);

  // selected-station waypoint marker
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "waypoint";
      el.innerHTML = '<span class="waypoint-pulse"></span><span class="waypoint-pin"><span class="waypoint-code"></span></span>';
      markerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" });
    }
    const el = markerRef.current.getElement();
    el.querySelector(".waypoint-code")!.textContent = selected.code;
    el.setAttribute("aria-label", `Selected: ${selected.name}`);
    markerRef.current.setLngLat([selected.lon, selected.lat]).addTo(m);
  }, [selected, ready]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    (m.getSource("route") as GeoJSONSource | undefined)?.setData(
      route && route.length > 1
        ? fc([{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.map((s) => [s.lon, s.lat]) } }])
        : fc([]),
    );
  }, [route, ready]);

  useEffect(() => { paddingRef.current = padding; mapRef.current?.setPadding(padding); }, [padding]);

  // fly into the station (from search, a map click, or a shared link)
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready || !flyKey) return;
    m.flyTo({ center: [selected.lon, selected.lat], zoom: 13.6, pitch: mode3d ? 62 : 0, bearing: m.getBearing() - 20, duration: 2400, curve: 1.5, essential: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fly only when asked
  }, [flyKey, ready]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready || !fitRouteKey || !route || route.length < 2) return;
    const b = new maplibregl.LngLatBounds();
    route.forEach((s) => b.extend([s.lon, s.lat]));
    m.fitBounds(b, { padding: 70, pitch: mode3d ? 40 : 0, duration: 1600, maxZoom: 11 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fit only when a card is opened
  }, [fitRouteKey, ready]);

  const toggle3d = () => {
    const m = mapRef.current;
    if (!m) return;
    const next = !mode3d;
    setMode3d(next);
    if (next && m.getSource("dem")) m.setTerrain({ source: "dem", exaggeration: 1.35 });
    if (!next) m.setTerrain(null);
    m.easeTo({ pitch: next ? 55 : 0, bearing: next ? -14 : 0, duration: 900 });
  };

  return (
    <div className="world">
      <div ref={box} className="world-map" />
      <Clouds map={mapState} />
      <div className="world-fade" aria-hidden="true" />
      <div className="map-tools">
        <button type="button" onClick={toggle3d} aria-pressed={mode3d}>{mode3d ? "2D" : "3D"}</button>
        <button type="button" onClick={() => mapRef.current?.flyTo({ ...HOME, pitch: mode3d ? HOME.pitch : 0, duration: 1800 })} aria-label="Show all of Tamil Nadu">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
        </button>
      </div>
      {!ready && <div className="world-loading"><span className="loading-dot" />Loading 3D map…</div>}
    </div>
  );
}
