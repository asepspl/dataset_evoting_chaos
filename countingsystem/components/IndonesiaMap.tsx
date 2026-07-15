"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ProvinsiResult } from "@/lib/aggregator";

interface Props {
  onProvinsiClick: (name: string, kabupaten?: string) => void;
  data: ProvinsiResult[];
  selectedProvinsi: string | null;
  totalTPS?: number;
  totalVoters?: number;
  registeredVoters?: number;
  activeProvinsi?: number;
  lastRefresh?: Date | null;
  nextUpdate?: number;
  isDark?: boolean;
  onThemeToggle?: () => void;
  activeTPS?: number;
  inactiveTPS?: number;
  onSearchSelect?: (tps: any) => void;
  lang: Language;
  onLanguageChange: (l: Language) => void;
}

import { PROV_FOLDER_MAP, PPLN_CITY_COORDS } from "@/lib/map-constants";
import { voteColor, KAB_COLORS } from "@/lib/color-utils";
import StatCard from "@/components/shared/StatCard";
import { MapPin, Users, BarChart3, Search, X, Globe, Check, Trophy, Star } from "lucide-react";
import { translations, languages, type Language } from "@/constants/translations";
import { getLocalizedProvince, getLocalizedAdminName } from "@/constants/provinces";

const TILE_LIGHT_BASE   = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";
const TILE_LIGHT_LABELS = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png";
const TILE_DARK_BASE    = "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
const TILE_DARK_LABELS  = "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png";
const KAB_GEOJSON_BASE = "https://raw.githubusercontent.com/ardian28/GeoJson-Indonesia-38-Provinsi/refs/heads/main/Kabupaten";

// Extract GPS coordinates either from explicit comma format in address or falling back to city dictionary
function getTpsCoords(tps: any): [number, number] | null {
  if (!tps) return null;
  const address = String(tps.alamatLengkap || "");
  const coordMatch = address.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return [lat, lng];
  }
  const cityStr = String(tps.kotaDesa || "").toUpperCase();
  for (const [cityName, coords] of Object.entries(PPLN_CITY_COORDS)) {
    if (cityStr.includes(cityName)) return coords;
  }
  return null;
}

