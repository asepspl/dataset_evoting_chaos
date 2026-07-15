"use client";

import React, { useState } from "react";
import { Vote } from "lucide-react";
import type { TpsResult, CategoryResult } from "@/lib/aggregator";
import { translations, type Language, type Translations, getCategoryLabel } from "@/constants/translations";
import CategoryCharts from "./CategoryCharts";

// Helper function used in the component
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

interface TpsDetailCardProps {
  tps: TpsResult;
  isDark: boolean;
  lang: Language;
  defaultOpen?: boolean;
}

export default function TpsDetailCard({ tps, isDark, lang, defaultOpen = false }: TpsDetailCardProps) {
  const t = translations[lang];
  const [showDetail, setShowDetail] = useState(defaultOpen);
  const cardBg = isDark ? "#1e293b" : "#fff";
  const cardBorder = isDark ? "#334155" : "#f1f5f9";

  return (
    <div style={{ background:cardBg, borderRadius:16, border:`1px solid ${cardBorder}`, padding:20, boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.03)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, background: isDark ? "#334155" : "#f8fafc", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", color: isDark ? "#cbd5e1" : "#475569", fontWeight:900, fontSize:12 }}>#{tps.tpsId}</div>
          <div>
            <p style={{ fontWeight:800, color: isDark ? "#f1f5f9" : "#0f172a", fontSize:14 }}>{tps.uniqueTPS}</p>
            <p style={{ color: isDark ? "#94a3b8" : "#94a3b8", fontSize:11 }}>{tps.alamatLengkap || tps.kotaDesa}</p>
          </div>
        </div>
        {(() => {
          const now = Math.floor(Date.now() / 1000);
          const isActive = now >= (tps.startTime || 0) && now <= (tps.endTime || 0);
          return (
            <span style={{ fontSize:10, fontWeight:700, padding:"4px 10px", borderRadius:8, background: isActive ? (isDark ? "rgba(16,185,129,0.15)" : "#f0fdf4") : (isDark ? "#334155" : "#f8fafc"), color: isActive ? "#10b981" : "#94a3b8", border: isActive ? `1px solid ${isDark ? "rgba(16,185,129,0.4)" : "#bbf7d0"}` : `1px solid ${isDark ? "#475569" : "#e2e8f0"}` }}>
              {isActive ? `● ${t.live}` : t.closed}
            </span>
          );
        })()}
      </div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", borderTop:`1px solid ${cardBorder}`, paddingTop:12 }}>
        <button onClick={() => setShowDetail(!showDetail)} style={{ fontSize:12, fontWeight:700, color:"#60a5fa", background:"none", border:"none", cursor:"pointer" }}>
          {showDetail ? t.hideDetails : t.viewDetails}
        </button>
        <div style={{ textAlign:"right" }}>
          <div>
            <span style={{ fontWeight:900, color:"#3b82f6", fontSize:18 }}>{(tps.totalVoters ?? 0).toLocaleString("id-ID")}</span>
            <span style={{ color: isDark ? "#94a3b8" : "#94a3b8", fontSize:10, marginLeft:4 }}>{t.votes}</span>
          </div>
          <div style={{ color: isDark ? "#64748b" : "#64748b", fontSize:10, fontWeight:600 }}>
            {t.maxVotes}: {(tps.registeredVoters ?? 0).toLocaleString("id-ID")}
          </div>
        </div>
      </div>

      {!showDetail && tps.categories.length > 0 && (
        <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${cardBorder}` }}>
          {explodeCategories(tps.categories, t).slice(0, 1).map((cat: CategoryResult) => (
            <div key={`${cat.categoryType}-${cat.label}`}>
              <p style={{ fontSize:10, fontWeight:800, color: isDark ? "#94a3b8" : "#64748b", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.05em", display:"flex", justifyContent:"space-between" }}>
                <span>{t.summary} {cat.label}</span>
                <span>{cat.totalVotes.toLocaleString("id-ID")} {t.votes}</span>
              </p>
              <CategoryCharts cat={cat} isDark={isDark} lang={lang} horizontal={true} />
            </div>
          ))}
        </div>
      )}

      {showDetail && tps.categories.length > 0 && (
        <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:16 }}>
          {explodeCategories(tps.categories, t).map((cat: CategoryResult) => (
            <div key={`${cat.categoryType}-${cat.label}`}>
              <p style={{ fontSize:11, fontWeight:800, color: isDark ? "#94a3b8" : "#64748b", marginBottom:12, textTransform:"uppercase", letterSpacing:"0.05em", padding:"6px 12px", background: isDark ? "#334155" : "#f8fafc", borderRadius:8, display:"inline-block" }}>{cat.label}</p>
              <CategoryCharts cat={cat} isDark={isDark} lang={lang} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
