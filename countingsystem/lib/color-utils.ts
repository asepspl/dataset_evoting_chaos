export const PALETTE = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#ec4899","#84cc16","#f97316"];

export const PARTY_COLORS: Record<string, string> = {
  "PKB": "#00a651", "GERINDRA": "#f3f4f6", "PDI": "#ed1c24", "PDI-P": "#ed1c24",
  "GOLKAR": "#ffff00", "NASDEM": "#1b3e98", "BURUH": "#ff8c00", "GELORA": "#00aeef",
  "PKS": "#f7941d", "PKN": "#8b0000", "HANURA": "#a52a2a", "GARUDA": "#000080",
  "PAN": "#0000ff", "PBB": "#008000", "DEMOKRAT": "#0054a6", "PSI": "#ff0000",
  "PERINDO": "#000033", "PPP": "#006400", "UMMAT": "#333333",
};

export function getCandidateColor(name: string, index: number): string {
  const upper = name.toUpperCase();
  for (const [key, color] of Object.entries(PARTY_COLORS)) {
    if (upper.includes(key)) return color;
  }
  return PALETTE[index % PALETTE.length];
}

export function voteColor(voters: number, max: number): string {
  if (voters === 0 || max === 0) return "#94a3b8";
  const t = voters / max;
  if (t > 0.75) return "#1d4ed8";
  if (t > 0.50) return "#3b82f6";
  if (t > 0.25) return "#60a5fa";
  return "#93c5fd";
}

export const KAB_COLORS = [
  "#3b82f6","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899","#84cc16",
  "#f97316","#6366f1","#14b8a6","#a855f7","#eab308","#22c55e","#e11d48","#0ea5e9",
  "#d946ef","#65a30d","#dc2626","#7c3aed","#059669","#ca8a04","#db2777","#2563eb",
  "#16a34a","#9333ea","#0891b2","#c026d3","#d97706","#4f46e5","#0d9488","#b91c1c",
];
