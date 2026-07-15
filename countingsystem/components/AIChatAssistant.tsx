"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, X, Bot, Loader2 } from "lucide-react";
import type { NasionalResult, ProvinsiResult } from "@/lib/aggregator";
import { translations, type Language, type Translations } from "@/constants/translations";

interface Msg { role: "user"|"assistant"; content: string; }

// ── Province alias map for fuzzy matching ──
const PROV_ALIAS: Record<string,string> = {
  "jakarta":"DKI JAKARTA","dki":"DKI JAKARTA","jkt":"DKI JAKARTA",
  "jabar":"JAWA BARAT","jateng":"JAWA TENGAH","jatim":"JAWA TIMUR",
  "jogja":"DI YOGYAKARTA","yogya":"DI YOGYAKARTA","diy":"DI YOGYAKARTA",
  "sumut":"SUMATERA UTARA","sumbar":"SUMATERA BARAT","sumsel":"SUMATERA SELATAN",
  "kalbar":"KALIMANTAN BARAT","kalteng":"KALIMANTAN TENGAH","kalsel":"KALIMANTAN SELATAN",
  "kaltim":"KALIMANTAN TIMUR","kaltara":"KALIMANTAN UTARA",
  "sulut":"SULAWESI UTARA","sulteng":"SULAWESI TENGAH","sulsel":"SULAWESI SELATAN",
  "sultra":"SULAWESI TENGGARA","ntb":"NUSA TENGGARA BARAT","ntt":"NUSA TENGGARA TIMUR",
  "babel":"KEPULAUAN BANGKA BELITUNG","kepri":"KEPULAUAN RIAU",
  "papbar":"PAPUA BARAT","bogor":"JAWA BARAT","bandung":"JAWA BARAT",
  "surabaya":"JAWA TIMUR","semarang":"JAWA TENGAH","medan":"SUMATERA UTARA",
  "makassar":"SULAWESI SELATAN","denpasar":"BALI","malang":"JAWA TIMUR",
  "bekasi":"JAWA BARAT","tangerang":"BANTEN","depok":"JAWA BARAT",
};

// City-to-kabupaten hint
const CITY_KAB: Record<string,string> = {
  "bogor":"KOTA BOGOR","bandung":"KOTA BANDUNG","surabaya":"KOTA SURABAYA",
  "semarang":"KOTA SEMARANG","medan":"KOTA MEDAN","makassar":"KOTA MAKASSAR",
  "denpasar":"KOTA DENPASAR","malang":"KOTA MALANG","bekasi":"KOTA BEKASI",
  "tangerang":"KOTA TANGERANG","depok":"KOTA DEPOK","solo":"KOTA SURAKARTA",
  "palembang":"KOTA PALEMBANG","padang":"KOTA PADANG","manado":"KOTA MANADO",
  "banjarmasin":"KOTA BANJARMASIN","pontianak":"KOTA PONTIANAK",
  "jakarta selatan":"KOTA JAKARTA SELATAN","jakarta timur":"KOTA JAKARTA TIMUR",
  "jakarta barat":"KOTA JAKARTA BARAT","jakarta utara":"KOTA JAKARTA UTARA",
  "jakarta pusat":"KOTA JAKARTA PUSAT",
};

function findProv(q: string, data: NasionalResult): ProvinsiResult | null {
  const u = q.toUpperCase();
  // Direct name match
  let p = data.byProvinsi.find(p => u.includes(p.provinsi) || p.provinsi.includes(u));
  if (p) return p;
  // Alias match
  for (const [alias, prov] of Object.entries(PROV_ALIAS)) {
    if (u.includes(alias.toUpperCase())) {
      p = data.byProvinsi.find(pp => pp.provinsi === prov);
      if (p) return p;
    }
  }
  // Partial match
  return data.byProvinsi.find(pp => pp.provinsi.split(" ").some(w => u.includes(w) && w.length > 3)) ?? null;
}

function findKabHint(q: string): string | null {
  const l = q.toLowerCase();
  for (const [city, kab] of Object.entries(CITY_KAB)) {
    if (l.includes(city)) return kab;
  }
  return null;
}

