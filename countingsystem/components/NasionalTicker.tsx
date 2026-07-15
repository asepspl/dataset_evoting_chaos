"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, CartesianGrid, LineChart, Line,
} from "recharts";
import { Trophy, MapPin, Users, ChevronLeft, ChevronRight, Pause, Play, TrendingUp, Vote, BarChart3, Star } from "lucide-react";
import type { NasionalResult, CategoryResult, CandidateResult } from "@/lib/aggregator";
import { translations, type Language, type Translations, getCategoryLabel } from "@/constants/translations";
import { getLocalizedProvince, getLocalizedAdminName } from "@/constants/provinces";

const PALETTE = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1"];

function ChartTooltip({ active, payload, isDark, lang }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const themeBg = isDark ? "#1e293b" : "#ffffff";
  const themeText = isDark ? "#f8fafc" : "#1e293b";
  const themeBorder = isDark ? "#334155" : "#e2e8f0";

  return (
    <div style={{ background: themeBg, border: `1px solid ${themeBorder}`, padding: "10px 12px", borderRadius: "10px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
      <p style={{ margin: 0, fontWeight: 800, color: themeText, fontSize: 12 }}>{data.fullName || data.name || data.prov}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: payload[0].fill || "#3b82f6" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? "#94a3b8" : "#64748b" }}>
          {Number(payload[0].value).toLocaleString("id-ID")} suara
        </span>
      </div>
    </div>
  );
}

function aggregateNasionalCategories(data: NasionalResult, t: Translations): CategoryResult[] {
  const catMap = new Map<number, CategoryResult>();
  for (const prov of data.byProvinsi) {
    for (const cat of prov.categories) {
      if (!catMap.has(cat.categoryType)) {
        catMap.set(cat.categoryType, { ...cat, candidates: cat.candidates.map(c => ({ ...c })) });
      } else {
        const ex = catMap.get(cat.categoryType)!;
        ex.totalVotes += cat.totalVotes;
        for (const cand of cat.candidates) {
          const found = ex.candidates.find(ec => ec.name === cand.name);
          if (found) found.voteCount += cand.voteCount;
          else ex.candidates.push({ ...cand });
        }
      }
    }
  }
  
  const rawResults = Array.from(catMap.values());
  const finalResults: CategoryResult[] = [];

  for (const cat of rawResults) {
    const localizedLabel = getCategoryLabel(cat.categoryType, cat.label, t);
    const labelUpper = cat.label.toUpperCase();
    const isLegislative = labelUpper.includes("DPR") || labelUpper.includes("DPD");

    if (isLegislative) {
      const partyCandidates = cat.candidates.filter(c => 
        c.name.toUpperCase().includes("PARTAI") || (c.description && c.description.toUpperCase().includes("PARTAI"))
      );
      const calegCandidates = cat.candidates.filter(c => 
        !c.name.toUpperCase().includes("PARTAI") && !(c.description && c.description.toUpperCase().includes("PARTAI"))
      );

      // Only split if both exist
      if (partyCandidates.length > 0 && calegCandidates.length > 0) {
        const partyTotal = partyCandidates.reduce((s, c) => s + c.voteCount, 0);
        finalResults.push({
          ...cat,
          label: `${localizedLabel} ${t.partySuffix}`,
          totalVotes: partyTotal,
          candidates: partyCandidates.map(c => ({
            ...c,
            percentage: partyTotal > 0 ? Math.round((c.voteCount / partyTotal) * 1000) / 10 : 0
          })).sort((a, b) => b.voteCount - a.voteCount)
        });

        const calegTotal = calegCandidates.reduce((s, c) => s + c.voteCount, 0);
        finalResults.push({
          ...cat,
          label: `${localizedLabel} ${t.calegSuffix}`,
          totalVotes: calegTotal,
          candidates: calegCandidates.map(c => ({
            ...c,
            percentage: calegTotal > 0 ? Math.round((c.voteCount / calegTotal) * 1000) / 10 : 0
          })).sort((a, b) => b.voteCount - a.voteCount)
        });
      } else {
        // Only one type exists, keep as original category
        if (cat.totalVotes > 0) {
          for (const cand of cat.candidates) {
            cand.percentage = Math.round((cand.voteCount / cat.totalVotes) * 1000) / 10;
          }
        }
        cat.candidates.sort((a, b) => b.voteCount - a.voteCount);
        finalResults.push({ ...cat, label: localizedLabel });
      }
    } else {
      // Non-legislative (Presiden, etc.)
      if (cat.totalVotes > 0) {
        for (const cand of cat.candidates) {
          cand.percentage = Math.round((cand.voteCount / cat.totalVotes) * 1000) / 10;
        }
      }
      cat.candidates.sort((a, b) => b.voteCount - a.voteCount);
      finalResults.push({ ...cat, label: localizedLabel });
    }
  }

  return finalResults;
}

