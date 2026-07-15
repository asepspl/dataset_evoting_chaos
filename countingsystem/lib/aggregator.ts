import { createThirdwebClient, readContract, getContract, defineChain } from "thirdweb";
import { cacheLife } from "next/dist/server/use-cache/cache-life";
import { CONTRACT_ADDRESS, VOTING_ABI, CANDIDATE_TYPE_LABELS, CandidateTypeValue } from "@/constants/contract";

const client   = createThirdwebClient({ clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "" });
const monadChain = defineChain({ id: 10143, rpc: "https://testnet-rpc.monad.xyz" });
const contract  = getContract({ client, chain: monadChain, address: CONTRACT_ADDRESS, abi: VOTING_ABI });

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CandidateResult  { id: number; name: string; voteCount: number; percentage: number; photoIPFS: string; description?: string; }
export interface CategoryResult   { categoryType: number; label: string; candidates: CandidateResult[]; totalVotes: number; }
export interface TpsResult        { tpsId: number; uniqueTPS: string; provinsi: string; kotaDesa: string; kecamatan: string; kelurahan: string; alamatLengkap: string; totalVoters: number; registeredVoters: number; startTime: number; endTime: number; categories: CategoryResult[]; }

export interface KelurahanResult  { kelurahan: string; totalTPS: number; totalVoters: number; registeredVoters: number; tpsList: TpsResult[]; categories: CategoryResult[]; }
export interface KecamatanResult  { kecamatan: string; totalTPS: number; totalVoters: number; registeredVoters: number; kelurahanList: KelurahanResult[]; tpsList: TpsResult[]; categories: CategoryResult[]; }
export interface KabupatenResult  { kabupaten: string; totalTPS: number; totalVoters: number; registeredVoters: number; kecamatanList: KecamatanResult[]; tpsList: TpsResult[]; categories: CategoryResult[]; }
export interface ProvinsiResult   { provinsi: string; totalTPS: number; totalVoters: number; registeredVoters: number; kabupatenList: KabupatenResult[]; tpsList: TpsResult[]; categories: CategoryResult[]; }
export interface NasionalResult   { totalTPS: number; totalVoters: number; registeredVoters: number; byProvinsi: ProvinsiResult[]; lastUpdated: string; }
// ── In-memory cache ─────────────────────────────────────────────────────────────
let cachedData: NasionalResult | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 60 seconds

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 4, delayMs = 500): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isRateLimit = err?.code === -32011 || err?.message?.includes("limited");
      if (isRateLimit && attempt < retries) {
        const wait = delayMs * Math.pow(2, attempt); // exponential backoff: 500, 1000, 2000, 4000ms
        console.warn(`[RPC] Rate limited, retry ${attempt + 1}/${retries} in ${wait}ms...`);
        await sleep(wait);
      } else {
        throw err;
      }
    }
  }
  throw new Error("Max retries exceeded");
}

async function processBatch<T, R>(items: T[], batchSize: number, delayBetweenMs: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch   = items.slice(i, i + batchSize);
    const batchResult = await Promise.all(batch.map(fn));
    results.push(...batchResult);
    if (i + batchSize < items.length) {
      await sleep(delayBetweenMs);
    }
  }
  return results;
}

// ── Parse kecamatan & kelurahan dari alamatLengkap ────────────────────────────

function parseAlamat(alamat: string, defaultKotaDesa: string): { kabupaten: string; kecamatan: string; kelurahan: string } {
  let kabupaten = "";
  let kecamatan = "";
  let kelurahan = "";

  // 1. Ekstrak Kabupaten/Kota (Format: "Kab/Kota KOTA JAKARTA TIMUR")
  const kabMatch = alamat.match(/(?:Kab\/Kota|Kabupaten|Kota)\.?\s+([^,]+)/i);
  if (kabMatch) kabupaten = kabMatch[1].trim().toUpperCase();

  // 2. Ekstrak Kecamatan (Format: "Kec. CIRACAS")
  const kecMatch = alamat.match(/Kec(?:amatan)?\.?\s*([^,]+)/i);
  if (kecMatch) kecamatan = kecMatch[1].trim().toUpperCase();

  // 3. Ekstrak Kelurahan (Format: "Kel. CIBUBUR")
  const kelMatch = alamat.match(/Kel(?:urahan)?\.?\s*([^,]+)/i);
  if (kelMatch) kelurahan = kelMatch[1].trim().toUpperCase();

  const rawBlockchainKotaDesa = defaultKotaDesa.trim().toUpperCase();

  // 4. Smart Fallbacks
  if (!kabupaten) {
    // Jika di alamat tidak ditemukan prefix Kab/Kota, gunakan field blockchain
    kabupaten = rawBlockchainKotaDesa || "TIDAK DIKETAHUI";
  }

  if (!kelurahan) {
    // Jika kelurahan belum ketemu dan data blockchain bukan nama kabupaten, pakai itu sebagai kelurahan
    if (rawBlockchainKotaDesa && rawBlockchainKotaDesa !== kabupaten) {
      kelurahan = rawBlockchainKotaDesa;
    } else {
      kelurahan = "TIDAK DIKETAHUI";
    }
  }

  return { 
    kabupaten: kabupaten || "TIDAK DIKETAHUI", 
    kecamatan: kecamatan || "TIDAK DIKETAHUI", 
    kelurahan: kelurahan || "TIDAK DIKETAHUI" 
  };
}

