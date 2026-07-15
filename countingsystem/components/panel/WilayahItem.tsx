"use client";

import React from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { translations, type Language } from "@/constants/translations";
import { getLocalizedAdminName } from "@/constants/provinces";

interface WilayahItemProps {
  rank: number;
  name: string;
  tpsCount: number;
  voters: number;
  registeredVoters?: number;
  onClick: () => void;
  color: string;
  isDark: boolean;
  lang: Language;
}

export default function WilayahItem({ rank, name, tpsCount, voters, registeredVoters, onClick, color, isDark, lang }: WilayahItemProps) {
  const t = translations[lang];
  const itemBg = isDark ? "#1e293b" : "#fff";
  const itemBorder = isDark ? "#334155" : "#f1f5f9";
  const hoverBg = isDark ? "#334155" : "#f8fafc";
  const hoverBorder = isDark ? "#475569" : "#bfdbfe";

  return (
    <motion.button initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay: rank * 0.03 }}
      onClick={onClick}
      style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px", borderRadius:14, border:`1px solid ${itemBorder}`, background:itemBg, cursor:"pointer", width:"100%", textAlign:"left", transition:"all 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = hoverBorder; e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = itemBorder; e.currentTarget.style.background = itemBg; }}
    >
      <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:`${color}25`, color, fontWeight:900, fontSize:14 }}>{rank}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontWeight:800, color: isDark ? "#f1f5f9" : "#0f172a", fontSize:14, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{getLocalizedAdminName(name, lang)}</p>
        <p style={{ color: isDark ? "#94a3b8" : "#94a3b8", fontSize:11, marginTop:2 }}>
          {tpsCount} {t.tpsUnit} · {(voters ?? 0).toLocaleString("id-ID")} {t.votes}
        </p>
        {registeredVoters !== undefined && registeredVoters !== null && (
          <p style={{ color: isDark ? "#64748b" : "#64748b", fontSize:10, marginTop:1, fontWeight:600 }}>
            {t.maxVotes}: {(registeredVoters ?? 0).toLocaleString("id-ID")}
          </p>
        )}
      </div>
      <ChevronRight size={16} style={{ color: isDark ? "#475569" : "#cbd5e1", flexShrink:0 }} />
    </motion.button>
  );
}
