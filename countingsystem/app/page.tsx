"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Users, BarChart3, Search, X, Trophy } from "lucide-react";
import IndonesiaMap from "@/components/IndonesiaMap";
import ProvincePanel from "@/components/ProvincePanel";
import NasionalTicker from "@/components/NasionalTicker";
import AIChatAssistant from "@/components/AIChatAssistant";

import type { NasionalResult, ProvinsiResult } from "@/lib/aggregator";
import { translations, type Language } from "@/constants/translations";

export default function DashboardPage() {
  const [lang,             setLang]             = useState<Language>("id");
  const t = translations[lang];

  const [data,             setData]             = useState<NasionalResult | null>(null);
  const [selectedProvinsi, setSelectedProvinsi] = useState<string | null>(null);
  const [selectedData,     setSelectedData]     = useState<ProvinsiResult | null>(null);
  const [isLoading,        setIsLoading]        = useState(true);
  const [lastRefresh,      setLastRefresh]      = useState<Date | null>(null);
  const [nextUpdate,       setNextUpdate]       = useState<number>(300); // Seconds until next update (5 minutes)
  const [isDark,           setIsDark]           = useState(false);
  const tickerRef = useRef<HTMLElement>(null);

  const [selectedKabName,  setSelectedKabName]  = useState<string | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenDrawer, setShowFullscreenDrawer] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (!active) {
        setShowFullscreenDrawer(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const selectedProvinsiRef = useRef(selectedProvinsi);
  selectedProvinsiRef.current = selectedProvinsi;

  const fetchData = useCallback(async (force = false, isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    try {
      const url  = force ? "/api/results?refresh=1" : "/api/results";
      const res  = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setData(json as NasionalResult);
        setLastRefresh(new Date());
        setNextUpdate(300); // Reset timer to 300s (5 minutes)
        const currentProv = selectedProvinsiRef.current;
        if (currentProv) {
          const found = (json.byProvinsi as ProvinsiResult[]).find(
            p => p.provinsi.toUpperCase() === currentProv.toUpperCase()
          );
          if (found) setSelectedData(found);
        }
      }
    } catch (e) { console.error(e); }
    finally { if (!isBackground) setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, []);

  // Auto-Refresh Timer: Counts down every second and background force refreshes data every 5 minutes (300s)
  useEffect(() => {
    const timer = setInterval(() => {
      setNextUpdate(prev => {
        if (prev <= 1) {
          fetchData(true, true); // Trigger background force refresh
          return 300; // Reset to 5 minutes
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const handleProvinsiClick = (name: string, kabupaten?: string) => {
    const normalize = (nStr: string): string => {
      if (!nStr) return "";
      let n = nStr.toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
      n = n.replace(/^(DI|DKI|DAERAHKHUSUSIBUKOTA|DAERAHISTIMEWA)/, "");
      if (n.includes("JAKARTA")) return "JAKARTA";
      if (n.includes("YOGYAKARTA")) return "DIYOGYAKARTA";
      if (n.includes("BANGKABELITUNG")) return "KEPULAUANBANGKABELITUNG";
      return n;
    };

    const target = normalize(name);
    const found = data?.byProvinsi.find(p => normalize(p.provinsi) === target);
    setSelectedProvinsi(name);
    setSelectedKabName(kabupaten || null);
    setSelectedData(found ?? { provinsi: name, totalTPS: 0, totalVoters: 0, registeredVoters: 0, kabupatenList: [], tpsList: [], categories: [] });
  };

  const tpsStats = useMemo(() => {
    const now = Date.now() / 1000;
    const allTps = data?.byProvinsi.flatMap(p => p.tpsList) ?? [];
    const active   = allTps.filter(t => t.endTime > now).length;
    const inactive = allTps.filter(t => t.endTime <= now).length;
    return { active, inactive };
  }, [data]);


  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${isDark ? "bg-slate-950 text-slate-100 dark" : "bg-slate-50 text-slate-900"}`}>




      {/* ── MAP SECTION (full screen) ── */}
      <section style={{ position: "relative", height: "100vh" }}>
        {isLoading && !data ? (
          <div className={`h-full flex flex-col items-center justify-center transition-colors duration-300 ${isDark ? "bg-slate-950" : "bg-white"}`}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-10"
            >
              {/* Logo at Center */}
              <motion.img 
                src="/kpu-logo.png" 
                alt="KPU" 
                style={{ width: 140, height: 140, objectFit: "contain" }}
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              />
              
              {/* Spinner & Text below */}
              <div className="flex flex-col items-center gap-5">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                  <h2 className={`text-xl font-extrabold tracking-tight ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                    {t.loading}
                  </h2>
                  <p className={`text-sm font-medium mt-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {t.loadingSub}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full">
            <IndonesiaMap
              data={data?.byProvinsi ?? []}
              onProvinsiClick={handleProvinsiClick}
              selectedProvinsi={selectedProvinsi}
              totalTPS={data?.totalTPS ?? 0}
              totalVoters={data?.totalVoters ?? 0}
              registeredVoters={data?.registeredVoters ?? 0}
              activeProvinsi={data?.byProvinsi.filter(p => p.totalVoters > 0).length ?? 0}
              activeTPS={tpsStats.active}
              inactiveTPS={tpsStats.inactive}
              lastRefresh={lastRefresh}
              nextUpdate={nextUpdate}
              isDark={isDark}
              onThemeToggle={() => setIsDark(!isDark)}
              lang={lang}
              onLanguageChange={setLang}
            />
          </motion.div>
        )}
      </section>

      {/* ── AI ASSISTANT BOT ── */}
      {data && (
        <AIChatAssistant
          data={data}
          isDark={isDark}
          lang={lang}
          onActionTrigger={(action, args) => {
            if (action === "buka_wilayah") {
              handleProvinsiClick(args.provinsi, args.kabupaten);
            }
          }}
        />
      )}

      {/* ── PANEL ── */}
      <ProvincePanel
        provinsi={selectedData}
        initialKabupaten={selectedKabName}
        onClose={() => { setSelectedProvinsi(null); setSelectedData(null); setSelectedKabName(null); }}
        isDark={isDark}
        lang={lang}
      />

      {/* ── VERTICAL FLOATING HANDLE (RIGHT MIDDLE) ── */}
      <AnimatePresence>
        {!showFullscreenDrawer && (
          <div
            style={{
              position: "fixed",
              top: "50%",
              right: 0,
              transform: "translateY(-50%)",
              zIndex: 9999,
              pointerEvents: "auto"
            }}
          >
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              onClick={() => setShowFullscreenDrawer(true)}
              style={{
                background: isDark ? "rgba(59, 130, 246, 0.92)" : "rgba(37, 99, 235, 0.96)",
                color: "#ffffff",
                padding: "20px 10px 20px 14px",
                borderTopLeftRadius: 20,
                borderBottomLeftRadius: 20,
                cursor: "pointer",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRight: "none"
              }}
              whileHover={{ scale: 1.05, background: isDark ? "rgba(59, 130, 246, 1)" : "rgba(37, 99, 235, 1)", x: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Trophy size={16} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }} />
              <span
                style={{
                  writingMode: "vertical-rl",
                  textTransform: "uppercase",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: "0.18em",
                  whiteSpace: "nowrap"
                }}
              >
                {t.candidateDetailsAndCharts}
              </span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── FULL SCREEN CANDIDATE DETAILS SLIDING DRAWER (FROM RIGHT) ── */}
      <AnimatePresence>
        {showFullscreenDrawer && data && (
          <>
            {/* Backdrop / Overlay to allow clicking outside to close when clicking the map on the left */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFullscreenDrawer(false)}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: isDark ? "rgba(0, 0, 0, 0.4)" : "rgba(0, 0, 0, 0.2)",
                backdropFilter: "blur(2px)",
                zIndex: 99998,
                cursor: "pointer"
              }}
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                height: "100vh",
                width: "85vw",
                minWidth: 800,
                maxWidth: 1600,
                background: isDark ? "rgba(15, 23, 42, 0.98)" : "rgba(255, 255, 255, 0.99)",
                borderLeft: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}`,
                boxShadow: isDark ? "-15px 0 40px rgba(0,0,0,0.6)" : "-15px 0 40px rgba(0,0,0,0.12)",
                backdropFilter: "blur(16px)",
                zIndex: 99999,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden"
              }}
            >
              {/* Drawer Header */}
              <div style={{ padding: "16px 24px", borderBottom: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Trophy size={18} color="#f59e0b" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))" }} />
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: isDark ? "#ffffff" : "#0f172a" }}>
                      {t.nationalResultsAndParticipation}
                    </h3>
                  </div>
                  {lastRefresh && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 28 }}>
                      <span style={{ fontSize: 11, color: isDark ? "#94a3b8" : "#64748b", fontWeight: 500 }} suppressHydrationWarning>
                        {t.lastUpdated}: {lastRefresh.toLocaleTimeString(lang === "id" ? "id-ID" : lang === "ko" ? "ko-KR" : lang === "zh" ? "zh-CN" : lang === "ja" ? "ja-JP" : lang === "ar" ? "ar-SA" : "en-US")}
                      </span>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: isDark ? "#475569" : "#cbd5e1" }} />
                      <span style={{ fontSize: 11, color: "#3b82f6", fontWeight: 700 }}>
                        {t.nextUpdate}: {Math.floor(nextUpdate / 60)}m {nextUpdate % 60}s
                      </span>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => setShowFullscreenDrawer(false)}
                  style={{ 
                    background: isDark ? "#1e293b" : "#f1f5f9", 
                    border: "none", 
                    borderRadius: "50%", 
                    width: 32, 
                    height: 32, 
                    cursor: "pointer", 
                    color: isDark ? "#cbd5e1" : "#475569", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    transition: "background 0.2s"
                  }}
                  title={t.close}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable Container containing exactly the same NasionalTicker */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
                <NasionalTicker 
                  data={data} 
                  isDark={isDark} 
                  lang={lang} 
                  isInsideDrawer={true}
                  isFullscreen={isFullscreen}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}


