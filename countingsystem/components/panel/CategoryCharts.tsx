"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, TrendingUp, Vote, Trophy, Search, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { getCandidateColor } from "@/lib/color-utils";
import ChartTooltip from "@/components/shared/ChartTooltip";
import type { CategoryResult, CandidateResult } from "@/lib/aggregator";
import { translations, type Language } from "@/constants/translations";

interface CategoryChartsProps {
  cat: CategoryResult;
  isDark: boolean;
  distData?: { name: string; votes: number }[] | null;
  regionalCompareData?: any[] | null;
  horizontal?: boolean;
  lang: Language;
}

export default function CategoryCharts({ cat, isDark, distData, regionalCompareData, horizontal: forcedHorizontal = false, lang }: CategoryChartsProps) {
  const t = translations[lang];
  const [activeSubPage, setActiveSubPage] = useState<"stats" | "votes">("stats");
  const [voteSearch, setVoteSearch] = useState("");
  
  // Auto-switch to horizontal if many candidates (> 10)
  const horizontal = forcedHorizontal || cat.candidates.length > 10;
  
  const getStableColor = (c: CandidateResult, index: number) => {
    if (cat.categoryType === 0) {
      const sortedPres = [...cat.candidates].sort((a, b) => a.id - b.id);
      const idx = sortedPres.findIndex(pc => pc.id === c.id);
      const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];
      return colors[idx % colors.length];
    }
    return getCandidateColor(c.name, index);
  };

  const formatChartLabel = (fullName: string) => {
    let name = fullName;
    name = name.replace(/\[Coblos\s+Gambar\]/gi, "[Coblos]");
    name = name.replace(/\[Coblos\s+Partai\]/gi, "[Coblos]");
    
    name = name.replace(/Partai Kebangkitan Bangsa/gi, "PKB");
    name = name.replace(/Partai Gerakan Indonesia Raya|Partai Gerindra/gi, "Gerindra");
    name = name.replace(/Partai Demokrasi Indonesia Perjuangan|Partai Demokrasi Indonesia-Perjuangan/gi, "PDIP");
    name = name.replace(/Partai Golongan Karya|Partai Golkar/gi, "Golkar");
    name = name.replace(/Partai NasDem|Partai Nasional Demokrat/gi, "NasDem");
    name = name.replace(/Partai Buruh/gi, "Buruh");
    name = name.replace(/Partai Gelombang Rakyat Indonesia|Partai Gelora/gi, "Gelora");
    name = name.replace(/Partai Keadilan Sejahtera/gi, "PKS");
    name = name.replace(/Partai Kebangkitan Nusantara/gi, "PKN");
    name = name.replace(/Partai Hati Nurani Rakyat|Partai Hanura/gi, "Hanura");
    name = name.replace(/Partai Garda Perubahan Indonesia|Partai Garuda/gi, "Garuda");
    name = name.replace(/Partai Amanat Nasional/gi, "PAN");
    name = name.replace(/Partai Bulan Bintang/gi, "PBB");
    name = name.replace(/Partai Demokrat/gi, "Demokrat");
    name = name.replace(/Partai Solidaritas Indonesia/gi, "PSI");
    name = name.replace(/Partai Persatuan Indonesia|Partai Perindo/gi, "Perindo");
    name = name.replace(/Partai Persatuan Pembangunan/gi, "PPP");
    name = name.replace(/Partai Ummat/gi, "Ummat");
    name = name.replace(/Partai\s+/gi, "P. ");
    
    if (cat.categoryType === 0 || cat.categoryType === 5 || cat.categoryType === 6 || cat.categoryType === 7) {
      return name;
    }

    if (!fullName.startsWith("[")) {
      const words = name.split(" ");
      if (words.length > 3) {
        return words.slice(0, 3).join(" ");
      }
    }
    return name;
  };

  const barData = cat.candidates.map((c, i) => ({ 
    name: formatChartLabel(c.name), 
    votes: c.voteCount, 
    fill: getStableColor(c, i) 
  }));

  // Clean top 6 data for Pie Chart to maintain high readability
  const pieData = [...cat.candidates]
    .sort((a, b) => b.voteCount - a.voteCount)
    .slice(0, 6)
    .map((c, i) => ({ 
      name: formatChartLabel(c.name).replace("[Coblos] ", ""), 
      value: c.voteCount, 
      fill: getStableColor(c, i) 
    }));

  const themeCardBg = isDark ? "#1e293b" : "#fff";
  const themeCardBorder = isDark ? "#334155" : "#f1f5f9";
  const themeTextMuted = isDark ? "#94a3b8" : "#64748b";
  const themeText = isDark ? "#f1f5f9" : "#0f172a";
  const gridColor = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)";

  const CustomYAxisTick = (props: any) => {
    const { x, y, payload } = props;
    return (
      <g transform={`translate(${x - 135},${y - 12})`}>
        <foreignObject width={130} height={24}>
          <div 
            className="marquee-container" 
            style={{ 
              width: 130, 
              height: 24, 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "flex-end",
              textAlign: "right",
              color: themeText,
              fontSize: "11px",
              fontWeight: 800,
              whiteSpace: "nowrap",
              cursor: "default"
            }}
            title={payload.value}
          >
            <span className="marquee-text">
              {payload.value}
            </span>
          </div>
        </foreignObject>
      </g>
    );
  };

  const isLegCategory = [1, 3, 4].includes(cat.categoryType);
  const parties = isLegCategory 
    ? cat.candidates.filter(c => (c.description || "").toLowerCase().includes("coblos gambar")) 
    : [];
  const individuals = isLegCategory 
    ? cat.candidates.filter(c => !(c.description || "").toLowerCase().includes("coblos gambar")) 
    : cat.candidates;

  // Filter parties and candidates based on the search query
  const filteredParties = parties.filter(c => c.name.toLowerCase().includes(voteSearch.toLowerCase()));
  const filteredIndividuals = individuals.filter(c => c.name.toLowerCase().includes(voteSearch.toLowerCase()));

  const renderCandidateCard = (c: CandidateResult, i: number, totalInList: number, offset = 0) => {
    const isWinner = i === 0 && totalInList > 1 && c.voteCount > 0;
    const color = getStableColor(c, i + offset);
    const cardBg = isDark ? (isWinner ? "rgba(37,99,235,0.15)" : "#1e293b") : (isWinner ? "#eff6ff" : "#fff");
    const cardBorder = isDark ? (isWinner ? "rgba(59,130,246,0.6)" : "#334155") : (isWinner ? "#bfdbfe" : "#f1f5f9");

    return (
      <motion.div key={c.id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay: (i + offset) * 0.02 }}
        onClick={() => setActiveSubPage("stats")}
        title={t.clickToViewFullCharts}
        style={{ position:"relative", display:"flex", alignItems:"center", gap:16, padding:"16px 20px", borderRadius:16, border:`2px solid ${cardBorder}`, background:cardBg, cursor:"pointer" }}>
        {isWinner && <span style={{ position:"absolute", top:-10, left:16, display:"flex", alignItems:"center", gap:3, background:"#2563eb", color:"#fff", fontSize:9, fontWeight:900, padding:"3px 8px", borderRadius:99 }}><Trophy size={8}/>{t.winning}</span>}
        <div style={{ width:44, height:44, borderRadius:12, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background: color === "#f3f4f6" ? "#e5e7eb" : `linear-gradient(135deg,${color},${color}99)`, color: color === "#f3f4f6" || color === "#ffff00" ? "#000" : "#fff", fontWeight:900, fontSize:18 }}>{i+1}</div>
        <div style={{ flex:1, minWidth:0 }} className="marquee-container">
          <p className="marquee-text" style={{ fontWeight:900, color:themeText, fontSize:15, marginBottom:8 }}>{c.name}</p>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ flex:1, height:6, background: isDark ? "#334155" : "#f1f5f9", borderRadius:99, overflow:"hidden" }}>
              <motion.div initial={{ width:0 }} animate={{ width:`${c.percentage}%` }} transition={{ duration:0.8, ease:"easeOut", delay: (i + offset) * 0.05 }} style={{ height:"100%", borderRadius:99, background:color }} />
            </div>
            <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontWeight:700, fontSize:12, width:40, textAlign:"right" }}>{c.percentage}%</span>
          </div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <p style={{ fontWeight:900, color:themeText, fontSize:22, lineHeight:1 }}>{c.voteCount.toLocaleString("id-ID")}</p>
          <p style={{ color:themeTextMuted, fontSize:10, marginTop:3 }}>{t.votes}</p>
        </div>
      </motion.div>
    );
  };

  if (cat.totalVotes === 0) {
    return (
      <div style={{ background:themeCardBg, borderRadius:20, padding:48, border:`2px dashed ${themeCardBorder}`, textAlign:"center" }}>
        <Vote size={36} style={{ color: themeCardBorder, margin:"0 auto 12px" }} />
        <p style={{ color:themeTextMuted, fontWeight:500 }}>{t.noData}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      
      {/* Premium Segmented Navigation Tabs */}
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: 6, 
        background: isDark ? "#0f172a" : "#f1f5f9", 
        padding: 4, 
        borderRadius: 12, 
        border: `1px solid ${themeCardBorder}`,
        width: "fit-content",
        alignSelf: "flex-start",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
      }}>
        <button 
          onClick={() => setActiveSubPage("stats")} 
          style={{ 
            padding: "8px 16px", 
            borderRadius: 8, 
            fontSize: 12, 
            fontWeight: 800, 
            border: "none", 
            background: activeSubPage === "stats" ? "#3b82f6" : "transparent", 
            color: activeSubPage === "stats" ? "#fff" : themeTextMuted, 
            cursor: "pointer", 
            transition: "all 0.15s",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <BarChart3 size={13} />
          {t.statsAndCharts}
        </button>
        <button 
          onClick={() => setActiveSubPage("votes")} 
          style={{ 
            padding: "8px 16px", 
            borderRadius: 8, 
            fontSize: 12, 
            fontWeight: 800, 
            border: "none", 
            background: activeSubPage === "votes" ? "#3b82f6" : "transparent", 
            color: activeSubPage === "votes" ? "#fff" : themeTextMuted, 
            cursor: "pointer", 
            transition: "all 0.15s",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <Vote size={13} />
          {t.votesBreakdown}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeSubPage === "stats" ? (
          /* PAGE 1: STATS & CHARTS */
          <motion.div 
            key="stats-page" 
            initial={{ opacity: 0, x: -30 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: 30 }} 
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {horizontal ? (
              /* Stacked Layout for races with many candidates (DPR, caleg, dll.) so they expand vertically one-by-one downward */
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                
                {/* 1. Full Width Bar Chart of ALL candidates with dynamic height */}
                <div style={{ background: themeCardBg, borderRadius: 20, padding: 24, border: `1px solid ${themeCardBorder}` }}>
                  <p style={{ fontSize: 10, fontWeight: 900, color: themeTextMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
                    <BarChart3 size={12} style={{ display:"inline", marginRight:4 }} /> {t.inboundVotes}
                  </p>
                  {/* Scroll system wrapper to keep card height neat and clean */}
                  <div style={{ maxHeight: 380, overflowY: "auto", paddingRight: 6 }}>
                    <ResponsiveContainer width="100%" height={Math.max(320, barData.length * 36)}>
                      <BarChart layout="vertical" data={barData} margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={true} vertical={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={<CustomYAxisTick />} width={130} />
                        <Tooltip content={<ChartTooltip isDark={isDark} lang={lang} />} cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(59,130,246,0.04)" }} />
                        <Bar dataKey="votes" radius={[0, 4, 4, 0]} barSize={18}>
                          {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Full Width Line Chart */}
                {distData && distData.length > 0 && (
                  <div style={{ background: themeCardBg, borderRadius: 20, padding: 24, border: `1px solid ${themeCardBorder}` }}>
                    <p style={{ fontSize: 10, fontWeight: 900, color: themeTextMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
                      <TrendingUp size={12} style={{ display:"inline", marginRight:4 }} /> {t.regionDistribution}
                    </p>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={distData} margin={{ top: 10, right: 12, left: 0, bottom: 35 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} tick={{ fill: isDark ? "#cbd5e1" : "#0f172a", fontSize: 10, fontWeight: 600 }} angle={-20} textAnchor="end" height={40} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? "#cbd5e1" : "#0f172a", fontSize: 11, fontWeight: 600 }} width={45} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip isDark={isDark} lang={lang} />} />
                        <Line type="monotone" dataKey="votes" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: "#3b82f6" }} activeDot={{ r: 6 }} animationDuration={800} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* 3. Full Width Pie Chart laid out in columns */}
                <div style={{ background: themeCardBg, borderRadius: 20, padding: 24, border: `1px solid ${themeCardBorder}` }}>
                  <p style={{ fontSize: 10, fontWeight: 900, color: themeTextMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Distribusi Suara</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24, alignItems: "center" }}>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={30} paddingAngle={2}>
                          {pieData.map((_, i) => <Cell key={i} fill={pieData[i].fill} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => [Number(v).toLocaleString("id-ID"), t.votes]} contentStyle={{ borderRadius: 10, border: `1px solid ${themeCardBorder}`, background: themeCardBg, color: themeText, fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {pieData.map((d, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", borderRadius: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.fill, flexShrink: 0 }} />
                          <span style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: 11, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace:"nowrap" }}>{d.name}</span>
                          <span style={{ color: themeText, fontSize: 11, fontWeight: 800 }}>
                            {cat.totalVotes > 0 ? `${((d.value / cat.totalVotes) * 100).toFixed(1)}%` : "0%"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              /* Original 3-Column Grid layout for <= 10 candidates (like Presidential race) */
              <div style={{ display: "grid", gridTemplateColumns: distData && distData.length > 0 ? "1.1fr 1fr 0.8fr" : "2fr 1fr", gap: 16 }}>
                
                {/* Column 1: Bar Chart (Grafik Batang) */}
                <div style={{ background: themeCardBg, borderRadius: 20, padding: 24, border: `1px solid ${themeCardBorder}` }}>
                  <p style={{ fontSize: 10, fontWeight: 900, color: themeTextMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
                    <BarChart3 size={12} style={{ display:"inline", marginRight:4 }} /> {t.inboundVotes}
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={barData} margin={{ top: 10, right: 12, left: 0, bottom: 35 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} tick={{ fill: isDark ? "#cbd5e1" : "#0f172a", fontSize: 11, fontWeight: 700 }} angle={-15} textAnchor="end" height={40} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? "#cbd5e1" : "#0f172a", fontSize: 11, fontWeight: 700 }} width={45} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip isDark={isDark} lang={lang} />} cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(59,130,246,0.04)" }} />
                      <Bar dataKey="votes" radius={[8, 8, 0, 0]} maxBarSize={52}>{barData.map((d, i) => <Cell key={i} fill={d.fill} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Column 2: Line Chart (Grafik Distribusi Daerah - Total) */}
                {distData && distData.length > 0 && (
                  <div style={{ background: themeCardBg, borderRadius: 20, padding: 24, border: `1px solid ${themeCardBorder}` }}>
                    <p style={{ fontSize: 10, fontWeight: 900, color: themeTextMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
                      <TrendingUp size={12} style={{ display:"inline", marginRight:4 }} /> {t.regionDistribution}
                    </p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={distData} margin={{ top: 10, right: 12, left: 0, bottom: 35 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} tick={{ fill: isDark ? "#cbd5e1" : "#0f172a", fontSize: 10, fontWeight: 600 }} angle={-20} textAnchor="end" height={40} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? "#cbd5e1" : "#0f172a", fontSize: 11, fontWeight: 600 }} width={45} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip isDark={isDark} lang={lang} />} />
                        <Line type="monotone" dataKey="votes" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: "#3b82f6" }} activeDot={{ r: 6 }} animationDuration={800} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Column 3: Pie Chart (Diagram Pie) */}
                <div style={{ background: themeCardBg, borderRadius: 20, padding: 24, border: `1px solid ${themeCardBorder}`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 900, color: themeTextMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Distribusi</p>
                    <ResponsiveContainer width="100%" height={100}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={36} innerRadius={22} paddingAngle={2}>
                          {pieData.map((_, i) => <Cell key={i} fill={pieData[i].fill} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => [Number(v).toLocaleString("id-ID"), t.votes]} contentStyle={{ borderRadius: 10, border: `1px solid ${themeCardBorder}`, background: themeCardBg, color: themeText, fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                    {pieData.slice(0, 4).map((d, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: d.fill, flexShrink: 0, border: d.fill === "#f3f4f6" ? "1px solid #d1d5db" : "none" }} />
                        <span style={{ color: isDark ? "#cbd5e1" : "#475569", fontSize: 10, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace:"nowrap" }}>{d.name}</span>
                        <span style={{ color: themeTextMuted, fontSize: 10, fontWeight: 700 }}>
                          {cat.totalVotes > 0 ? `${((d.value / cat.totalVotes) * 100).toFixed(0)}%` : "0%"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* Bottom Row: New, Full-Width Multi-Line Per-Candidate Regional Trend Chart (matching the reference image) */}
            {regionalCompareData && regionalCompareData.length > 0 && (
              <div style={{ background: themeCardBg, borderRadius: 20, padding: 24, border: `1px solid ${themeCardBorder}`, marginTop: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 900, color: themeTextMuted, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    <TrendingUp size={12} style={{ display:"inline", marginRight:6 }} /> {t.regionVoteTrend}
                  </p>
                  <p style={{ fontSize: 11, color: themeTextMuted }}>{t.regionVoteTrendSub}</p>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={regionalCompareData} margin={{ top: 15, right: 25, left: 10, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={true} horizontal={true} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDark ? "#cbd5e1" : "#0f172a", fontSize: 10, fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? "#cbd5e1" : "#0f172a", fontSize: 10, fontWeight: 700 }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: 12, border: `1px solid ${themeCardBorder}`, background: themeCardBg, color: themeText, fontSize: 11 }}
                      formatter={(value: any) => [Number(value).toLocaleString("id-ID"), t.votes || "suara"]}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      iconType="circle"
                      wrapperStyle={{ fontSize: 11, fontWeight: 800, color: themeText }} 
                    />
                    {cat.candidates.slice(0, 10).map((cand, idx) => {
                      const color = getStableColor(cand, idx);
                      return (
                        <Line 
                          key={cand.id}
                          type="monotone"
                          dataKey={`cand_${cand.id}`}
                          name={formatChartLabel(cand.name)}
                          stroke={color}
                          strokeWidth={3}
                          dot={{ r: 5, strokeWidth: 2, fill: color }}
                          activeDot={{ r: 7, strokeWidth: 1 }}
                          connectNulls
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        ) : (
          /* PAGE 2: DETAILED VOTE BREAKDOWN */
          <motion.div 
            key="votes-page" 
            initial={{ opacity: 0, x: 30 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: -30 }} 
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {/* Search Filter input */}
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={16} style={{ position: "absolute", left: 14, color: "#94a3b8", pointerEvents: "none" }} />
              <input 
                type="text" 
                placeholder={t.searchCandidateOrParty} 
                value={voteSearch} 
                onChange={e => setVoteSearch(e.target.value)} 
                style={{ 
                  width: "100%", 
                  padding: "10px 40px", 
                  borderRadius: 12, 
                  border: `2px solid ${isDark ? "#334155" : "#e2e8f0"}`, 
                  fontSize: 13, 
                  fontWeight: 500, 
                  color: themeText, 
                  background: isDark ? "#1e293b" : "#f8fafc", 
                  outline: "none" 
                }} 
              />
              {voteSearch && (
                <button 
                  onClick={() => setVoteSearch("")} 
                  style={{ position: "absolute", right: 12, background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* List of Parties */}
            {parties.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {individuals.length > 0 && (
                  <p style={{ fontSize:12, fontWeight:900, color: isDark ? "#fbb82c" : "#c2410c", letterSpacing:"0.08em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:6, padding:"0 4px" }}>
                    <span style={{ fontSize:14 }}>🚩</span> {t.partyVotes || "Perolehan Suara Partai"} ({filteredParties.length})
                  </p>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {filteredParties.map((c, i) => renderCandidateCard(c, i, parties.length, 0))}
                  {filteredParties.length === 0 && (
                    <p style={{ fontSize:12, color: themeTextMuted, textAlign:"center", padding:"10px 0" }}>
                      {t.noMatchingParties}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* List of Individuals */}
            {individuals.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:12, marginTop: 12 }}>
                {parties.length > 0 && (
                  <p style={{ fontSize:12, fontWeight:900, color: isDark ? "#38bdf8" : "#1d4ed8", letterSpacing:"0.08em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:6, padding:"0 4px" }}>
                    <span style={{ fontSize:14 }}>👤</span> {t.individualVotes || "Suara Caleg Individu"} ({filteredIndividuals.length})
                  </p>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {filteredIndividuals.map((c, i) => renderCandidateCard(c, i, individuals.length, parties.length))}
                  {filteredIndividuals.length === 0 && (
                    <p style={{ fontSize:12, color: themeTextMuted, textAlign:"center", padding:"10px 0" }}>
                      {t.noMatchingCandidates}
                    </p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
