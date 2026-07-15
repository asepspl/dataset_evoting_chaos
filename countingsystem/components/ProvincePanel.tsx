"use client";

import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Users, BarChart3, Building2, ChevronRight, ArrowLeft, Navigation, Search, X, Vote } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import type { ProvinsiResult, KabupatenResult, KecamatanResult, KelurahanResult, CategoryResult, TpsResult } from "@/lib/aggregator";

import StatCard from "@/components/shared/StatCard";
import CategoryCharts from "./panel/CategoryCharts";
import TpsDetailCard from "./panel/TpsDetailCard";
import WilayahItem from "./panel/WilayahItem";
import { PALETTE } from "@/lib/color-utils";
import { translations, type Language, type Translations, getCategoryLabel } from "@/constants/translations";
import { getLocalizedProvince, getLocalizedAdminName } from "@/constants/provinces";

type DrillLevel = "provinsi" | "kabupaten" | "kecamatan" | "kelurahan" | "tps";
interface BreadcrumbItem { level: DrillLevel; label: string; }

function explodeCategories(categories: CategoryResult[], t: Translations): CategoryResult[] {
  const result: CategoryResult[] = [];
  categories.forEach((cat) => {
    const localizedLabel = getCategoryLabel(cat.categoryType, cat.label, t);
    const isLeg = [1, 3, 4].includes(cat.categoryType);
    if (!isLeg) { result.push({ ...cat, label: localizedLabel }); return; }
    const parties = cat.candidates.filter(c => (c.description || "").toLowerCase().includes("coblos gambar"));
    const individuals = cat.candidates.filter(c => !(c.description || "").toLowerCase().includes("coblos gambar"));
    if (parties.length > 0) {
      const totalPartyVotes = parties.reduce((s, c) => s + c.voteCount, 0);
      result.push({ ...cat, label: `${localizedLabel} ${t.partySuffix}`, totalVotes: totalPartyVotes, candidates: parties.map(c => ({ ...c, percentage: totalPartyVotes > 0 ? Math.round((c.voteCount / totalPartyVotes) * 1000) / 10 : 0 })) });
    }
    if (individuals.length > 0 || parties.length === 0) {
      const totalIndivVotes = individuals.reduce((s, c) => s + c.voteCount, 0);
      result.push({ ...cat, label: parties.length > 0 ? `${localizedLabel} ${t.calegSuffix}` : localizedLabel, totalVotes: totalIndivVotes, candidates: individuals.map(c => ({ ...c, percentage: totalIndivVotes > 0 ? Math.round((c.voteCount / totalIndivVotes) * 1000) / 10 : 0 })) });
    }
  });
  return result;
}

interface ProvincePanelProps {
  provinsi: ProvinsiResult | null;
  initialKabupaten?: string | null;
  onClose: () => void;
  isDark?: boolean;
  lang: Language;
}