function processQuery(q: string, data: NasionalResult, t: Translations): { text: string; action?: { name: string; args: any } } {
  const lower = q.toLowerCase().trim();

  // Greeting
  if (/^(halo|hai|hi|hello|hey|p|helo|siang|pagi|malam)\b/.test(lower)) {
    return { text: `Selamat datang di Pusat Bantuan Data Dashboard Pemilu. Anda dapat menanyakan informasi seperti:\n• "Perolehan suara di DKI Jakarta"\n• "Statistik nasional saat ini"\n• "Kandidat dengan suara tertinggi"` };
  }

  // Help
  if (/^(help|bantu|bisa apa|fitur|menu|panduan|cara)/.test(lower)) {
    return { text: `Saya dapat membantu Anda melakukan navigasi dan analisis data:\n🗺️ **Navigasi** — "Buka Bandung", "Lihat Bali", "Data Jawa Timur"\n📊 **Statistik** — "Total suara?", "Berapa TPS?", "Progres nasional"\n🏆 **Peringkat** — "Siapa unggul?", "Pemenang sementara", "Kandidat terbaik"\n🔍 **Informasi** — "Daftar provinsi", "Jumlah wilayah aktif"` };
  }

  // Total stats
  if (/(total|jumlah|berapa|rekap|progres) (suara|pemilih|voters|data)/.test(lower)) {
    return { text: `📊 **Statistik Nasional:**\n• Total TPS: **${data.totalTPS.toLocaleString("id-ID")}**\n• Suara Masuk: **${data.totalVoters.toLocaleString("id-ID")}**\n• Provinsi Aktif: **${data.byProvinsi.filter(p=>p.totalVoters>0).length}** dari ${data.byProvinsi.length}` };
  }
  if (/(berapa|jumlah|total) tps/.test(lower)) {
    return { text: `📍 Total TPS terdaftar: **${data.totalTPS.toLocaleString("id-ID")}** lokasi di seluruh Indonesia.` };
  }
  if (/(berapa|jumlah|total) provinsi/.test(lower)) {
    return { text: `🗺️ Total provinsi terdata: **${data.byProvinsi.length}** provinsi, dengan **${data.byProvinsi.filter(p=>p.totalVoters>0).length}** wilayah telah mengirimkan data.` };
  }

  // Leading candidate
  if (/(unggul|menang|terdepan|leading|peringkat|ranking|terbaik|kandidat|pemenang|juara)/.test(lower)) {
    const allCats = data.byProvinsi.flatMap(p => p.categories);
    if (allCats.length === 0) return { text: "Belum ada data suara yang masuk untuk menentukan peringkat saat ini." };
    const cat0 = allCats.find(c => c.categoryType === 0);
    if (cat0 && cat0.candidates.length > 0) {
      const top = cat0.candidates[0];
      return { text: `🏆 **Kandidat Unggul Saat Ini (Presiden & Wapres):**\n**${top.name}**\n• Perolehan: **${top.voteCount.toLocaleString("id-ID")}** suara\n• Persentase: **${top.percentage}%**` };
    }
    return { text: "Data peringkat kandidat sedang dikalkulasi, mohon tunggu beberapa saat." };
  }

  // Province with most votes
  if (/(provinsi|wilayah) (ter)?banyak|suara (ter)?tinggi|provinsi (ter)?besar|paling ramai/.test(lower)) {
    const sorted = [...data.byProvinsi].sort((a,b) => b.totalVoters - a.totalVoters);
    const top3 = sorted.slice(0,3);
    const lines = top3.map((p,i) => `${i+1}. **${p.provinsi}** — ${p.totalVoters.toLocaleString("id-ID")} suara`);
    return { text: `🏅 **Top 3 Wilayah dengan Suara Masuk Terbanyak:**\n${lines.join("\n")}` };
  }

  // Navigate to province/city
  const prov = findProv(lower, data);
  if (prov || findKabHint(lower)) {
    if (prov) {
      const kabHint = findKabHint(lower);
      const info = `📍 **Hasil di ${prov.provinsi}:**\n• TPS: ${prov.totalTPS.toLocaleString("id-ID")}\n• Suara: ${prov.totalVoters.toLocaleString("id-ID")}`;
      const actionText = kabHint ? `\n\nMembuka detail **${kabHint}**...` : `\n\nMembuka panel wilayah **${prov.provinsi}**...`;
      return {
        text: info + actionText,
        action: { name: "buka_wilayah", args: { provinsi: prov.provinsi, kabupaten: kabHint } }
      };
    }
    // Try city match even without province context
    const kabHint = findKabHint(lower);
    if (kabHint) {
      const cityKey = Object.keys(CITY_KAB).find(c => lower.includes(c))!;
      const provName = PROV_ALIAS[cityKey];
      if (provName) {
        const provData = data.byProvinsi.find(p => p.provinsi === provName);
        if (provData) {
          return {
            text: `📍 Membuka detail **${kabHint}** di ${provName}...`,
            action: { name: "buka_wilayah", args: { provinsi: provName, kabupaten: kabHint } }
          };
        }
      }
    }
  }

  // List provinces
  if (/(daftar|tampilkan|semua) provinsi/.test(lower)) {
    const names = data.byProvinsi.map(p => p.provinsi).join(", ");
    return { text: `🗺️ **Daftar Provinsi Terdaftar (${data.byProvinsi.length}):**\n${names}` };
  }

  // Fallback
  return { text: t.aiPlaceholder };
}