// ── Aggregate categories from TPS list ────────────────────────────────────────

function aggregateCategories(tpsList: TpsResult[]): CategoryResult[] {
  const catMap = new Map<number, CategoryResult>();
  for (const tps of tpsList) {
    for (const cat of tps.categories) {
      if (!catMap.has(cat.categoryType)) {
        catMap.set(cat.categoryType, { ...cat, candidates: cat.candidates.map(c => ({ ...c })) });
      } else {
        const ex = catMap.get(cat.categoryType)!;
        for (const cand of cat.candidates) {
          const found = ex.candidates.find(ec => ec.name === cand.name);
          if (found) found.voteCount += cand.voteCount;
          else       ex.candidates.push({ ...cand });
        }
        ex.totalVotes += cat.totalVotes;
      }
    }
  }
  for (const cat of catMap.values()) {
    for (const c of cat.candidates) {
      c.percentage = cat.totalVotes > 0 ? Math.round((c.voteCount / cat.totalVotes) * 1000) / 10 : 0;
    }
    cat.candidates.sort((a, b) => b.voteCount - a.voteCount);
  }
  return Array.from(catMap.values());
}

// ── Core Fetcher ──────────────────────────────────────────────────────────────

const DOMESTIC_PROVINCES = new Set([
  "ACEH", "SUMATERA UTARA", "SUMATERA BARAT", "RIAU", "KEPULAUAN RIAU", "JAMBI", "SUMATERA SELATAN",
  "KEPULAUAN BANGKA BELITUNG", "BENGKULU", "LAMPUNG", "DKI JAKARTA", "JAWA BARAT", "BANTEN",
  "JAWA TENGAH", "DI YOGYAKARTA", "JAWA TIMUR", "BALI", "NUSA TENGGARA BARAT", "NUSA TENGGARA TIMUR",
  "KALIMANTAN BARAT", "KALIMANTAN TENGAH", "KALIMANTAN SELATAN", "KALIMANTAN TIMUR", "KALIMANTAN UTARA",
  "SULAWESI UTARA", "GORONTALO", "SULAWESI TENGAH", "SULAWESI BARAT", "SULAWESI SELATAN",
  "SULAWESI TENGGARA", "MALUKU", "MALUKU UTARA", "PAPUA BARAT", "PAPUA", "PAPUA SELATAN",
  "PAPUA TENGAH", "PAPUA PEGUNUNGAN", "PAPUA BARAT DAYA"
]);

