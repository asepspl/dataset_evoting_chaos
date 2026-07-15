"use client";

import { translations, type Language } from "@/constants/translations";

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  isDark?: boolean;
  lang?: Language;
}

export default function ChartTooltip({ active, payload, label, isDark, lang = "id" }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ 
      background: isDark ? "#1e293b" : "#fff", 
      border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, 
      borderRadius: 14, 
      padding: "10px 14px", 
      boxShadow: "0 4px 16px rgba(0,0,0,0.2)" 
    }}>
      <p style={{ fontWeight: 700, color: isDark ? "#94a3b8" : "#475569", fontSize: 12, marginBottom: 2 }}>{label}</p>
      <p style={{ fontWeight: 900, color: "#3b82f6", fontSize: 18 }}>{Number(payload[0].value).toLocaleString("id-ID")}</p>
      <p style={{ color: isDark ? "#64748b" : "#94a3b8", fontSize: 10 }}>{translations[lang].votes}</p>
    </div>
  );
}