export default function IndonesiaMap({
  onProvinsiClick, data, selectedProvinsi, totalTPS = 0, totalVoters = 0, registeredVoters = 0, activeProvinsi = 0, lastRefresh, nextUpdate = 0,
  isDark = false, onThemeToggle, activeTPS = 0, inactiveTPS = 0, onSearchSelect, lang, onLanguageChange
}: Props) {
  const t = translations[lang];
  const [showLangMenu, setShowLangMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const provLayerRef = useRef<any>(null);
  const kabLayerRef  = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const labelLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const LRef         = useRef<any>(null);
  const dataRef      = useRef(data);
  dataRef.current    = data;

  // Stable Candidate Colors: Red, Blue, Green, Yellow
  const CANDIDATE_COLORS = useMemo(() => [
    "#ef4444", // Red
    "#3b82f6", // Blue
    "#10b981", // Green
    "#f59e0b", // Yellow/Orange
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#06b6d4", // Cyan
  ], []);

  // Stable Presidential Candidates grouped and deduped by name
  const presidentialCandidates = useMemo(() => {
    const candidatesMap = new Map<string, { id: number; name: string }>();
    for (const p of data) {
      const presCat = p.categories?.find(c => c.categoryType === 0);
      if (presCat) {
        for (const cand of presCat.candidates) {
          const standardName = cand.name.replace(/\s+/g, " ").trim();
          if (!candidatesMap.has(standardName)) {
            candidatesMap.set(standardName, { id: cand.id, name: standardName });
          }
        }
      }
    }
    return Array.from(candidatesMap.values()).sort((a, b) => a.id - b.id);
  }, [data]);

  // Map each candidate NAME to a stable color
  const candidateColorMap = useMemo(() => {
    const map = new Map<string, string>();
    presidentialCandidates.forEach((cand, idx) => {
      const standardName = cand.name.replace(/\s+/g, " ").trim();
      map.set(standardName, CANDIDATE_COLORS[idx % CANDIDATE_COLORS.length]);
    });
    return map;
  }, [presidentialCandidates, CANDIDATE_COLORS]);

  // Build kabupaten leading candidate details map from aggregated data
  const kabLeadingCandidateMap = useMemo(() => {
    const map = new Map<string, { id: number; name: string; voteCount: number; totalVotes: number }>();
    for (const p of data) {
      for (const kab of (p.kabupatenList ?? [])) {
        const kName = kab.kabupaten.toUpperCase();
        const presCat = kab.categories?.find(c => c.categoryType === 0);
        if (presCat && presCat.candidates && presCat.candidates.length > 0) {
          let leadingCand = presCat.candidates[0];
          for (const c of presCat.candidates) {
            if (c.voteCount > leadingCand.voteCount) {
              leadingCand = c;
            }
          }
          if (leadingCand.voteCount > 0) {
            map.set(kName, {
              id: leadingCand.id,
              name: leadingCand.name.replace(/\s+/g, " ").trim(),
              voteCount: leadingCand.voteCount,
              totalVotes: presCat.totalVotes
            });
          }
        }
      }
    }
    return map;
  }, [data]);

  // Colors based on theme
  const bgPanel = isDark ? "rgba(15, 23, 42, 0.92)" : "rgba(255, 255, 255, 0.94)";
  const textColor = isDark ? "#ffffff" : "#000000";
  const textMuted = isDark ? "#cbd5e1" : "#475569";
  const borderColor = isDark ? "rgba(51, 65, 85, 0.8)" : "#e2e8f0";

  const [currentLevel, setCurrentLevel] = useState<"provinsi" | "kabupaten">("provinsi");
  const currentLevelRef = useRef<"provinsi" | "kabupaten">("provinsi");
  useEffect(() => {
    currentLevelRef.current = currentLevel;
  }, [currentLevel]);
  const [loadingKab, setLoadingKab] = useState(false);
  const [activeProvName, setActiveProvName] = useState<string | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [showGlobalResults, setShowGlobalResults] = useState(false);
  const [activeHoverInfo, setActiveHoverInfo] = useState<{ name: string; tps: number; voters: number; registeredVoters: number; active: number; inactive: number } | null>(null);
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Flatten all TPS for global search
  const allTpsFlattened = useMemo(() => {
    const list: any[] = [];
    for (const p of data) {
      if (!p.kabupatenList) continue;
      for (const kab of p.kabupatenList) {
        if (!kab.kecamatanList) continue;
        for (const kec of kab.kecamatanList) {
          if (!kec.kelurahanList) continue;
          for (const kel of kec.kelurahanList) {
            if (!kel.tpsList) continue;
            for (const tps of kel.tpsList) {
              list.push({
                tpsId: tps.tpsId,
                uniqueTPS: tps.uniqueTPS,
                alamatLengkap: tps.alamatLengkap,
                totalVoters: tps.totalVoters,
                parentProv: p.provinsi,
                parentKab: kab.kabupaten,
                startTime: tps.startTime,
                endTime: tps.endTime,
              });
            }
          }
        }
      }
    }
    return list;
  }, [data]);

  const globalResults = useMemo(() => {
    const q = globalSearchQuery.trim().toUpperCase();
    if (q.length < 3) return [];
    return allTpsFlattened.filter(t => 
      t.uniqueTPS.toUpperCase().includes(q) || 
      String(t.tpsId).includes(q) ||
      (t.alamatLengkap || "").toUpperCase().includes(q) ||
      (t.parentProv || "").toUpperCase().includes(q) ||
      (t.parentKab || "").toUpperCase().includes(q)
    ).slice(0, 8);
  }, [allTpsFlattened, globalSearchQuery]);

  // ── Theme Tile Swap ──
  useEffect(() => {
    if (tileLayerRef.current) tileLayerRef.current.setUrl(isDark ? TILE_DARK_BASE : TILE_LIGHT_BASE);
    if (labelLayerRef.current) labelLayerRef.current.setUrl(isDark ? TILE_DARK_LABELS : TILE_LIGHT_LABELS);
  }, [isDark]);

  // Helper to get voter info from latest data
  const getProvInfo = useCallback((rawName: string) => {
    const normalize = (name: string): string => {
      if (!name) return "";
      let n = name.toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
      n = n.replace(/^(DI|DKI|DAERAHKHUSUSIBUKOTA|DAERAHISTIMEWA)/, "");
      if (n.includes("JAKARTA")) return "JAKARTA";
      if (n.includes("YOGYAKARTA")) return "DIYOGYAKARTA";
      if (n.includes("BANGKABELITUNG")) return "KEPULAUANBANGKABELITUNG";
      return n;
    };

    const target = normalize(rawName);
    const found = dataRef.current.find(p => normalize(p.provinsi) === target);
    return found ?? null;
  }, []);

  // Helper to determine province style based on leading presidential candidate
  // NOTE: must be declared AFTER getProvInfo to avoid TDZ ReferenceError
  const getProvinceStyle = useCallback((rawName: string) => {
    const info = getProvInfo(rawName);
    if (!info || info.totalVoters === 0) {
      return {
        fillColor: isDark ? "#334155" : "#cbd5e1",
        fillOpacity: 0.5,
        color: isDark ? "#475569" : "#64748b",
        weight: 1.2
      };
    }

    const presCat = info.categories?.find(c => c.categoryType === 0);
    if (!presCat || !presCat.candidates || presCat.candidates.length === 0) {
      return {
        fillColor: isDark ? "#334155" : "#cbd5e1",
        fillOpacity: 0.5,
        color: isDark ? "#475569" : "#64748b",
        weight: 1.2
      };
    }

    let leadingCand = presCat.candidates[0];
    for (const c of presCat.candidates) {
      if (c.voteCount > leadingCand.voteCount) {
        leadingCand = c;
      }
    }

    if (leadingCand.voteCount === 0) {
      return {
        fillColor: isDark ? "#334155" : "#cbd5e1",
        fillOpacity: 0.5,
        color: isDark ? "#475569" : "#64748b",
        weight: 1.2
      };
    }

    const color = candidateColorMap.get(leadingCand.name) || (isDark ? "#334155" : "#cbd5e1");
    const totalVotes = presCat.totalVotes || 1;
    const percentage = leadingCand.voteCount / totalVotes;

    // Smooth dynamic opacity based on leading candidate percentage
    const opacity = Math.min(0.85, Math.max(0.45, percentage));

    return {
      fillColor: color,
      fillOpacity: opacity,
      color: isDark ? "#475569" : "#64748b",
      weight: 1.2
    };
  }, [getProvInfo, candidateColorMap, isDark]);

  const getMatchedName = useCallback((raw: string) => {
    const found = getProvInfo(raw);
    return found?.provinsi.toUpperCase() ?? raw.toUpperCase();
  }, [getProvInfo]);

  // Build kabupaten voter & TPS map from aggregated data
  const kabVoterMap = new Map<string, number>();
  const kabTpsMap = new Map<string, number>();
  let maxKabVoters = 1;
  for (const p of data) {
    for (const kab of (p.kabupatenList ?? [])) {
      const kName = kab.kabupaten.toUpperCase();
      kabVoterMap.set(kName, kab.totalVoters);
      kabTpsMap.set(kName, kab.totalTPS);
      if (kab.totalVoters > maxKabVoters) maxKabVoters = kab.totalVoters;
    }
  }

  const loadKabupatenGeoJSON = useCallback(async (provName: string) => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    // Remove existing kabupaten layer
    if (kabLayerRef.current) {
      map.removeLayer(kabLayerRef.current);
      kabLayerRef.current = null;
    }

    const folder = PROV_FOLDER_MAP[provName.toUpperCase()];
    if (!folder) {
      console.warn(`[Map] No folder mapping for province: ${provName}`);
      return;
    }

    setLoadingKab(true);
    try {
      const url = `${KAB_GEOJSON_BASE}/${encodeURIComponent(folder)}/${encodeURIComponent(folder)}.json`;
      const res = await fetch(url);
      
      if (!res.ok) {
        console.warn(`[Map] GeoJSON kabupaten tidak ditemukan untuk ${provName} (Status: ${res.status}). URL: ${url}`);
        setLoadingKab(false);
        return;
      }
      
      const geo = await res.json();

      // Hide province layer so kabupaten is clearly visible
      if (provLayerRef.current) {
        provLayerRef.current.eachLayer((l: any) => l.setStyle({ fillOpacity: 0, color: "transparent", weight: 0 }));
      }

      let featureIdx = 0;
      const getKabupatenStyle = (feature: any, idx: number) => {
        const name = (feature?.properties?.NAME_2 ?? feature?.properties?.name ?? feature?.properties?.KABUPATEN ?? "").toUpperCase();
        const leadingInfo = kabLeadingCandidateMap.get(name);
        const baseColor = KAB_COLORS[idx % KAB_COLORS.length];
        
        if (leadingInfo && leadingInfo.voteCount > 0) {
          const color = candidateColorMap.get(leadingInfo.name) || baseColor;
          const percentage = leadingInfo.voteCount / (leadingInfo.totalVotes || 1);
          const opacity = Math.min(0.85, Math.max(0.45, percentage));
          return {
            fillColor: color,
            fillOpacity: opacity,
            color: isDark ? "#334155" : "#1e293b",
            weight: 1.5,
          };
        }
        
        return {
          fillColor: baseColor,
          fillOpacity: 0.4,
          color: isDark ? "#334155" : "#1e293b",
          weight: 1.5,
        };
      };

      const kabLayer = L.geoJSON(geo, {
        style: (feature: any) => {
          const idx = featureIdx++;
          feature.properties._styleIdx = idx; // Preserve index for mouseover style resolution
          return getKabupatenStyle(feature, idx);
        },
        onEachFeature: (feature: any, layer: any) => {
          const kabName = feature?.properties?.NAME_2 ?? feature?.properties?.name ?? feature?.properties?.KABUPATEN ?? "";
          const kUpper  = kabName.toUpperCase();
          const v = kabVoterMap.get(kUpper) ?? 0;
          const tpsCount = kabTpsMap.get(kUpper) ?? 0;

          layer.bindTooltip(
            `<div style="min-width:160px; padding:4px; pointer-events:none">
              <div style="margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid ${isDark ? "rgba(255,255,255,0.15)" : "#e2e8f0"}">
                <span style="font-size:10px; font-weight:900; color:#3b82f6; text-transform:uppercase; letter-spacing:0.05em">${t.district}</span>
                <strong class="tooltip-title" style="display:block; font-size:16px; margin-top:2px; color:${isDark ? "#fff" : "#000"}">${kabName}</strong>
              </div>
              <div style="display:flex; flex-direction:column; gap:6px">
                <div class="tooltip-row" style="display:flex; justify-content:space-between; align-items:center">
                  <span class="tooltip-label" style="color:${isDark ? "#94a3b8" : "#64748b"}; font-weight:600">${t.totalTps}</span>
                  <strong class="tooltip-value" style="color:#3b82f6; font-size:14px; font-weight:800">${tpsCount.toLocaleString("id-ID")}</strong>
                </div>
                <div class="tooltip-row" style="display:flex; justify-content:space-between; align-items:center">
                  <span class="tooltip-label" style="color:${isDark ? "#94a3b8" : "#64748b"}; font-weight:600">${t.inboundVotes}</span>
                  <strong class="tooltip-value" style="color:#8b5cf6; font-size:14px; font-weight:800">${v.toLocaleString("id-ID")}</strong>
                </div>
              </div>
            </div>`,
            { sticky: true, opacity: 1, direction: "top", offset: [0, -10], className: "premium-tooltip" }
          );

          layer.on({
            mouseover: (e: any) => {
              const idx = feature.properties._styleIdx ?? 0;
              const origStyle = getKabupatenStyle(feature, idx);
              e.target.setStyle({ 
                ...origStyle,
                fillOpacity: 0.95, 
                weight: 3, 
                color: "#f59e0b" 
              });
            },
            mouseout:  (e: any) => {
              kabLayer.resetStyle(e.target);
            },
            click: (e: any) => {
              map.fitBounds(e.target.getBounds(), { padding: [20, 20], maxZoom: 12 });
              onProvinsiClick(provName, kabName);
            },
          });
        },
      }).addTo(map);

      kabLayerRef.current = kabLayer;
      setCurrentLevel("kabupaten");
      setActiveProvName(provName);
    } catch (err) {
      console.warn("[Map] Failed to load kabupaten GeoJSON:", err);
      // Still open province panel even if kabupaten GeoJSON fails
    } finally {
      setLoadingKab(false);
    }
  }, [data, onProvinsiClick]);

  const resetToProvince = useCallback(() => {
    const pl = provLayerRef.current;
    if (!pl) return;
    pl.eachLayer((l: any) => {
      const raw = l.feature?.properties?.state ?? l.feature?.properties?.name ?? "";
      const style = getProvinceStyle(raw);
      l.setStyle({
        ...style,
        fillOpacity: style.fillOpacity * 0.8,
        weight: 0.8
      });
    });
    if (kabLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(kabLayerRef.current);
      kabLayerRef.current = null;
    }
    setCurrentLevel("provinsi");
    setActiveProvName(null);
  }, [getProvinceStyle]);

  // ── Init Leaflet ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Clear any previous Leaflet instance from the container (React strict mode / HMR)
    if ((containerRef.current as any)._leaflet_id) {
      (containerRef.current as any)._leaflet_id = undefined;
    }

    (async () => {
      const L = await import("leaflet");
      // @ts-ignore
      await import("leaflet/dist/leaflet.css");
      LRef.current = L;

      if (mapRef.current) return; // double-check after async

      const map = L.map(containerRef.current!, {
        center: [-2.5, 118], zoom: 5,
        zoomControl: false, attributionControl: false,
        minZoom: 4, maxZoom: 14,
        preferCanvas: true, // Crucial for performance with many GeoJSON features
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 120,
        scrollWheelZoom: false // Disable by default to prevent scroll trap
      });

      const zoomCtrl = L.control.zoom({ position: "bottomright" }).addTo(map);

      // Create a custom pane for labels to ensure they appear OVER the vector layers (GeoJSON)
      const labelsPane = map.createPane("labelsPane");
      labelsPane.style.zIndex = "650"; // Higher than standard vectors (400) but lower than tooltips (700)
      labelsPane.style.pointerEvents = "none"; // Ensure clicks pass through to interactable GeoJSON underneath

      const baseLayer = L.tileLayer(isDark ? TILE_DARK_BASE : TILE_LIGHT_BASE, { 
        subdomains: "abcd", 
        maxZoom: 19,
        updateWhenZooming: false,
        updateWhenIdle: true,
        keepBuffer: 8 // Keep more tiles in memory to prevent white gaps
      }).addTo(map);
      tileLayerRef.current = baseLayer;
      // Use Google Maps for translated labels (lyrs=h for labels/roads only)
      // Initial render uses the current lang closure
      const glang = lang === "zh" ? "zh-CN" : lang;
      const LABEL_URL = `https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}&hl=${glang}`;

      const labelLayer = L.tileLayer(LABEL_URL, {
        pane: "labelsPane",
        subdomains: "abcd",
        maxZoom: 19,
        updateWhenZooming: false,
        updateWhenIdle: true,
        className: isDark ? "google-labels-dark" : "google-labels-light"
      }).addTo(map);
      labelLayerRef.current = labelLayer;

      mapRef.current = map;

      // ── Province GeoJSON ──
      const provRes = await fetch("/indonesia.geojson");
      const provGeo = await provRes.json();

      const provLayer = L.geoJSON(provGeo, {
        style: (f: any) => {
          const raw = f?.properties?.state ?? f?.properties?.name ?? "";
          return getProvinceStyle(raw);
        },
        onEachFeature: (feature: any, layer: any) => {
          const provName = feature?.properties?.state ?? feature?.properties?.name ?? "";
          
          const info = getProvInfo(provName);
          const v = info?.totalVoters ?? 0;
          const tps = info?.totalTPS ?? 0;

          layer.on({
            mouseover: (e: any) => {
              e.target.setStyle({ fillOpacity: 0.9, weight: 2, color: "#3b82f6" });
              
              // Get LATEST info from the current data ref
              const freshInfo = getProvInfo(provName);
              const now = Math.floor(Date.now() / 1000);
              
              const activeCount = freshInfo?.tpsList?.filter((t: any) => 
                now >= t.startTime && now <= t.endTime
              ).length || 0;
              
              const inactiveCount = freshInfo?.tpsList?.filter((t: any) => 
                now > t.endTime
              ).length || 0;
              
              setActiveHoverInfo({ 
                name: provName, 
                tps: freshInfo?.totalTPS || 0, 
                voters: freshInfo?.totalVoters || 0,
                registeredVoters: freshInfo?.registeredVoters || 0,
                active: activeCount,
                inactive: inactiveCount
              });
            },
            mouseout: (e: any) => {
              e.target.setStyle({ fillOpacity: 0.85, weight: 1.2, color: isDark ? "#475569" : "#64748b" });
              setActiveHoverInfo(null);
            },
            click: (e: any) => {
              map.fitBounds(e.target.getBounds(), { padding: [40, 40], maxZoom: 9 });
              loadKabupatenGeoJSON(provName);
              onProvinsiClick(provName);
            },
          });
        },
      }).addTo(map);
      provLayerRef.current = provLayer;

      // Reset on zoom out
      map.on("zoomend", () => {
        const z = map.getZoom();
        if (z <= 5 && kabLayerRef.current) {
          resetToProvince();
        }
      });

      // Enable scroll zoom only when user explicitly interacts with the map (mousedown)
      // and disable when mouse leaves to prevent page scroll trap
      map.on("mousedown", () => {
        map.scrollWheelZoom.enable();
      });
      map.on("mouseout", () => {
        map.scrollWheelZoom.disable();
      });
    })();

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []); // eslint-disable-line

  // Dynamically update map labels based on language and theme changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    if (labelLayerRef.current) {
      map.removeLayer(labelLayerRef.current);
      labelLayerRef.current = null;
    }

    const L = LRef.current;
    if (!L) return;

    const glang = lang === "zh" ? "zh-CN" : lang;
    const LABEL_URL = `https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}&hl=${glang}`;

    const newLabelLayer = L.tileLayer(LABEL_URL, {
      pane: "labelsPane",
      maxZoom: 19,
      updateWhenZooming: false,
      updateWhenIdle: true,
      className: isDark ? "google-labels-dark" : "google-labels-light"
    }).addTo(map);

    labelLayerRef.current = newLabelLayer;
  }, [lang, isDark]);


  // Update province layer colors when data changes
  useEffect(() => {
    const pl = provLayerRef.current;
    if (!pl || currentLevel !== "provinsi") return;
    pl.eachLayer((l: any) => {
      const raw = l.feature?.properties?.state ?? l.feature?.properties?.name ?? "";
      const style = getProvinceStyle(raw);
      l.setStyle({
        ...style,
        fillOpacity: style.fillOpacity * 0.8,
        weight: 0.8
      });
    });
  }, [data, currentLevel, getProvinceStyle]);

  // Memoized Overseas Data Group
  const overseasData = useMemo(() => {
    return data.find(p => p.provinsi.toUpperCase() === "LUAR NEGERI");
  }, [data]);

  // ── Sync Theme (isDark) without re-mounting ──
  useEffect(() => {
    if (tileLayerRef.current) tileLayerRef.current.setUrl(isDark ? TILE_DARK_BASE : TILE_LIGHT_BASE);
    
    // Efficiently update GeoJSON borders and fill colors
    if (provLayerRef.current) {
      provLayerRef.current.eachLayer((l: any) => {
        const raw = l.feature?.properties?.state ?? l.feature?.properties?.name ?? "";
        const style = getProvinceStyle(raw);
        if (currentLevelRef.current === "kabupaten") {
          l.setStyle({ fillOpacity: 0, color: "transparent", weight: 0 });
        } else {
          l.setStyle({
            ...style,
            fillOpacity: style.fillOpacity * 0.8,
            weight: 0.8
          });
        }
      });
    }
    if (kabLayerRef.current) {
      kabLayerRef.current.setStyle({ color: isDark ? "#334155" : "#1e293b" });
    }
  }, [isDark, getProvinceStyle]);



  // ── Overseas Plotting Effect ──
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    // Cleanup any old markers layer group
    if (markersLayerRef.current) {
      map.removeLayer(markersLayerRef.current);
    }

    const markerGroup = L.featureGroup();

    if (overseasData?.tpsList?.length) {
      // Step 1: Group individual TPS records by City to draw single summarized pin per city
      const cityGrouping = new Map<string, any[]>();
      
      overseasData.tpsList.forEach(tps => {
        let cityName = String(tps.kotaDesa || "LUAR NEGERI").toUpperCase().trim();
        // Standardize "JEPANG - TOKYO" format into "TOKYO" if possible
        if (cityName.includes("-")) {
          cityName = cityName.split("-").pop()!.trim();
        }
        if (!cityGrouping.has(cityName)) {
          cityGrouping.set(cityName, []);
        }
        cityGrouping.get(cityName)!.push(tps);
      });

      // Step 2: Loop through each city group and create dynamic glowing markers
      cityGrouping.forEach((list, city) => {
        const coords = getTpsCoords(list[0]);
        if (!coords) return; // No coordinate mapping available

        const sumVotes = list.reduce((acc, cur) => acc + (cur.totalVoters || 0), 0);
        const totalCityTPS = list.length;

        // Premium dynamic Glowing Ring Icon
        const glowingRingIcon = L.divIcon({
          className: "ppln-marker-container",
          html: `<div class="ppln-pulse-marker">
                   <div class="ppln-pulse-core"></div>
                   <div class="ppln-pulse-ring"></div>
                 </div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        const marker = L.marker(coords, { icon: glowingRingIcon }).addTo(markerGroup);
        
        const displayName = city.toUpperCase().startsWith("PPLN") ? city : `PPLN ${city}`;

        // Bind a permanent map label (matches screenshot requirements)
        marker.bindTooltip(
          `<div style="text-align:center; pointer-events:none">
             <div style="font-size:13px; font-weight:900; letter-spacing:-0.01em; margin-bottom:2px">${displayName}</div>
             <div style="font-size:10px; font-weight:700; opacity:0.85">${t.tpsUnit || "TPS"} · ${totalCityTPS} | Voter · ${sumVotes.toLocaleString("id-ID")}</div>
           </div>`,
          { 
            permanent: true, 
            direction: "top", 
            offset: [0, -12],
            className: "ppln-permanent-tooltip"
          }
        );

        // Hover listeners to show regional detail legend on the left
        marker.on("mouseover", () => {
          const nowSec = Math.floor(Date.now() / 1000);
          const activeCount = list.filter((t: any) => nowSec >= t.startTime && nowSec <= t.endTime).length;
          const inactiveCount = list.filter((t: any) => nowSec > t.endTime).length;
          
          setActiveHoverInfo({
            name: displayName,
            tps: totalCityTPS,
            voters: sumVotes,
            registeredVoters: list.reduce((acc, cur) => acc + (cur.registeredVoters || 0), 0),
            active: activeCount,
            inactive: inactiveCount
          });
        });

        marker.on("mouseout", () => {
          setActiveHoverInfo(null);
        });

        // Interaction handler on Marker Click
        marker.on("click", () => {
          map.flyTo(coords, 7, { duration: 1.8 });
          onProvinsiClick("LUAR NEGERI", city);
        });
      });
    }

    markerGroup.addTo(map);
    markersLayerRef.current = markerGroup;
  }, [overseasData, LRef.current]); // eslint-disable-line

  // ── HOVER STATE (REMOVED - Reverting to Native Tooltips for stability) ──

  return (
    <div ref={wrapperRef} style={{ position:"relative", width:"100%", height:"100%", overflow:"hidden" }}>
      <div ref={containerRef} style={{ width:"100%", height:"100%", background: isDark ? "#020617" : "#f1f5f9" }} />

      {/* Floating Large Logo Top Left */}
      <div style={{ position:"absolute", top:20, left:20, zIndex:1200, display:"flex", alignItems:"center", gap:14, background:bgPanel, padding:"14px 20px", borderRadius:20, border:`1px solid ${borderColor}`, boxShadow:"0 4px 16px rgba(0,0,0,0.1)" }}>
        <img src="/kpu-logo.png" alt="KPU" style={{ width:48, height:48, objectFit:"contain" }} />
        <div>
          <h1 style={{ fontSize:18, fontWeight:900, color:textColor, letterSpacing:"-0.02em", lineHeight:1.1 }}>{t.title}</h1>
          <p style={{ fontSize:13, color:textMuted, fontWeight:600 }}>{t.subtitle}</p>
        </div>
      </div>

      {/* Loading indicator */}
      {loadingKab && (
        <div style={{ position:"absolute", top:16, left:"50%", transform:"translateX(-50%)", zIndex:1000, display:"flex", alignItems:"center", gap:8, padding:"8px 16px", background:bgPanel, borderRadius:12, border:`1px solid ${borderColor}`, boxShadow:"0 4px 12px rgba(0,0,0,0.1)", fontSize:13, fontWeight:600, color:textColor }}>
          <div style={{ width:14, height:14, border:"2px solid #3b82f6", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.6s linear infinite" }} />
          {t.loading}...
        </div>
      )}

      {/* Reset button */}
      {currentLevel === "kabupaten" && !loadingKab && (
        <button
          onClick={() => { mapRef.current?.setView([-2.5, 118], 5); resetToProvince(); }}
          style={{ position:"absolute", top:90, right:16, zIndex:1100, display:"flex", alignItems:"center", gap:6, padding:"6px 12px", background:bgPanel, border:`1px solid ${borderColor}`, borderRadius:12, fontSize:11, fontWeight:700, color:textColor, cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.1)" }}
        >
          ← {t.backToMap}
        </button>
      )}

      {/* ── TOP CENTER GLOBAL SEARCH ── */}
      <div style={{ position:"absolute", top:24, left:"50%", transform:"translateX(-50%)", zIndex:1500, width:"100%", maxWidth:480, padding:"0 20px" }}>
        <div style={{ position:"relative" }}>
          <div style={{ display:"flex", alignItems:"center", background:bgPanel, border:`1px solid ${borderColor}`, borderRadius:99, padding:"8px 18px", boxShadow:"0 10px 30px rgba(0,0,0,0.15)", transition:"all 0.3s" }}>
            <Search size={18} style={{ color:textMuted, marginRight:12 }} />
            <input 
              type="text" 
              className="global-search-input"
              placeholder={t.searchPlaceholder} 
              value={globalSearchQuery}
              onChange={e => { setGlobalSearchQuery(e.target.value); setShowGlobalResults(true); }}
              onFocus={() => setShowGlobalResults(true)}
              style={{ 
                flex:1, background:"none", border:"none", outline:"none", 
                color: isDark ? "#ffffff" : "#0f172a", 
                fontSize:14, fontWeight:600 
              }} 
            />
            {globalSearchQuery && (
              <button onClick={() => setGlobalSearchQuery("")} style={{ background:"none", border:"none", cursor:"pointer", color:textMuted }}>
                <X size={16} />
              </button>
            )}
          </div>

          <AnimatePresence>
            {showGlobalResults && globalResults.length > 0 && (
              <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }}
                style={{ position:"absolute", top:"110%", left:0, right:0, background:bgPanel, borderRadius:20, border:`1px solid ${borderColor}`, boxShadow:"0 20px 50px rgba(0,0,0,0.25)", overflow:"hidden", padding:8 }}>
                {globalResults.map((res, i) => (
                  <div key={res.tpsId} 
                    onClick={() => {
                      onProvinsiClick(res.parentProv, res.parentKab);
                      setGlobalSearchQuery("");
                      setShowGlobalResults(false);
                    }}
                    style={{ padding:"14px 18px", borderRadius:14, cursor:"pointer", transition:"all 0.15s", borderBottom: i < globalResults.length - 1 ? `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9"}` : "none" }}
                    onMouseEnter={e => { e.currentTarget.style.background = isDark ? "rgba(59,130,246,0.1)" : "#f0f7ff"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                  >
                    <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
                      <div style={{ width:40, height:40, borderRadius:12, background:isDark ? "rgba(59,130,246,0.15)":"#eff6ff", display:"flex", alignItems:"center", justifyContent:"center", color:"#3b82f6", fontWeight:900, fontSize:12, flexShrink:0, border:`1px solid ${isDark ? "rgba(59,130,246,0.2)":"#dbeafe"}` }}>#{res.tpsId}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                          <p style={{ fontWeight:900, color:textColor, fontSize:15, letterSpacing:"-0.01em" }}>{res.uniqueTPS}</p>
                          {(() => {
                            const now = Math.floor(Date.now() / 1000);
                            const isActive = now >= (res.startTime || 0) && now <= (res.endTime || 0);
                            return isActive ? (
                              <div style={{ display:"flex", alignItems:"center", gap:4, background:"#ecfdf5", padding:"2px 8px", borderRadius:99, border:"1px solid #a7f3d0" }}>
                                <div style={{ width:6, height:6, borderRadius:"50%", background:"#10b981", boxShadow:"0 0 8px #10b981", animation: "pulse 2s infinite" }} />
                                <span style={{ fontSize:9, fontWeight:800, color:"#047857", textTransform:"uppercase" }}>{t.live}</span>
                              </div>
                            ) : (
                              <div style={{ display:"flex", alignItems:"center", gap:4, background: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9", padding:"2px 8px", borderRadius:99, border:`1px solid ${isDark ? "#334155" : "#cbd5e1"}` }}>
                                <div style={{ width:6, height:6, borderRadius:"50%", background:"#94a3b8" }} />
                                <span style={{ fontSize:9, fontWeight:800, color: isDark ? "#94a3b8" : "#64748b", textTransform:"uppercase" }}>{t.closed}</span>
                              </div>
                            );
                          })()}
                        </div>
                        <p style={{ color:textMuted, fontSize:12, lineHeight:1.4, marginBottom:8, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{res.alamatLengkap || t.addressDetailHint}</p>
                        
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:10, fontWeight:700, color:isDark?"#94a3b8":"#64748b", background:isDark?"rgba(255,255,255,0.05)":"#f8fafc", padding:"2px 8px", borderRadius:6 }}>{getLocalizedProvince(res.parentProv, lang)}</span>
                          <span style={{ color:isDark?"#475569":"#cbd5e1" }}>•</span>
                          <span style={{ fontSize:10, fontWeight:700, color:"#3b82f6", background:isDark?"rgba(59,130,246,0.1)":"#eff6ff", padding:"2px 8px", borderRadius:6 }}>{getLocalizedAdminName(res.parentKab, lang)}</span>
                        </div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <p style={{ fontWeight:900, color:"#3b82f6", fontSize:16, letterSpacing:"-0.02em" }}>{res.totalVoters.toLocaleString("id-ID")}</p>
                        <p style={{ color:textMuted, fontSize:10, fontWeight:600 }}>{t.votes.toUpperCase()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Hint removed (moved to bottom ticker) */}

      {/* Top Right Controls */}
      <div style={{ position:"absolute", top:16, right:16, zIndex:1100, display:"flex", gap:8 }}>
        {/* Language Selection Toggle */}
        <div style={{ position:"relative" }}>
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            style={{ height:38, padding:"0 12px", background:bgPanel, border:`1px solid ${borderColor}`, borderRadius:12, display:"flex", alignItems:"center", gap:8, cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", color: textColor }}
          >
            <img 
              src={`https://flagcdn.com/w40/${languages.find(l => l.code === lang)?.flag}.png`} 
              alt="" 
              style={{ width:20, height:14, borderRadius:2, objectFit:"cover", boxShadow:"0 1px 3px rgba(0,0,0,0.1)" }} 
            />
            <span style={{ fontSize:11, fontWeight:800 }}>{languages.find(l => l.code === lang)?.name}</span>
          </button>
          
          <AnimatePresence>
            {showLangMenu && (
              <motion.div 
                initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:10 }}
                style={{ position:"absolute", top:"120%", right:0, background:bgPanel, borderRadius:16, border:`1px solid ${borderColor}`, boxShadow:"0 10px 30px rgba(0,0,0,0.2)", overflow:"hidden", padding:6, minWidth:180, zIndex:2000 }}
              >
                {languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => { onLanguageChange(l.code as Language); setShowLangMenu(false); }}
                    style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"none", background: lang === l.code ? (isDark ? "rgba(59,130,246,0.1)" : "#eff6ff") : "none", color: textColor, fontSize:12, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", transition:"all 0.15s" }}
                  >
                    <span style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <img 
                        src={`https://flagcdn.com/w40/${l.flag}.png`} 
                        alt="" 
                        style={{ width:20, height:14, borderRadius:2, objectFit:"cover", boxShadow:"0 1px 2px rgba(0,0,0,0.1)" }} 
                      />
                      {l.name}
                    </span>
                    {lang === l.code && <Check size={14} style={{ color:"#3b82f6" }} />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live Indicator & Connection Health */}
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"0 12px", height:38, background:bgPanel, border:`1px solid ${borderColor}`, borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.1)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize:11, fontWeight:800, color:textColor }}>{t.live}</span>
          </div>
          <div style={{ width:1, height:16, background:borderColor }} />
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background: "#10b981" }} />
            <span style={{ fontSize:10, fontWeight:700, color:textMuted }}>{t.connStable}</span>
          </div>
        </div>

        {/* Theme Toggle Button */}
        {onThemeToggle && (
          <button
            onClick={onThemeToggle}
            style={{ width:38, height:38, background:bgPanel, border:`1px solid ${borderColor}`, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", color: textColor }}
            title={t.toggleTheme}
          >
            {isDark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
              </svg>
            )}
          </button>
        )}

        {/* Full Screen Toggle Button */}
        <button
          onClick={toggleFullscreen}
          style={{ width:38, height:38, background:bgPanel, border:`1px solid ${borderColor}`, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", color: textColor }}
          title={isFullscreen ? t.exitFullscreen : t.fullscreen}
        >
          {isFullscreen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          )}
        </button>
      </div>

      {/* Floating Overseas (PPLN) Widget Top Right */}
      <div 
        onClick={() => {
          if (mapRef.current) {
            // Smoothly glide out to broad global vantage point containing Indonesia & surrounding world
            mapRef.current.flyTo([20, 115], 3.5, { duration: 2 });
          }
          onProvinsiClick("LUAR NEGERI");
        }}
        style={{ 
          position: "absolute", 
          top: 70, 
          right: 16, 
          zIndex: 1100, 
          display: "flex", 
          flexDirection: "column", 
          gap: 4, 
          background: bgPanel, 
          border: `1px solid ${borderColor}`, 
          borderRadius: 16, 
          padding: "12px 16px", 
          boxShadow: "0 6px 24px rgba(0,0,0,0.12)", 
          cursor: "pointer", 
          width: 200,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
        }}
        className="ppln-glass-card"
      >
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:10, background:"rgba(139, 92, 246, 0.15)", display:"flex", alignItems:"center", justifyContent:"center", color:"#8b5cf6" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
            </svg>
          </div>
          <div>
            <span style={{ fontSize:13, fontWeight:900, color:textColor, display:"block", lineHeight:1.2 }}>{t.overseas}</span>
            <p style={{ fontSize:9, color:textMuted, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.02em" }}>{t.overseasRecap}</p>
          </div>
        </div>
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${borderColor}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:11, color:textMuted, fontWeight:600 }}>{(overseasData?.totalTPS ?? 0)} {t.tpsUnit}</span>
          <span style={{ fontSize:12, fontWeight:900, color:"#8b5cf6" }}>{(overseasData?.totalVoters ?? 0).toLocaleString("id-ID")} <span style={{fontSize:10, color:textMuted}}>{t.inboundVotes}</span></span>
        </div>
      </div>

      {/* Stats + Legend box — bottom left raised */}
      <div style={{ position:"absolute", bottom:60, left:24, zIndex:1200, display:"flex", flexDirection:"column", gap:10 }}>
        <AnimatePresence>
          {activeHoverInfo && (
            <motion.div 
              initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }}
              style={{ background:bgPanel, border:`2px solid #3b82f6`, borderRadius:18, padding:"16px 20px", boxShadow:"0 12px 30px rgba(59,130,246,0.15)", width: 240, overflow:"hidden" }}
            >
              <p style={{ fontSize:10, fontWeight:900, color:"#3b82f6", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 }}>{t.regionDetail}</p>
              <h3 style={{ fontSize:20, fontWeight:900, color:textColor, marginBottom:12, letterSpacing:"-0.02em" }}>{getLocalizedProvince(activeHoverInfo.name, lang)}</h3>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:"#10b981", boxShadow:"0 0 6px #10b981" }} />
                    <span style={{ fontSize:11, color:textMuted, fontWeight:600 }}>{t.activeTps}</span>
                  </div>
                  <span style={{ fontSize:13, fontWeight:900, color:"#10b981" }}>{(activeHoverInfo.active ?? 0).toLocaleString("id-ID")}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:isDark ? "#475569" : "#cbd5e1" }} />
                    <span style={{ fontSize:11, color:textMuted, fontWeight:600 }}>{t.doneTps}</span>
                  </div>
                  <span style={{ fontSize:13, fontWeight:900, color:textMuted }}>{(activeHoverInfo.inactive ?? 0).toLocaleString("id-ID")}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:"#3b82f6" }} />
                    <span style={{ fontSize:11, color:textMuted, fontWeight:600 }}>{t.totalTps}</span>
                  </div>
                  <span style={{ fontSize:13, fontWeight:900, color:"#3b82f6" }}>{(activeHoverInfo.tps ?? 0).toLocaleString("id-ID")}</span>
                </div>
                <div style={{ height:1, background:borderColor, margin:"4px 0" }} />
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:11, color:textMuted, fontWeight:600 }}>{t.inboundVotes}</span>
                  <span style={{ fontSize:14, fontWeight:900, color:"#3b82f6" }}>{(activeHoverInfo.voters ?? 0).toLocaleString("id-ID")}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:10.5, color:textMuted, fontWeight:550 }}>{t.maxVotes}</span>
                  <span style={{ fontSize:13, fontWeight:800, color:textMuted }}>{(activeHoverInfo.registeredVoters ?? 0).toLocaleString("id-ID")}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Stats */}
        <div style={{ background:bgPanel, border:`1px solid ${borderColor}`, borderRadius:18, padding:"12px 14px", boxShadow:"0 10px 30px rgba(0,0,0,0.12)", width: 240 }}>
          <p style={{ fontWeight:800, color:textMuted, textTransform:"uppercase", letterSpacing:"0.1em", fontSize:9, marginBottom:10, opacity: 0.8 }}>{t.nationalData}</p>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <StatCard icon={<MapPin size={16}/>} label={t.totalTps} val={totalTPS.toLocaleString("id-ID")} unit={t.tpsUnit} color="blue" isDark={isDark} />
            <StatCard icon={<Users size={16}/>} label={t.inboundVotes} val={totalVoters.toLocaleString("id-ID")} unit={t.votes} subValue={`${t.maxVotes}: ${registeredVoters.toLocaleString("id-ID")}`} color="violet" isDark={isDark} />
          </div>
          {lastRefresh && (
            <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#f1f5f9"}` }}>
              <p style={{ fontSize: 11, color:textMuted, fontWeight:600 }} suppressHydrationWarning>
                {t.lastUpdated}: {lastRefresh.toLocaleTimeString(lang === "id" ? "id-ID" : lang === "ko" ? "ko-KR" : lang === "zh" ? "zh-CN" : lang === "ja" ? "ja-JP" : lang === "ar" ? "ar-SA" : "en-US")}
              </p>
              <p style={{ fontSize: 11.5, color: "#3b82f6", fontWeight:800, marginTop:4 }}>
                {t.nextUpdate}: {Math.floor(nextUpdate / 60)}m {nextUpdate % 60}s
              </p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{ background:bgPanel, border:`1px solid ${borderColor}`, borderRadius:16, padding:"12px 16px", boxShadow:"0 4px 12px rgba(0,0,0,0.12)", fontSize:11, color:textColor, width: 220 }}>
          <p style={{ fontWeight:900, color:textMuted, textTransform:"uppercase", letterSpacing:"0.1em", fontSize:9, marginBottom:8 }}>{t.legendTitle || "LEGEND"}</p>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {presidentialCandidates.map((cand, idx) => {
              const color = candidateColorMap.get(cand.name) || "#cbd5e1";
              return (
                <div key={cand.name} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:10, height:10, borderRadius:2, flexShrink:0, background:color, boxShadow: `0 0 6px ${color}44` }} />
                  <span style={{ fontWeight:700, fontSize:10.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {cand.name}
                  </span>
                </div>
              );
            })}
            {presidentialCandidates.length === 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ width:10, height:10, borderRadius:2, flexShrink:0, background:"#3b82f6" }} />
                <span style={{ fontWeight:700, fontSize:10.5, color:textMuted }}>Kandidat 1</span>
              </div>
            )}
            <div style={{ height:1, background:borderColor, margin:"4px 0" }} />
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ width:10, height:10, borderRadius:2, flexShrink:0, background: isDark ? "#475569" : "#cbd5e1" }} />
              <span style={{ fontWeight:500, fontSize:10.5, color:textMuted }}>{t.legendNoData || "Belum ada data"}</span>
            </div>
          </div>
        </div>
      </div>


      <style>{`
        .leaflet-tooltip.ppln-permanent-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          color: ${isDark ? "#ffffff" : "#0f172a"} !important;
          font-weight: 800 !important;
          font-family: inherit !important;
          text-shadow: ${isDark 
            ? "-1px -1px 0 #0f172a, 1px -1px 0 #0f172a, -1px 1px 0 #0f172a, 1px 1px 0 #0f172a, 0 2px 4px rgba(0,0,0,0.5)" 
            : "-1px -1px 0 #ffffff, 1px -1px 0 #ffffff, -1px 1px 0 #ffffff, 1px 1px 0 #ffffff, 0 2px 4px rgba(0,0,0,0.2)"
          } !important;
          padding: 0 !important;
          text-align: center !important;
          pointer-events: none !important;
        }
        .leaflet-tooltip.slim-tooltip {
          background: ${bgPanel} !important;
          border: 1px solid ${borderColor} !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
          padding: 6px 10px !important;
          pointer-events: none !important;
        }
        .leaflet-tooltip-top.slim-tooltip::before {
          border-top-color: ${borderColor} !important;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }
        .leaflet-container {
          background: ${isDark ? "#0f172a" : "#f8fafc"} !important;
        }
        .leaflet-bottom.leaflet-right {
          bottom: 110px !important;
          right: 20px !important;
        }
        .leaflet-control-zoom a {
          background-color: ${isDark ? "#1e293b" : "#fff"} !important;
          color: ${isDark ? "#f1f5f9" : "#000"} !important;
          border-color: ${isDark ? "#334155" : "#ccc"} !important;
        }
        /* Tooltip Dinamis Mode Terang/Gelap */
        /* REKONSTRUKSI TOTAL TOOLTIP: ANTI-OVERLAP */
        .leaflet-tooltip.premium-tooltip {
          background-color: ${isDark ? "#0f172a" : "#ffffff"} !important;
          opacity: 1 !important;
          border: 2px solid ${isDark ? "#334155" : "#3b82f6"} !important;
          border-radius: 12px !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1) !important;
          padding: 16px !important;
          pointer-events: none !important;
          visibility: visible !important;
          z-index: 9999 !important;
        }
        .leaflet-tooltip-pane {
          z-index: 9999 !important; /* Force tooltip pane to top */
        }
        .leaflet-pane.labelsPane {
          z-index: 600 !important; /* Ensure labels are far below tooltips */
          opacity: 0.7;
        }
        .tooltip-title {
          font-weight: 800;
          display: block;
          margin-bottom: 4px;
          font-size: 14px;
          color: ${isDark ? "#ffffff" : "#000000"};
        }
        .tooltip-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          font-size: 12px;
        }
        .tooltip-label {
          color: ${isDark ? "#cbd5e1" : "#475569"};
          font-weight: 600;
        }
        .tooltip-value {
          font-weight: 800;
        }
        
        /* Premium Glass Card Animations */
        .ppln-glass-card:hover {
          transform: translateY(-3px);
          border-color: #8b5cf6 !important;
          box-shadow: 0 12px 32px rgba(139, 92, 246, 0.18) !important;
        }
        .ppln-glass-card:active {
          transform: translateY(-1px);
        }
        
        /* Global PPLN Pulsing Markers */
        .ppln-marker-container {
          background: transparent !important;
          border: none !important;
        }
        .ppln-pulse-marker {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          position: relative;
        }
        .ppln-pulse-core {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #8b5cf6; /* Premium Violet core */
          box-shadow: 0 0 8px rgba(139, 92, 246, 0.8);
          z-index: 5;
        }
        .ppln-pulse-ring {
          border: 3px solid #8b5cf6;
          border-radius: 50%;
          height: 24px;
          width: 24px;
          position: absolute;
          animation: ppln-pulsate 1.6s cubic-bezier(0.24, 0, 0.38, 1) infinite;
          opacity: 0;
          z-index: 4;
        }
        @keyframes ppln-pulsate {
          0% { transform: scale(0.2); opacity: 0.9; }
          80% { opacity: 0; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        .global-search-input::placeholder {
          color: ${isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"};
        }
        .google-labels-light {
          filter: opacity(0.75);
        }
        .google-labels-dark {
          filter: invert(100%) hue-rotate(180deg) opacity(0.85);
        }
      `}</style>
    </div>
  );
}
