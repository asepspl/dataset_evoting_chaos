import { NextResponse } from "next/server";
import { fetchNasionalResults } from "@/lib/aggregator";

export const dynamic = "force-dynamic";

// [NEW-08 FIX] Validasi format IP dari x-forwarded-for untuk mencegah IP spoofing & memory injection.
const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]{3,39}$/;
function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const candidate = forwarded ? forwarded.split(",")[0].trim() : "";
  if (candidate && IP_REGEX.test(candidate)) return candidate;
  return "unknown";
}

// [NEW-08 FIX] Rate limit untuk force-refresh agar tidak bisa di-abuse.
// [NEW-09 FIX] Tambahkan batas entri maksimum (LRU cap) untuk mencegah memory exhaustion dari flood IP unik.
const refreshRateLimit = new Map<string, number>();
const REFRESH_COOLDOWN_MS = 30 * 1000; // Force refresh maks sekali per 30 detik per IP
const MAX_RL_ENTRIES = 5_000; // Batas entri maksimum — mencegah memory exhaustion

// LRU cleanup — hapus entri expired + paling lama jika melebihi batas
function cleanupRefreshRateLimit() {
  if (refreshRateLimit.size <= MAX_RL_ENTRIES) return;
  const now = Date.now();
  // Hapus entri yang sudah lewat cooldown terlebih dahulu
  for (const [ip, ts] of refreshRateLimit.entries()) {
    if (now - ts > REFRESH_COOLDOWN_MS) refreshRateLimit.delete(ip);
  }
  // Jika masih terlalu besar, hapus entri paling lama (LRU)
  if (refreshRateLimit.size > MAX_RL_ENTRIES) {
    const toDelete = [...refreshRateLimit.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, refreshRateLimit.size - MAX_RL_ENTRIES);
    for (const [ip] of toDelete) refreshRateLimit.delete(ip);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh   = searchParams.get("refresh") === "1";
    const provinsiFilter = searchParams.get("provinsi");

    // Lindungi endpoint force-refresh dari abuse
    if (forceRefresh) {
      const ip = getClientIp(request);
      // [NEW-08 FIX] Blokir IP 'unknown' agar tidak bisa bypass rate limit dengan header palsu
      if (ip === "unknown") {
        return NextResponse.json(
          { success: false, message: "Permintaan tidak dapat diidentifikasi." },
          { status: 403 }
        );
      }
      const lastRefresh = refreshRateLimit.get(ip) || 0;
      if (Date.now() - lastRefresh < REFRESH_COOLDOWN_MS) {
        return NextResponse.json(
          { success: false, message: "Terlalu sering refresh. Tunggu 30 detik." },
          { status: 429 }
        );
      }
      cleanupRefreshRateLimit(); // [NEW-09 FIX] Jalankan cleanup sebelum insert
      refreshRateLimit.set(ip, Date.now());
    }

    const data = await fetchNasionalResults(forceRefresh);

    if (provinsiFilter) {
      // --- VALIDASI PANJANG STRING FILTER (MAX 100 KARAKTER) ---
      if (provinsiFilter.length > 100) {
        return NextResponse.json(
          { success: false, message: "Filter provinsi tidak valid. Terlalu panjang." },
          { status: 400 }
        );
      }

      const provinsiData = data.byProvinsi.find(
        p => p.provinsi.toLowerCase() === provinsiFilter.toLowerCase()
      );
      if (!provinsiData) {
        return NextResponse.json({ success: false, message: "Provinsi tidak ditemukan." }, { status: 404 });
      }
      return NextResponse.json({ success: true, provinsi: provinsiData, lastUpdated: data.lastUpdated });
    }

    return NextResponse.json({ success: true, ...data });

  } catch (error: unknown) {
    // Jangan expose detail error internal ke client
    console.error("Results API Error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan saat mengambil data. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
