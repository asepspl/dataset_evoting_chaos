"use client";

import React from "react";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  val: string;
  unit: string;
  color: string;
  isDark: boolean;
  subValue?: string;
}

export default function StatCard({ icon, label, val, unit, color, isDark, subValue }: StatCardProps) {
  const colorsLight: Record<string, { bg: string; border: string; iconBg: string }> = {
    blue:    { bg:"#eff6ff", border:"#dbeafe", iconBg:"#dbeafe" },
    violet:  { bg:"#f5f3ff", border:"#ede9fe", iconBg:"#ede9fe" },
    emerald: { bg:"#ecfdf5", border:"#d1fae5", iconBg:"#d1fae5" },
  };
  const colorsDark: Record<string, { bg: string; border: string; iconBg: string }> = {
    blue:    { bg:"rgba(59,130,246,0.15)", border:"rgba(59,130,246,0.3)", iconBg:"rgba(59,130,246,0.25)" },
    violet:  { bg:"rgba(139,92,246,0.15)", border:"rgba(139,92,246,0.3)", iconBg:"rgba(139,92,246,0.25)" },
    emerald: { bg:"rgba(16,185,129,0.15)", border:"rgba(16,185,129,0.3)", iconBg:"rgba(16,185,129,0.25)" },
  };
  
  const c = isDark ? (colorsDark[color] || colorsDark.blue) : (colorsLight[color] || colorsLight.blue);
  const themeText = isDark ? "#f1f5f9" : "#0f172a";
  const themeTextMuted = isDark ? "#94a3b8" : "#64748b";

  // Adaptive font size based on value length
  const fontSize = val.length > 11 ? 16 : val.length > 8 ? 19 : 21;

  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding: subValue ? "8px 14px" : "10px 14px", borderRadius:12, background:c.bg, border:`1px solid ${c.border}`, transition:"all 0.2s" }}>
      <div style={{ width:32, height:32, borderRadius:8, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:c.iconBg, color: color==="blue"?"#60a5fa":color==="violet"?"#a78bfa":"#34d399" }}>
        {React.cloneElement(icon as React.ReactElement<any>, { size: 14 })}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize:9, fontWeight:800, color:themeTextMuted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:2 }}>{label}</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <p style={{ fontSize, fontWeight:900, color:themeText, lineHeight:1, whiteSpace: "nowrap" }}>{val}</p>
          <p style={{ fontSize:10, color:themeTextMuted, fontWeight: 600 }}>{unit}</p>
        </div>
        {subValue && (
          <p style={{ fontSize:9.5, color:themeTextMuted, fontWeight: 600, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {subValue}
          </p>
        )}
      </div>
    </div>
  );
}