export async function fetchNasionalResults(forceRefresh = false): Promise<NasionalResult> {
  const now = Date.now();
  if (!forceRefresh && cachedData && (now - lastFetchTime < CACHE_TTL)) {
    console.log("[Aggregator] Returning cached data.");
    return cachedData;
  }

  console.log("[Aggregator] Fetching fresh data from blockchain...");

  try {
    // 1. Ambil total TPS
    const tpsCount = await withRetry(() => readContract({ contract, method: "getTpsCount", params: [] }));
    const total    = Number(tpsCount);
    console.log(`[Aggregator] Found ${total} TPS on blockchain.`);

  if (total === 0) {
    return { totalTPS: 0, totalVoters: 0, registeredVoters: 0, byProvinsi: [], lastUpdated: new Date().toISOString() };
  }

  const tpsIds = Array.from({ length: total }, (_, i) => BigInt(i + 1));

  // 2. Fetch info TPS dalam batch (5 sekaligus, jeda 300ms)
  const tpsInfoList = await processBatch(tpsIds, 5, 300, id =>
    withRetry(() => readContract({ contract, method: "tpsEvents", params: [id] }))
  );

  // 3. Fetch kandidat per TPS secara sequential per TPS, kategori dalam batch kecil
  const allResults: TpsResult[] = await processBatch(tpsIds, 3, 400, async (id) => {
    const idx  = Number(id) - 1;
    const info = tpsInfoList[idx] as any;
    const parsed = parseAlamat(info[4] || "", info[3] || "");

    // Fetch 9 kategori dalam 3 batch (3 kategori per batch, jeda 200ms)
    const catNums = [0,1,2,3,4,5,6,7,8];
    const categoryResults = await processBatch(catNums, 3, 200, async cType => {
      const candidates = await withRetry(() =>
        readContract({ contract, method: "getCandidatesByType", params: [id, cType] })
      ) as any[];

      if (!candidates || candidates.length === 0) return null;

      const totalVotes = candidates.reduce((s, c) => s + Number(c.voteCount), 0);
      const mapped: CandidateResult[] = candidates.map(c => {
        const isPairCategory = cType === 0 || cType === 5 || cType === 6 || cType === 7;
        const fName = String(c.firstName || "").replace(/\s+/g, " ").trim();
        const lName = String(c.lastName || "").replace(/\s+/g, " ").trim();
        
        const fFirst = fName.split(" ")[0];
        const lFirst = lName.split(" ")[0];
        
        let fullName = isPairCategory && fFirst && lFirst
          ? `${fFirst} dan ${lFirst}`
          : `${fName} ${lName}`.trim();

        // Enforce clean, standardized first-name pair names for presidential candidates
        if (cType === 0) {
          const lower = fullName.toLowerCase();
          if (lower.includes("anies")) {
            fullName = "Anies dan Muhaimin";
          } else if (lower.includes("prabowo")) {
            fullName = "Prabowo dan Gibran";
          } else if (lower.includes("ganjar")) {
            fullName = "Ganjar dan Mahfud";
          }
        }

        return {
          id:         Number(c.id),
          name:       fullName.replace(/\s+/g, " ").trim(),
          voteCount:  Number(c.voteCount),
          percentage: totalVotes > 0 ? Math.round((Number(c.voteCount) / totalVotes) * 1000) / 10 : 0,
          photoIPFS:  c.photoIPFS,
          description: String(c.description || ""),
        };
      });

      return {
        categoryType: cType,
        label:        CANDIDATE_TYPE_LABELS[cType as CandidateTypeValue],
        candidates:   mapped.sort((a, b) => b.voteCount - a.voteCount),
        totalVotes,
      } as CategoryResult;
    });

    const rawProv = String(info[2] || "").trim().toUpperCase();
    const isDomestic = DOMESTIC_PROVINCES.has(rawProv);
    const isOverseas = !isDomestic && rawProv !== "TIDAK DIKETAHUI" && rawProv !== "NASIONAL" && rawProv !== "";

    let finalProv = info[2] || "TIDAK DIKETAHUI";
    let finalKotaDesa = parsed.kabupaten;

    if (isOverseas) {
      finalProv = "LUAR NEGERI";
      const countryStr = rawProv;
      const embassyStr = parsed.kabupaten;
      if (embassyStr && embassyStr !== "TIDAK DIKETAHUI" && !embassyStr.toUpperCase().includes(countryStr)) {
        finalKotaDesa = `${countryStr} - ${embassyStr}`;
      } else {
        finalKotaDesa = embassyStr || countryStr;
      }
    }

    return {
      tpsId:         Number(id),
      uniqueTPS:     info[0],
      provinsi:      finalProv,
      kotaDesa:      finalKotaDesa, // MENGGUNAKAN HASIL PARSE KABUPATEN/KOTA YANG DISESUAIKAN UNTUK AGREGASI UTAMA
      kecamatan:     parsed.kecamatan,
      kelurahan:     parsed.kelurahan,
      alamatLengkap: info[4],
      startTime:     Number(info[5]),
      endTime:       Number(info[6]),
      registeredVoters: Number(info[7]), // [v2] index 7 = registeredVoters (DPT)
      totalVoters:   Number(info[8]), // [v2] index 8 = totalVoters (jumlah pemilih yang sudah mencoblos)
      categories:    categoryResults.filter(Boolean) as CategoryResult[],
    } as TpsResult;
  });

  // 4. Agregasi hirarkis: Provinsi → Kabupaten → Kecamatan → Kelurahan → TPS
  const byProvinsiMap = new Map<string, TpsResult[]>();
  for (const tps of allResults) {
    const prov = tps.provinsi || "TIDAK DIKETAHUI";
    if (!byProvinsiMap.has(prov)) byProvinsiMap.set(prov, []);
    byProvinsiMap.get(prov)!.push(tps);
  }

  const byProvinsi: ProvinsiResult[] = Array.from(byProvinsiMap.entries()).map(([provinsi, provTpsList]) => {
    // Group by Kabupaten
    const byKabMap = new Map<string, TpsResult[]>();
    for (const tps of provTpsList) {
      const kab = tps.kotaDesa || "TIDAK DIKETAHUI";
      if (!byKabMap.has(kab)) byKabMap.set(kab, []);
      byKabMap.get(kab)!.push(tps);
    }

    const kabupatenList: KabupatenResult[] = Array.from(byKabMap.entries()).map(([kabupaten, kabTpsList]) => {
      // Group by Kecamatan
      const byKecMap = new Map<string, TpsResult[]>();
      for (const tps of kabTpsList) {
        const kec = tps.kecamatan || "TIDAK DIKETAHUI";
        if (!byKecMap.has(kec)) byKecMap.set(kec, []);
        byKecMap.get(kec)!.push(tps);
      }

      const kecamatanList: KecamatanResult[] = Array.from(byKecMap.entries()).map(([kecamatan, kecTpsList]) => {
        // Group by Kelurahan
        const byKelMap = new Map<string, TpsResult[]>();
        for (const tps of kecTpsList) {
          const kel = tps.kelurahan || "TIDAK DIKETAHUI";
          if (!byKelMap.has(kel)) byKelMap.set(kel, []);
          byKelMap.get(kel)!.push(tps);
        }

        const kelurahanList: KelurahanResult[] = Array.from(byKelMap.entries()).map(([kelurahan, kelTpsList]) => ({
          kelurahan,
          totalTPS:    kelTpsList.length,
          totalVoters: kelTpsList.reduce((s, t) => s + t.totalVoters, 0),
          registeredVoters: kelTpsList.reduce((s, t) => s + t.registeredVoters, 0),
          tpsList:     kelTpsList,
          categories:  aggregateCategories(kelTpsList),
        })).sort((a, b) => b.totalVoters - a.totalVoters);

        return {
          kecamatan,
          totalTPS:      kecTpsList.length,
          totalVoters:   kecTpsList.reduce((s, t) => s + t.totalVoters, 0),
          registeredVoters: kecTpsList.reduce((s, t) => s + t.registeredVoters, 0),
          kelurahanList,
          tpsList:       kecTpsList,
          categories:    aggregateCategories(kecTpsList),
        };
      }).sort((a, b) => b.totalVoters - a.totalVoters);

      return {
        kabupaten,
        totalTPS:      kabTpsList.length,
        totalVoters:   kabTpsList.reduce((s, t) => s + t.totalVoters, 0),
        registeredVoters: kabTpsList.reduce((s, t) => s + t.registeredVoters, 0),
        kecamatanList,
        tpsList:       kabTpsList,
        categories:    aggregateCategories(kabTpsList),
      };
    }).sort((a, b) => b.totalVoters - a.totalVoters);

    return {
      provinsi,
      totalTPS:      provTpsList.length,
      totalVoters:   provTpsList.reduce((s, t) => s + t.totalVoters, 0),
      registeredVoters: provTpsList.reduce((s, t) => s + t.registeredVoters, 0),
      kabupatenList,
      tpsList:       provTpsList,
      categories:    aggregateCategories(provTpsList),
    };
  });

    const result: NasionalResult = {
      totalTPS:    total,
      totalVoters: allResults.reduce((s, t) => s + t.totalVoters, 0),
      registeredVoters: allResults.reduce((s, t) => s + t.registeredVoters, 0),
      byProvinsi:  byProvinsi.sort((a, b) => b.totalVoters - a.totalVoters),
      lastUpdated: new Date().toISOString(),
    };

    cachedData = result;
    lastFetchTime = Date.now();

    console.log(`[Aggregator] Done. ${total} TPS.`);
    return result;

  } catch (err: any) {
    console.error("[Aggregator] FATAL ERROR:", err);
    throw err;
  }
}
