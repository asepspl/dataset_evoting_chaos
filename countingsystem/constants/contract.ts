import { getContract, createThirdwebClient, defineChain } from "thirdweb";

export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID as string,
});

export const monadChain = defineChain({
  id: 10143,
  rpc: "https://testnet-rpc.monad.xyz",
});

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as string;

export const CANDIDATE_TYPE = {
  PRESIDEN: 0, DPR_RI: 1, DPD_RI: 2,
  DPRD_PROV: 3, DPRD_KAB_KOTA: 4, GUBERNUR: 5,
  BUPATI: 6, WALIKOTA: 7, KADES: 8,
} as const;

export type CandidateTypeValue = typeof CANDIDATE_TYPE[keyof typeof CANDIDATE_TYPE];

export const CANDIDATE_TYPE_LABELS: Record<CandidateTypeValue, string> = {
  0: "Presiden & Wapres", 1: "DPR RI / Partai", 2: "DPD RI",
  3: "DPRD Provinsi", 4: "DPRD Kab/Kota", 5: "Gubernur & Wagub",
  6: "Bupati & Wabup", 7: "Walikota & Wawali", 8: "Kepala Desa",
};

export const VOTING_ABI = [
  { "type": "constructor", "inputs": [], "stateMutability": "nonpayable" },
  { "type": "event", "name": "TPSCreated", "inputs": [{ "name": "tpsId", "type": "uint256", "indexed": true }, { "name": "uniqueTPS", "type": "string", "indexed": false }, { "name": "merkleRoot", "type": "bytes32", "indexed": false }] },
  { "type": "event", "name": "VoteBatchCast", "inputs": [{ "name": "tpsId", "type": "uint256", "indexed": true }, { "name": "voterLeaf", "type": "bytes32", "indexed": true }, { "name": "candidateIds", "type": "uint256[]", "indexed": false }] },
  { "type": "function", "name": "tpsEvents", "inputs": [{ "name": "", "type": "uint256" }], "outputs": [{ "name": "uniqueTPS", "type": "string" }, { "name": "merkleRoot", "type": "bytes32" }, { "name": "provinsi", "type": "string" }, { "name": "kotaDesa", "type": "string" }, { "name": "alamatLengkap", "type": "string" }, { "name": "startTime", "type": "uint256" }, { "name": "endTime", "type": "uint256" }, { "name": "registeredVoters", "type": "uint256" }, { "name": "totalVoters", "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "getCandidatesByType", "inputs": [{ "name": "_tpsId", "type": "uint256" }, { "name": "_cType", "type": "uint8" }], "outputs": [{ "name": "", "type": "tuple[]", "components": [{ "name": "id", "type": "uint256" }, { "name": "firstName", "type": "string" }, { "name": "lastName", "type": "string" }, { "name": "description", "type": "string" }, { "name": "photoIPFS", "type": "string" }, { "name": "candidateType", "type": "uint8" }, { "name": "voteCount", "type": "uint256" }, { "name": "exists", "type": "bool" }] }], "stateMutability": "view" },
  { "type": "function", "name": "getTpsCount", "inputs": [], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "getAllTpsIds", "inputs": [], "outputs": [{ "name": "", "type": "uint256[]" }], "stateMutability": "view" },
] as const;

export const votingContract = getContract({
  client, chain: monadChain, address: CONTRACT_ADDRESS, abi: VOTING_ABI,
});
