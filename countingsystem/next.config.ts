import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Logging — nonaktifkan fullUrl di production untuk mencegah kebocoran URL ──
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === "development",
    },
  },

  // ── Image Optimization ────────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "gateway.ipfs.io" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
    ],
  },

  // ── HTTP Security Headers (Wajib untuk Production) ───────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Anti-Clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Cegah MIME sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Batasi referrer info
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Paksa HTTPS selama 1 tahun + subdomains + preload
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          // Batasi fitur browser
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // [NEW-07 FIX] XSS Protection legacy browser — konsisten dengan sistem lain
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // [NEW-07 FIX] Isolasi window cross-origin
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // [CS-10 FIXED] dangerouslySetInnerHTML dihapus dari layout.tsx
              // [MED-04 FIX] unsafe-eval hanya untuk dev — dihapus dari production build
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://fonts.googleapis.com`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://ipfs.io https://gateway.ipfs.io https://cloudflare-ipfs.com https:",
              // Monad RPC + ThirdWeb + Gemini AI
              "connect-src 'self' https://*.monad.xyz https://testnet-rpc.monad.xyz https://*.thirdweb.com https://*.walletconnect.com wss://*.walletconnect.com https://generativelanguage.googleapis.com",
              "frame-src 'none'",
              // [NEW-07 FIX] frame-ancestors menggantikan X-Frame-Options (lebih kuat, mencegah clickjacking modern)
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              // [NEW-07 FIX] Cegah form submit ke domain eksternal
              "form-action 'self'",
              // [NEW-07 FIX] Auto-upgrade HTTP ke HTTPS
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