// ══════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════

export default function AIChatAssistant({ data, isDark = false, lang, onActionTrigger }: {
  data: NasionalResult;
  isDark?: boolean;
  lang: Language;
  onActionTrigger: (name: string, args: any) => void;
}) {
  const t = translations[lang];
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);

  useEffect(() => {
    setMessages([
      { role: "assistant", content: t.aiWelcome }
    ]);
  }, [lang, t.aiWelcome]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen]);

  const sendMessage = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput("");

    const result = processQuery(userMsg, data, t);

    setMessages(prev => [...prev, { role: "user", content: userMsg }, { role: "assistant", content: result.text }]);

    if (result.action) {
      setTimeout(() => onActionTrigger(result.action!.name, result.action!.args), 600);
    }
  }, [input, data, onActionTrigger]);

  const bg = isDark ? "#0f172a" : "#fff";
  const border = isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0";
  const text = isDark ? "#f1f5f9" : "#1e293b";
  const botBubble = isDark ? "#1e293b" : "#f1f5f9";

  return (
    <div style={{ position: "fixed", bottom: 30, right: 30, zIndex: 9999 }}>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity:0, scale:0.9, y:20 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.9, y:20 }}
            style={{ position:"absolute", bottom:80, right:0, width:360, height:480, background:bg, border:`1px solid ${border}`, borderRadius:24, boxShadow:"0 12px 32px rgba(0,0,0,0.2)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
            {/* Header */}
            <div style={{ padding:"16px 20px", background:"linear-gradient(135deg,#3b82f6,#8b5cf6)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ background:"rgba(255,255,255,0.2)", padding:6, borderRadius:12 }}><Bot size={20}/></div>
                <div>
                  <p style={{ fontWeight:800, fontSize:14, lineHeight:1.2 }}>AI Assistant</p>
                  <p style={{ fontSize:10, opacity:0.8 }}>{t.subtitle}</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} style={{ background:"none", border:"none", color:"#fff", cursor:"pointer" }}><X size={18}/></button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:14 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ alignSelf: m.role==="user" ? "flex-end" : "flex-start", maxWidth:"85%" }}>
                  <div style={{
                    padding:"10px 14px", borderRadius:16,
                    borderTopRightRadius: m.role==="user" ? 4 : 16,
                    borderTopLeftRadius: m.role==="assistant" ? 4 : 16,
                    background: m.role==="user" ? "#3b82f6" : botBubble,
                    color: m.role==="user" ? "#fff" : text,
                    fontSize:13, fontWeight:500, lineHeight:1.6, whiteSpace:"pre-line"
                  }}>{m.content}</div>
                </div>
              ))}
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} style={{ padding:"14px 16px", borderTop:`1px solid ${border}`, display:"flex", gap:10 }}>
              <input type="text" value={input} onChange={e => setInput(e.target.value)}
                placeholder={t.aiPlaceholder}
                style={{ flex:1, padding:"10px 14px", borderRadius:99, border:`1px solid ${border}`, background: isDark ? "#1e293b" : "#f8fafc", color:text, outline:"none", fontSize:13 }}
              />
              <button type="submit" disabled={!input.trim()}
                style={{ width:38, height:38, borderRadius:"50%", background: input.trim() ? "#3b82f6" : "#94a3b8", border:"none", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", cursor: input.trim() ? "pointer" : "default" }}>
                <Send size={16}/>
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button onClick={() => setIsOpen(!isOpen)} whileHover={{ scale:1.1 }} whileTap={{ scale:0.9 }}
        style={{ width:56, height:56, borderRadius:"50%", background:"linear-gradient(135deg,#3b82f6,#8b5cf6)", boxShadow:"0 8px 24px rgba(59,130,246,0.4)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff" }}>
        {isOpen ? <X size={24}/> : <MessageSquare size={24}/>}
      </motion.button>
    </div>
  );
}