export default function NasionalTicker({ data, isDark, lang, isInsideDrawer = false, isFullscreen = false }: { data: NasionalResult; isDark: boolean; lang: Language; isInsideDrawer?: boolean; isFullscreen?: boolean }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const t = translations[lang];

  const categories = useMemo(() => {
    const agg = aggregateNasionalCategories(data, t);
    return agg.sort((a, b) => b.totalVotes - a.totalVotes);
  }, [data, t]);

  const cat = categories[activeIdx] || categories[0];

  const provData = useMemo(() => {
    return data.byProvinsi.map(p => {
      const cData = p.categories.find(c => c.categoryType === cat.categoryType);
      return { prov: p.provinsi.slice(0, 6).toUpperCase(), fullName: p.provinsi, votes: cData ? cData.totalVotes : 0 };
    }).filter(p => p.votes > 0).sort((a, b) => b.votes - a.votes);
  }, [data, cat.categoryType]);

  if (!data || categories.length === 0) return null;

  const getPresColor = (candId: number, i: number) => {
    if (cat.categoryType === 0) {
      const sortedPres = [...cat.candidates].sort((a, b) => a.id - b.id);
      const idx = sortedPres.findIndex(c => c.id === candId);
      const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];
      return colors[idx % colors.length];
    }
    return PALETTE[i % PALETTE.length];
  };

  const catLabelLower = cat.label.toLowerCase();
  let catLogo = null;
  if (catLabelLower.includes("presiden") || catLabelLower.includes("wapres")) {
    catLogo = "/logo-presiden.png";
  } else if (catLabelLower.includes("dpr") || catLabelLower.includes("dpd")) {
    catLogo = "/Logo-Dpr.png";
  }

  const themeBg = isDark ? "#0f172a" : "#ffffff";
  const themeCardBg = isDark ? "#1e293b" : "#f8fafc";
  const themeText = isDark ? "#f1f5f9" : "#0f172a";
  const themeTextMuted = isDark ? "#94a3b8" : "#64748b";
  const themeBorder = isDark ? "#334155" : "#e2e8f0";
  const themeCardBorder = isDark ? "#334155" : "#e2e8f0";
  const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";

  const isPair = cat.categoryType === 0 || cat.categoryType === 5 || cat.categoryType === 6 || cat.categoryType === 7;

  const barData = cat.candidates.slice(0, 10).map((c, i) => ({
    name: isPair ? c.name : (c.name.length > 12 ? c.name.slice(0, 10) + "…" : c.name),
    fullName: c.name,
    votes: c.voteCount,
    fill: getPresColor(c.id, i),
  }));

  const pieData = cat.candidates.slice(0, 6).map((c, i) => ({
    name: isPair ? c.name : c.name.split(" ")[0],
    value: c.voteCount,
    fill: getPresColor(c.id, i),
  }));

  const radarData = cat.candidates.slice(0, 6).map((c, i) => ({
    subject: c.name,
    A: c.percentage || 0,
    full: c.name,
  }));

  const sortedCandidates = [...cat.candidates].sort((a, b) => b.voteCount - a.voteCount);

  return (
    <div style={{ background: themeBg, borderRadius: isInsideDrawer ? 20 : 28, border: `1px solid ${themeBorder}`, boxShadow: isDark ? "0 4px 32px rgba(0,0,0,0.4)" : "0 4px 32px rgba(0,0,0,0.06)", overflow: "hidden", transition: "all 0.3s ease" }}>
      
      {/* ═══ HEADER ═══ */}
      <div style={{ padding: isInsideDrawer ? "14px 24px" : "16px 24px", borderBottom: `1px solid ${themeBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: isInsideDrawer ? 12 : 14 }}>
          <div style={{ width: isInsideDrawer ? 46 : 52, height: isInsideDrawer ? 46 : 52, borderRadius: 12, background: isDark ? "rgba(255,255,255,0.05)" : "#f8fafc", border: `1px solid ${themeBorder}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {catLogo ? <img src={catLogo} alt={cat.label} style={{ width: isInsideDrawer ? 36 : 42, height: isInsideDrawer ? 36 : 42, objectFit: "contain" }} /> : <Trophy size={isInsideDrawer ? 20 : 22} color={PALETTE[activeIdx % PALETTE.length]} />}
          </div>
          <div>
            <p style={{ fontWeight: 900, color: themeText, fontSize: isInsideDrawer ? 20 : 22, margin: 0 }}>{cat.label}</p>
            <p style={{ color: themeTextMuted, fontSize: isInsideDrawer ? 12 : 13, margin: 0 }}>Total: <strong style={{ color: PALETTE[activeIdx % PALETTE.length] }}>{cat.totalVotes.toLocaleString("id-ID")}</strong> {t.votes}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {categories.map((c, i) => (
            <button key={c.label} onClick={() => setActiveIdx(i)} style={{ padding: isInsideDrawer ? "5px 12px" : "6px 14px", borderRadius: 8, fontSize: isInsideDrawer ? 10.5 : 11, fontWeight: 700, border: activeIdx === i ? `2px solid ${PALETTE[i % PALETTE.length]}` : `1px solid ${themeBorder}`, background: activeIdx === i ? PALETTE[i % PALETTE.length] : themeBg, color: activeIdx === i ? "#fff" : themeTextMuted, cursor: "pointer", transition: "all 0.2s" }}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeIdx} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} style={{ padding: isInsideDrawer ? "16px 24px 20px" : "16px 24px 24px" }}>
          
          {/* ── ROW 1: Ranking, History, Stats ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.2fr 0.8fr", gap: isInsideDrawer ? 14 : 16, marginBottom: isInsideDrawer ? 14 : 16 }}>
            {/* Bar Chart: Suara Masuk / Kandidat */}
            <div style={{ background: themeCardBg, borderRadius: 18, padding: "16px", border: `1px solid ${themeCardBorder}`, display: "flex", flexDirection: "column" }}>
              <p style={{ fontSize: isInsideDrawer ? 9.5 : 10, fontWeight: 900, color: themeTextMuted, textTransform: "uppercase", marginBottom: isInsideDrawer ? 8 : 12 }}><BarChart3 size={isInsideDrawer ? 11 : 12} /> {t.inboundVotes} / {t.candidates}</p>
              <ResponsiveContainer width="100%" height={isFullscreen ? 285 : (isInsideDrawer ? 240 : 260)}>
                <BarChart data={barData} margin={{ top: 5, bottom: isInsideDrawer ? 25 : 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} tick={{ fill: themeText, fontSize: isInsideDrawer ? 8.5 : 9, fontWeight: 700 }} angle={-25} textAnchor="end" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: themeText, fontSize: isInsideDrawer ? 9 : 10 }} />
                  <Tooltip content={<ChartTooltip isDark={isDark} />} />
                  <Bar dataKey="votes" radius={[6, 6, 0, 0]} maxBarSize={isInsideDrawer ? 28 : 35}>
                    {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Area Chart: Suara Masuk / Provinsi */}
            <div style={{ background: themeCardBg, borderRadius: 18, padding: "16px", border: `1px solid ${themeCardBorder}`, display: "flex", flexDirection: "column" }}>
              <p style={{ fontSize: isInsideDrawer ? 9.5 : 10, fontWeight: 900, color: themeTextMuted, textTransform: "uppercase", marginBottom: isInsideDrawer ? 8 : 12 }}><TrendingUp size={isInsideDrawer ? 11 : 12} /> {t.inboundVotes} / {t.provinces}</p>
              <ResponsiveContainer width="100%" height={isFullscreen ? 285 : (isInsideDrawer ? 240 : 260)}>
                <AreaChart data={provData} margin={{ top: 5 }}>
                  <defs>
                    <linearGradient id="areaColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PALETTE[activeIdx % PALETTE.length]} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={PALETTE[activeIdx % PALETTE.length]} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="prov" axisLine={false} tickLine={false} tick={{ fill: themeText, fontSize: isInsideDrawer ? 8.5 : 9, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: themeText, fontSize: isInsideDrawer ? 9 : 10 }} />
                  <Tooltip content={<ChartTooltip isDark={isDark} />} />
                  <Area type="monotone" dataKey="votes" stroke={PALETTE[activeIdx % PALETTE.length]} strokeWidth={isInsideDrawer ? 2.5 : 3} fill="url(#areaColor)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Distribution & Comparison */}
            <div style={{ display: "flex", flexDirection: "column", gap: isInsideDrawer ? 14 : 16 }}>
              <div style={{ background: themeCardBg, borderRadius: 18, padding: "16px", border: `1px solid ${themeCardBorder}`, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <p style={{ fontSize: isInsideDrawer ? 9 : 10, fontWeight: 900, color: themeTextMuted, textTransform: "uppercase", marginBottom: 4 }}>{t.voteDistribution}</p>
                <ResponsiveContainer width="100%" height={isFullscreen ? 120 : (isInsideDrawer ? 100 : 120)}>
                  <PieChart>
                    <Pie data={pieData} innerRadius={isFullscreen ? 32 : (isInsideDrawer ? 28 : 35)} outerRadius={isFullscreen ? 46 : (isInsideDrawer ? 42 : 50)} paddingAngle={4} dataKey="value">
                      {pieData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6, justifyContent: "center" }}>
                  {pieData.map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)", padding: "1px 5px", borderRadius: 3 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: d.fill }} />
                      <span style={{ fontSize: 8.5, color: themeText, fontWeight: 800 }}>{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: themeCardBg, borderRadius: 18, padding: "16px", border: `1px solid ${themeCardBorder}`, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <p style={{ fontSize: isInsideDrawer ? 9 : 10, fontWeight: 900, color: themeTextMuted, textTransform: "uppercase", marginBottom: 4 }}>{t.comparison}</p>
                <ResponsiveContainer width="100%" height={isFullscreen ? 120 : (isInsideDrawer ? 100 : 120)}>
                  <RadarChart cx="50%" cy="50%" outerRadius={isFullscreen ? 38 : (isInsideDrawer ? 34 : 40)} data={radarData}>
                    <PolarGrid stroke={gridColor} />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: themeText, fontSize: isInsideDrawer ? 7.5 : 8, fontWeight: 700 }} tickFormatter={(val) => val.length > 10 ? val.slice(0, 7) + ".." : val} />
                    <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                    <Radar name={t.comparison} dataKey="A" stroke={PALETTE[activeIdx % PALETTE.length]} fill={PALETTE[activeIdx % PALETTE.length]} fillOpacity={0.4} isAnimationActive={false} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ── ROW 2: Candidate List & Participation ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: isInsideDrawer ? 14 : 16 }}>
            {/* Detail Kandidat List */}
            <div style={{ background: themeCardBg, borderRadius: 20, padding: "20px", border: `1px solid ${themeCardBorder}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isInsideDrawer ? 12 : 18 }}>
                <Trophy size={14} color="#f59e0b" />
                <p style={{ fontSize: isInsideDrawer ? 10.5 : 11, fontWeight: 900, color: themeTextMuted, textTransform: "uppercase", margin: 0 }}>{t.candidateDetail}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: isInsideDrawer ? 8 : 10, maxHeight: isFullscreen ? 360 : (isInsideDrawer ? 280 : 420), overflowY: "auto", paddingRight: 6 }}>
                {sortedCandidates.map((c, i) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: isInsideDrawer ? "10px 14px" : "12px 16px", borderRadius: 12, background: isDark ? "rgba(255,255,255,0.03)" : "#ffffff", border: `1px solid ${themeCardBorder}`, transition: "transform 0.2s" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: isDark ? "rgba(255,255,255,0.05)" : "#f8fafc", border: `1px solid ${themeCardBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {i === 0 ? <Star size={16} color="#f59e0b" fill="#f59e0b" /> : <span style={{ fontSize: 12, fontWeight: 900, color: themeTextMuted }}>{i + 1}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }} className="marquee-container">
                      <p className="marquee-text" style={{ fontWeight: 800, color: themeText, fontSize: isInsideDrawer ? 13 : 14, margin: 0 }}>{c.name}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <div style={{ flex: 1, height: 5, background: isDark ? "#334155" : "#e2e8f0", borderRadius: 99, overflow: "hidden" }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${c.percentage}%` }} transition={{ duration: 1, ease: "easeOut" }} style={{ height: "100%", background: getPresColor(c.id, i), borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: isInsideDrawer ? 10.5 : 11, fontWeight: 900, color: getPresColor(c.id, i), width: 38, textAlign: "right" }}>{c.percentage}%</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontWeight: 900, color: themeText, fontSize: isInsideDrawer ? 15 : 16, margin: 0 }}>{c.voteCount.toLocaleString("id-ID")}</p>
                      <p style={{ fontSize: 8.5, fontWeight: 700, color: themeTextMuted, textTransform: "uppercase", margin: 0 }}>{t.votes}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Participation per Province (Vertical Bar Chart) */}
            <div style={{ background: themeCardBg, borderRadius: 20, padding: "20px", border: `1px solid ${themeCardBorder}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isInsideDrawer ? 12 : 18 }}>
                <MapPin size={14} color="#3b82f6" />
                <p style={{ fontSize: isInsideDrawer ? 10.5 : 11, fontWeight: 900, color: themeTextMuted, textTransform: "uppercase", margin: 0 }}>{t.participationByProv}</p>
              </div>
              <div style={{ width: "100%", overflowX: "auto", marginTop: 6 }}>
                <div style={{ minWidth: provData.length * 32 }}>
                  <ResponsiveContainer width="100%" height={isFullscreen ? 360 : (isInsideDrawer ? 280 : 400)}>
                    <BarChart data={provData} margin={{ bottom: isInsideDrawer ? 40 : 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="prov" axisLine={false} tickLine={false} interval={0} tick={{ fill: themeText, fontSize: isInsideDrawer ? 9 : 10, fontWeight: 700 }} angle={-45} textAnchor="end" />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: themeText, fontSize: isInsideDrawer ? 9 : 10 }} />
                      <Tooltip content={<ChartTooltip isDark={isDark} />} />
                      <Bar dataKey="votes" radius={[5, 5, 0, 0]} maxBarSize={isInsideDrawer ? 24 : 35}>
                        {provData.map((d, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