export default function ProvincePanel({ provinsi, initialKabupaten = null, onClose, isDark = false, lang }: ProvincePanelProps) {
  const t = translations[lang];
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [selectedKab, setSelectedKab] = useState<KabupatenResult | null>(null);
  const [selectedKec, setSelectedKec] = useState<KecamatanResult | null>(null);
  const [selectedKel, setSelectedKel] = useState<KelurahanResult | null>(null);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSearchTps, setSelectedSearchTps] = useState<TpsResult | null>(null);
  const [activeTpsIdx, setActiveTpsIdx] = useState(0);

  const resetDrill = () => { setBreadcrumbs([]); setSelectedKab(null); setSelectedKec(null); setSelectedKel(null); setActiveTabIdx(0); setSearchQuery(""); setSelectedSearchTps(null); setActiveTpsIdx(0); };

  useEffect(() => {
    if (provinsi && initialKabupaten) {
      setSelectedKec(null); setSelectedKel(null);
      const kabName = initialKabupaten.toUpperCase();
      const found = provinsi.kabupatenList?.find(k => k.kabupaten.toUpperCase().includes(kabName) || kabName.includes(k.kabupaten.toUpperCase()));
      if (found) { setSelectedKab(found); setBreadcrumbs([{ level: "provinsi", label: getLocalizedProvince(provinsi.provinsi, lang) }]); }
    }
  }, [initialKabupaten, provinsi]);

  // Synchronize drilled-down items with latest provinsi data from props
  useEffect(() => {
    if (!provinsi) {
      setSelectedKab(null);
      setSelectedKec(null);
      setSelectedKel(null);
      return;
    }
    if (selectedKab) {
      const updatedKab = provinsi.kabupatenList?.find(
        k => k.kabupaten.toUpperCase() === selectedKab.kabupaten.toUpperCase()
      );
      if (updatedKab) {
        setSelectedKab(updatedKab);
        if (selectedKec) {
          const updatedKec = updatedKab.kecamatanList?.find(
            kc => kc.kecamatan.toUpperCase() === selectedKec.kecamatan.toUpperCase()
          );
          if (updatedKec) {
            setSelectedKec(updatedKec);
            if (selectedKel) {
              const updatedKel = updatedKec.kelurahanList?.find(
                kl => kl.kelurahan.toUpperCase() === selectedKel.kelurahan.toUpperCase()
              );
              if (updatedKel) {
                setSelectedKel(updatedKel);
              }
            }
          }
        }
      }
    }
  }, [provinsi]);

  const themeBg = isDark ? "#020617" : "#f8fafc";
  const themePanelBg = isDark ? "#0f172a" : "#fff";
  const themeBorder = isDark ? "#1e293b" : "#e2e8f0";
  const themeText = isDark ? "#f1f5f9" : "#0f172a";
  const themeTextMuted = isDark ? "#94a3b8" : "#64748b";

  const allTpsList = useMemo(() => {
    if (!provinsi) return [];
    // If top-level tpsList is empty, we must flatten it from kabupatenList
    if (provinsi.tpsList && provinsi.tpsList.length > 0) return provinsi.tpsList;
    
    const flattened: TpsResult[] = [];
    provinsi.kabupatenList?.forEach(kab => {
      kab.kecamatanList?.forEach(kec => {
        kec.kelurahanList?.forEach(kel => {
          if (kel.tpsList) flattened.push(...kel.tpsList);
        });
        if (kec.tpsList) flattened.push(...kec.tpsList);
      });
    });
    return flattened;
  }, [provinsi]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    if (q.length < 2) return [];
    
    return allTpsList.filter((tps: TpsResult) => {
      return (
        (tps.uniqueTPS?.toUpperCase() || "").includes(q) ||
        String(tps.tpsId || "").includes(q) ||
        (tps.kotaDesa?.toUpperCase() || "").includes(q) ||
        (tps.kecamatan?.toUpperCase() || "").includes(q) ||
        (tps.kelurahan?.toUpperCase() || "").includes(q) ||
        (tps.alamatLengkap?.toUpperCase() || "").includes(q)
      );
    });
  }, [allTpsList, searchQuery]);

  const currentLevel: DrillLevel = selectedKel ? "kelurahan" : selectedKec ? "kecamatan" : selectedKab ? "kabupaten" : "provinsi";
  const currentCategories = selectedKel?.categories ?? selectedKec?.categories ?? selectedKab?.categories ?? provinsi?.categories ?? [];
  const currentTPS = selectedKel?.totalTPS ?? selectedKec?.totalTPS ?? selectedKab?.totalTPS ?? provinsi?.totalTPS ?? 0;
  const currentVoters = selectedKel?.totalVoters ?? selectedKec?.totalVoters ?? selectedKab?.totalVoters ?? provinsi?.totalVoters ?? 0;
  const currentMaxVoters = selectedKel?.registeredVoters ?? selectedKec?.registeredVoters ?? selectedKab?.registeredVoters ?? provinsi?.registeredVoters ?? 0;
  const currentTitle = selectedKel ? getLocalizedAdminName(selectedKel.kelurahan, lang) : selectedKec ? getLocalizedAdminName(selectedKec.kecamatan, lang) : selectedKab ? getLocalizedAdminName(selectedKab.kabupaten, lang) : getLocalizedProvince(provinsi?.provinsi ?? "", lang);

  const navigateToKab = (kab: KabupatenResult) => { setSelectedKab(kab); setSelectedKec(null); setSelectedKel(null); setActiveTabIdx(0); setActiveTpsIdx(0); setBreadcrumbs([{ level:"provinsi", label: getLocalizedProvince(provinsi?.provinsi ?? "", lang) }]); };
  const navigateToKec = (kec: KecamatanResult) => { setSelectedKec(kec); setSelectedKel(null); setActiveTabIdx(0); setActiveTpsIdx(0); setBreadcrumbs([{ level:"provinsi", label: getLocalizedProvince(provinsi?.provinsi ?? "", lang) }, { level:"kabupaten", label: selectedKab?.kabupaten ?? "" }]); };
  const navigateToKel = (kel: KelurahanResult) => { setSelectedKel(kel); setActiveTabIdx(0); setActiveTpsIdx(0); setBreadcrumbs([{ level:"provinsi", label: getLocalizedProvince(provinsi?.provinsi ?? "", lang) }, { level:"kabupaten", label: selectedKab?.kabupaten ?? "" }, { level:"kecamatan", label: selectedKec?.kecamatan ?? "" }]); };
  const navigateBack = (toLevel: DrillLevel) => {
    if (toLevel === "provinsi") { setSelectedKab(null); setSelectedKec(null); setSelectedKel(null); setBreadcrumbs([]); }
    else if (toLevel === "kabupaten") { setSelectedKec(null); setSelectedKel(null); setBreadcrumbs([{ level:"provinsi", label: getLocalizedProvince(provinsi?.provinsi ?? "", lang) }]); }
    else if (toLevel === "kecamatan") { setSelectedKel(null); setBreadcrumbs([{ level:"provinsi", label: getLocalizedProvince(provinsi?.provinsi ?? "", lang) }, { level:"kabupaten", label: selectedKab?.kabupaten ?? "" }]); }
    setActiveTabIdx(0); setActiveTpsIdx(0);
  };

  const subItems = currentLevel === "provinsi" ? provinsi?.kabupatenList ?? [] : currentLevel === "kabupaten" ? selectedKab?.kecamatanList ?? [] : currentLevel === "kecamatan" ? selectedKec?.kelurahanList ?? [] : [];
  const subLabel = currentLevel === "provinsi" ? t.district : currentLevel === "kabupaten" ? t.subDistrict : currentLevel === "kecamatan" ? t.village : "";
  const tpsList = currentLevel === "kelurahan" ? selectedKel?.tpsList ?? [] : currentLevel === "kecamatan" ? selectedKec?.tpsList ?? [] : [];
  const showTpsList = currentLevel === "kelurahan" || (currentLevel === "kecamatan" && (selectedKec?.kelurahanList?.length ?? 0) === 0);

  const tabs = explodeCategories(currentCategories, t);
  const activeCat = tabs[activeTabIdx] ?? null;

  return (
    <AnimatePresence onExitComplete={resetDrill}>
      {provinsi && (
        <>
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} style={{ position:"fixed", inset:0, background: isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.2)", zIndex:9998 }} onClick={onClose} />
          <motion.div initial={{ opacity:0, y:"100%" }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:"100%" }} transition={{ type:"spring", damping:32, stiffness:320 }}
            style={{ position:"fixed", inset:0, zIndex:9999, background: themeBg, display:"flex", flexDirection:"column", overflow:"hidden" }} onClick={e => e.stopPropagation()}>

            <div style={{ flexShrink:0, background: themePanelBg, borderBottom:`1px solid ${themeBorder}` }}>
              <div style={{ maxWidth:1600, margin:"0 auto", padding:"14px 40px", display:"flex", alignItems:"center", gap:16 }}>
                <button onClick={onClose} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:10, background: isDark ? "#1e293b" : "#f1f5f9", border:"none", cursor:"pointer", color: isDark ? "#cbd5e1" : "#475569", fontWeight:700, fontSize:12 }}>
                  <ArrowLeft size={14} /> {t.backToMap}
                </button>
                <div style={{ width:1, height:28, background: themeBorder }} />
                <div style={{ display:"flex", alignItems:"center", gap:4, flex:1, overflow:"hidden" }}>
                  <button onClick={() => navigateBack("provinsi")} style={{ background:"none", border:"none", cursor:"pointer", color: breadcrumbs.length > 0 ? "#3b82f6" : themeText, fontWeight:900, fontSize: breadcrumbs.length > 0 ? 13:18, whiteSpace:"nowrap" }}>{getLocalizedProvince(provinsi.provinsi, lang)}</button>
                  {breadcrumbs.slice(1).map((bc, i) => (
                    <span key={i} style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <ChevronRight size={12} style={{ color: isDark ? "#475569" : "#cbd5e1" }} />
                      <button onClick={() => navigateBack(bc.level === "kabupaten" ? "kabupaten" : "kecamatan")} style={{ background:"none", border:"none", cursor:"pointer", color:"#3b82f6", fontWeight:700, fontSize:13, whiteSpace:"nowrap" }}>{getLocalizedAdminName(bc.label, lang)}</button>
                    </span>
                  ))}
                  {currentLevel !== "provinsi" && (
                    <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <ChevronRight size={12} style={{ color: isDark ? "#475569" : "#cbd5e1" }} />
                      <span style={{ fontWeight:900, color:themeText, fontSize:16, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{currentTitle}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ flexShrink:0, background: themePanelBg, borderBottom:`1px solid ${themeBorder}` }}>
              <div style={{ maxWidth:1600, margin:"0 auto", padding:"12px 40px", display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                <StatCard icon={<MapPin size={16}/>} label={t.totalTps} val={currentTPS.toLocaleString("id-ID")} unit="TPS" color="blue" isDark={isDark} />
                <StatCard icon={<Users size={16}/>} label={t.inboundVotes} val={currentVoters.toLocaleString("id-ID")} unit={t.votes} subValue={`${t.maxVotes}: ${currentMaxVoters.toLocaleString("id-ID")}`} color="violet" isDark={isDark} />
                <StatCard icon={<BarChart3 size={16}/>} label={subLabel || t.electionType} val={subItems.length > 0 ? String(subItems.length) : String(tabs.length)} unit={subLabel || "cat"} color="emerald" isDark={isDark} />
              </div>
            </div>

            <div style={{ flexShrink:0, background: themePanelBg, borderBottom:`1px solid ${themeBorder}` }}>
              <div style={{ maxWidth:1600, margin:"0 auto", padding:"10px 40px" }}>
                <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
                  <Search size={16} style={{ position:"absolute", left:14, color:"#94a3b8", pointerEvents:"none" }} />
                  <input type="text" placeholder={`${t.searchPlaceholder.replace("...", "")} ${getLocalizedProvince(provinsi.provinsi, lang)}...`} value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setSelectedSearchTps(null); }} style={{ width:"100%", padding:"10px 40px", borderRadius:12, border:`2px solid ${isDark ? "#334155" : "#e2e8f0"}`, fontSize:13, fontWeight:500, color: themeText, background: isDark ? "#1e293b" : "#f8fafc", outline:"none" }} />
                  {searchQuery && <button onClick={() => { setSearchQuery(""); setSelectedSearchTps(null); }} style={{ position:"absolute", right:12, background:"none", border:"none", cursor:"pointer", color:"#94a3b8" }}><X size={16} /></button>}
                </div>
              </div>
            </div>

            <div style={{ flex:1, overflowY:"auto" }}>
              <div style={{ maxWidth:1600, margin:"0 auto", padding:"28px 40px" }}>
                {searchQuery.trim().length >= 2 ? (
                  <div>
                    {selectedSearchTps ? (
                      <div>
                        <button onClick={() => setSelectedSearchTps(null)} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:10, background: isDark ? "#1e293b" : "#f1f5f9", border:"none", cursor:"pointer", color: isDark ? "#cbd5e1" : "#475569", fontWeight:700, fontSize:12, marginBottom:20 }}><ArrowLeft size={14} /> {t.back}</button>
                        <TpsDetailCard tps={selectedSearchTps} isDark={isDark} lang={lang} defaultOpen={true} />
                      </div>
                    ) : (
                      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                        {searchResults.slice(0, 50).map((tps: TpsResult) => (
                          <div key={tps.tpsId}
                            onClick={() => setSelectedSearchTps(tps)}
                            style={{ background: themePanelBg, borderRadius:14, border:`1px solid ${themeBorder}`, padding:16, cursor:"pointer", transition:"all 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.boxShadow = isDark ? "0 4px 12px rgba(0,0,0,0.4)" : "0 2px 8px rgba(59,130,246,0.08)"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = themeBorder; e.currentTarget.style.boxShadow = "none"; }}
                          >
                            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                              <div style={{ width:36, height:36, borderRadius:10, background: isDark ? "rgba(59,130,246,0.15)" : "#eff6ff", display:"flex", alignItems:"center", justifyContent:"center", color:"#3b82f6", fontWeight:900, fontSize:12, flexShrink:0 }}>
                                #{tps.tpsId}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <p style={{ fontWeight:800, color:themeText, fontSize:15, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{tps.uniqueTPS}</p>
                                <p style={{ color:themeTextMuted, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:2 }}>{tps.alamatLengkap || t.noAddress}</p>
                              </div>
                              <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                                <div style={{ textAlign:"right" }}>
                                  <p style={{ fontWeight:900, color:"#3b82f6", fontSize:16 }}>{(tps.totalVoters ?? 0).toLocaleString("id-ID")} <span style={{ fontSize:10, color:themeTextMuted, fontWeight:600 }}>{t.votes}</span></p>
                                  <p style={{ color:themeTextMuted, fontSize:10.5, fontWeight:600, marginTop:2 }}>{t.maxVotes}: {(tps.registeredVoters ?? 0).toLocaleString("id-ID")}</p>
                                </div>
                                <ChevronRight size={18} style={{ color: isDark ? "#475569" : "#cbd5e1" }} />
                              </div>
                            </div>
                            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:4 }}>
                              {tps.kotaDesa && <span style={{ fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:6, background: isDark ? "rgba(139,92,246,0.15)" : "#f5f3ff", color: isDark ? "#a78bfa" : "#7c3aed" }}>{tps.kotaDesa}</span>}
                              {tps.kecamatan && tps.kecamatan !== "TIDAK DIKETAHUI" && <span style={{ fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:6, background: isDark ? "rgba(16,185,129,0.15)" : "#ecfdf5", color: isDark ? "#34d399" : "#059669" }}>{t.subDistrict}. {tps.kecamatan}</span>}
                              {tps.kelurahan && tps.kelurahan !== "TIDAK DIKETAHUI" && <span style={{ fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:6, background: isDark ? "rgba(59,130,246,0.15)" : "#eff6ff", color: isDark ? "#60a5fa" : "#2563eb" }}>{t.village}. {tps.kelurahan}</span>}
                               {(() => {
                                 const now = Math.floor(Date.now() / 1000);
                                 const isActive = now >= (tps.startTime || 0) && now <= (tps.endTime || 0);
                                 return (
                                   <span style={{ fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:6, background: isActive ? (isDark ? "rgba(16,185,129,0.15)" : "#f0fdf4") : (isDark ? "#334155" : "#f1f5f9"), color: isActive ? "#10b981" : "#94a3b8", border: isActive ? "none" : `1px solid ${isDark ? "#475569" : "#cbd5e1"}` }}>
                                     {isActive ? `● ${t.live}` : t.closed}
                                   </span>
                                 );
                               })()}
                            </div>
                          </div>
                        ))}
                        {searchResults.length > 50 && (
                          <p style={{ textAlign:"center", color:themeTextMuted, fontSize:12, padding:16 }}>
                            {t.showing} 50 {t.from} {searchResults.length} {t.results}.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display:"grid", gridTemplateColumns: subItems.length > 0 && !showTpsList ? "380px 1fr" : "1fr", gap:32 }}>
                    {subItems.length > 0 && !showTpsList && (
                      <div>
                        <p style={{ fontSize:11, fontWeight:900, color:themeTextMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}><Navigation size={12} style={{ display:"inline", marginRight:6 }} /> {t.list} {subLabel} ({subItems.length})</p>
                        <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:520, overflowY:"auto" }}>
                          {(subItems as any[]).map((item: any, i: number) => (
                            <WilayahItem key={item.kabupaten ?? item.kecamatan ?? item.kelurahan ?? i} rank={i+1} name={item.kabupaten ?? item.kecamatan ?? item.kelurahan ?? ""} tpsCount={item.totalTPS} voters={item.totalVoters} registeredVoters={item.registeredVoters} color={PALETTE[i%PALETTE.length]} isDark={isDark} lang={lang} onClick={() => { if (currentLevel === "provinsi") navigateToKab(item as KabupatenResult); else if (currentLevel === "kabupaten") navigateToKec(item as KecamatanResult); else if (currentLevel === "kecamatan") navigateToKel(item as KelurahanResult); }} />
                          ))}
                        </div>
                      </div>
                    )}
                    {showTpsList && tpsList.length > 0 && (
                      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                          <p style={{ fontSize:11, fontWeight:900, color:themeTextMuted, textTransform:"uppercase", letterSpacing:"0.08em" }}><Building2 size={12} style={{ display:"inline", marginRight:6 }} /> {t.viewDetails} ({activeTpsIdx + 1} {t.from} {tpsList.length})</p>
                          <div style={{ display:"flex", gap:8 }}>
                            <button disabled={activeTpsIdx === 0} onClick={() => setActiveTpsIdx(activeTpsIdx - 1)} style={{ padding:"6px 14px", borderRadius:10, background: activeTpsIdx === 0 ? themePanelBg : "#3b82f6", color: activeTpsIdx === 0 ? themeTextMuted : "#fff", border:"none", cursor:"pointer", opacity: activeTpsIdx === 0 ? 0.5 : 1 }}><ArrowLeft size={14} /></button>
                            <button disabled={activeTpsIdx === tpsList.length - 1} onClick={() => setActiveTpsIdx(activeTpsIdx + 1)} style={{ padding:"6px 14px", borderRadius:10, background: activeTpsIdx === tpsList.length - 1 ? themePanelBg : "#3b82f6", color: activeTpsIdx === tpsList.length - 1 ? themeTextMuted : "#fff", border:"none", cursor:"pointer", opacity: activeTpsIdx === tpsList.length - 1 ? 0.5 : 1 }}><ChevronRight size={14} /></button>
                          </div>
                        </div>
                        <TpsDetailCard tps={tpsList[activeTpsIdx]} isDark={isDark} lang={lang} defaultOpen={true} />
                      </div>
                    )}
                    <div>
                      {tabs.length > 0 && (
                        <>
                          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
                            {tabs.map((cat: CategoryResult, i: number) => (
                              <button key={`${cat.categoryType}-${cat.label}`} onClick={() => setActiveTabIdx(i)} style={{ padding:"5px 12px", borderRadius:8, fontSize:12, fontWeight:700, border:`2px solid ${activeTabIdx===i ? PALETTE[i%PALETTE.length] : themeBorder}`, background: activeTabIdx===i ? PALETTE[i%PALETTE.length] : themePanelBg, color: activeTabIdx===i ? "#fff" : themeTextMuted, cursor:"pointer" }}>{cat.label}</button>
                            ))}
                          </div>
                          {activeCat && (
                            <AnimatePresence mode="wait">
                              <motion.div key={activeTabIdx} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} transition={{ duration:0.15 }}>
                                <CategoryCharts 
                                  cat={activeCat} 
                                  isDark={isDark} 
                                  lang={lang} 
                                  distData={subItems.map((item: any) => ({ name: (item.kabupaten ?? item.kecamatan ?? item.kelurahan ?? "").slice(0,8), votes: explodeCategories(item.categories || [], t).find((c: any) => c.label === activeCat.label)?.totalVotes ?? 0 })).filter(d => d.votes > 0).slice(0, 10)} 
                                  regionalCompareData={subItems.map((item: any) => {
                                    const name = (item.kabupaten ?? item.kecamatan ?? item.kelurahan ?? "").slice(0, 8);
                                    const foundCat = explodeCategories(item.categories || [], t).find((c: any) => c.label === activeCat.label);
                                    const candVotes: Record<string, number> = {};
                                    if (foundCat && foundCat.candidates) {
                                      foundCat.candidates.forEach(cand => {
                                        candVotes[`cand_${cand.id}`] = cand.voteCount;
                                      });
                                    }
                                    return { name, ...candVotes };
                                  }).slice(0, 10)}
                                />
                              </motion.div>
                            </AnimatePresence>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
