require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// ─────────────────────────────────────────────────────────────────────────────
// Ambil private key dari .env — JANGAN hardcode private key di sini!
// ─────────────────────────────────────────────────────────────────────────────
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  throw new Error("[SECURITY] PRIVATE_KEY tidak ditemukan di .env! Buat file .env dengan PRIVATE_KEY=0x...");
}
const MONAD_RPC_URL = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";


/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  // ── Solidity Compiler ────────────────────────────────────────────────────
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      // SOLUSI: Diaktifkan untuk mengatasi error 'Stack too deep'
      viaIR: true, 
      evmVersion: "paris", // Monad kompatibel dengan EVM Paris
    },
  },

  // ── Networks ─────────────────────────────────────────────────────────────
  networks: {
    // Localhost (default untuk testing lokal)
    hardhat: {
      chainId: 31337,
    },

    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },

    // ── Monad Testnet ──────────────────────────────────────────────────────
    monadTestnet: {
      url: MONAD_RPC_URL,
      chainId: 10143,
      accounts: [PRIVATE_KEY],
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1.2,
      timeout: 60000, 
    },
  },

  // ── Etherscan / Block Explorer Verification ───────────────────────────────
  etherscan: {
    apiKey: {
      monadTestnet: process.env.MONADSCAN_API_KEY || "placeholder",
    },
    customChains: [
      {
        network: "monadTestnet",
        chainId: 10143,
        urls: {
          apiURL: "https://testnet.monadexplorer.com/api",
          browserURL: "https://testnet.monadexplorer.com",
        },
      },
    ],
  },

  // ── Gas Reporter ──────────────────────────────────────────────────────────
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
    token: "MON",
  },

  // ── Paths ─────────────────────────────────────────────────────────────────
  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },

  // ── Mocha ─────────────────────────────────────────────────────────────────
  mocha: {
    timeout: 120000,
  },
};