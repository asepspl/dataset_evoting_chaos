// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library MerkleProof {
    function verify(bytes32[] memory proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement)
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            else
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
        }
        return computedHash == root;
    }
}

contract VotingSystem {
    using MerkleProof for bytes32[];

    enum CandidateType {
        PRESIDEN,       // 0
        DPR_RI,         // 1
        DPD_RI,         // 2
        DPRD_PROV,      // 3
        DPRD_KAB_KOTA,  // 4
        GUBERNUR,       // 5
        BUPATI,         // 6
        WALIKOTA,       // 7
        KADES           // 8
    }

    struct Candidate {
        uint256 id;
        string firstName;
        string lastName;
        string description;
        string photoIPFS;
        CandidateType candidateType;
        uint256 voteCount;
        bool exists;
    }

    struct CandidateInput {
        string firstName;
        string lastName;
        string description;
        string photoIPFS;
        CandidateType cType;
    }

    // [HIGH-02 FIX] Pisahkan registeredVoters (DPT) dari totalVoters (yang sudah mencoblos).
    // registeredVoters: jumlah pemilih terdaftar (DPT), diset saat createTPS, TIDAK BISA diubah.
    // totalVoters:      jumlah pemilih yang sudah mencoblos, naik setiap castVote.
    // Dengan pemisahan ini, dashboard bisa menampilkan persentase partisipasi yang akurat.
    struct TPSEvent {
        string uniqueTPS;
        bytes32 merkleRoot;
        string provinsi;
        string kotaDesa;
        string alamatLengkap;
        uint256 startTime;
        uint256 endTime;
        uint256 registeredVoters; // [HIGH-02] DPT — jumlah pemilih terdaftar (immutable setelah createTPS)
        uint256 totalVoters;      // [HIGH-02] Jumlah yang sudah mencoblos (bertambah setiap castVote)
    }

    address public admin;
    address public pendingAdmin;
    uint256 private _tpsCounter;
    uint256 public constant MIN_TPS_DURATION = 1 hours;

    mapping(uint256 => uint256) private _tpsCandidateCounter;
    mapping(uint256 => TPSEvent) public tpsEvents;
    mapping(uint256 => mapping(uint256 => Candidate)) public candidates;
    mapping(uint256 => mapping(uint8 => uint256[])) private tpsCandidateIds;
    mapping(uint256 => mapping(bytes32 => mapping(uint8 => bool))) public hasVoted;
    mapping(uint256 => mapping(bytes32 => bool)) public hasParticipated;

    uint256[] public allTpsIds;

    event TPSCreated(uint256 indexed tpsId, string uniqueTPS, bytes32 merkleRoot);
    event VoteBatchCast(uint256 indexed tpsId, bytes32 indexed voterLeaf, uint256[] candidateIds);
    event AdminTransferProposed(address indexed currentAdmin, address indexed proposedAdmin);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Caller bukan admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // Langkah 1: admin lama mengusulkan admin baru
    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Admin baru tidak boleh zero address");
        require(_newAdmin != admin, "Sudah menjadi admin");
        pendingAdmin = _newAdmin;
        emit AdminTransferProposed(admin, _newAdmin);
    }

    // Langkah 2: admin baru menerima kepemilikan secara aktif
    function acceptAdmin() external {
        require(msg.sender == pendingAdmin, "Bukan pending admin");
        emit AdminTransferred(admin, pendingAdmin);
        admin = pendingAdmin;
        pendingAdmin = address(0);
    }

    // [HIGH-02 FIX] Parameter _registeredVoters ditambahkan untuk menyimpan jumlah DPT.
    // DPT (Daftar Pemilih Tetap) adalah jumlah pemilih terdaftar di TPS ini,
    // diisi saat TPS dibuat dan tidak bisa berubah — digunakan untuk menghitung partisipasi.
    function createTPSWithCandidates(
        bytes32 _merkleRoot,
        string calldata _provinsi,
        string calldata _kotaDesa,
        string calldata _alamatLengkap,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _registeredVoters,
        CandidateInput[] calldata _candidateList
    ) external onlyAdmin returns (uint256 tpsId) {
        require(_merkleRoot != bytes32(0), "Merkle root kosong");
        require(_startTime < _endTime, "Waktu tidak valid");
        require(_endTime - _startTime >= MIN_TPS_DURATION, "Durasi TPS minimal 1 jam");
        require(_candidateList.length > 0, "Harus ada minimal 1 kandidat");
        require(_registeredVoters > 0, "Jumlah pemilih terdaftar (DPT) harus lebih dari 0");

        _tpsCounter++;
        tpsId = _tpsCounter;

        TPSEvent storage t = tpsEvents[tpsId];
        t.uniqueTPS        = string(abi.encodePacked("TPS-", _toString(tpsId)));
        t.merkleRoot       = _merkleRoot;
        t.provinsi         = _provinsi;
        t.kotaDesa         = _kotaDesa;
        t.alamatLengkap    = _alamatLengkap;
        t.startTime        = _startTime;
        t.endTime          = _endTime;
        t.registeredVoters = _registeredVoters;
        // totalVoters dimulai dari 0 dan naik setiap castVote

        allTpsIds.push(tpsId);

        for (uint256 i = 0; i < _candidateList.length; i++) {
            _addCandidateInternal(tpsId, _candidateList[i]);
        }

        emit TPSCreated(tpsId, t.uniqueTPS, _merkleRoot);
    }

    function _addCandidateInternal(uint256 _tpsId, CandidateInput calldata _input) internal {
        _tpsCandidateCounter[_tpsId]++;
        uint256 cId = _tpsCandidateCounter[_tpsId];

        candidates[_tpsId][cId] = Candidate({
            id: cId,
            firstName: _input.firstName,
            lastName: _input.lastName,
            description: _input.description,
            photoIPFS: _input.photoIPFS,
            candidateType: _input.cType,
            voteCount: 0,
            exists: true
        });

        tpsCandidateIds[_tpsId][uint8(_input.cType)].push(cId);
    }

    function castVoteBatch(
        uint256 _tpsId,
        bytes32[] calldata _proof,
        bytes32 _voterLeaf,
        uint256[] calldata _candidateIds
    ) external {
        TPSEvent storage t = tpsEvents[_tpsId];

        require(block.timestamp >= t.startTime, "Voting belum dimulai");
        require(block.timestamp <= t.endTime, "Voting sudah selesai");
        require(_proof.verify(t.merkleRoot, _voterLeaf), "Bukti Merkle tidak valid");
        require(_candidateIds.length > 0, "Tidak ada kandidat dipilih");

        for (uint256 i = 0; i < _candidateIds.length; i++) {
            uint256 cId = _candidateIds[i];
            require(candidates[_tpsId][cId].exists, "Kandidat tidak ditemukan");
            uint8 cType = uint8(candidates[_tpsId][cId].candidateType);
            require(!hasVoted[_tpsId][_voterLeaf][cType], "Sudah memilih untuk kategori ini");
        }

        for (uint256 i = 0; i < _candidateIds.length; i++) {
            uint256 cId = _candidateIds[i];
            uint8 cType = uint8(candidates[_tpsId][cId].candidateType);
            hasVoted[_tpsId][_voterLeaf][cType] = true;
            candidates[_tpsId][cId].voteCount++;
        }

        if (!hasParticipated[_tpsId][_voterLeaf]) {
            hasParticipated[_tpsId][_voterLeaf] = true;
            t.totalVoters++; // [HIGH-02] Hanya naik saat mencoblos — beda dari registeredVoters (DPT)
        }

        emit VoteBatchCast(_tpsId, _voterLeaf, _candidateIds);
    }

    function getCandidatesByType(uint256 _tpsId, CandidateType _cType) external view returns (Candidate[] memory) {
        uint256[] storage ids = tpsCandidateIds[_tpsId][uint8(_cType)];
        Candidate[] memory result = new Candidate[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = candidates[_tpsId][ids[i]];
        }
        return result;
    }

    function getAllTpsIds() external view returns (uint256[] memory) {
        return allTpsIds;
    }

    // [INFO-02 FIX] Fungsi paginated untuk skala besar (>1000 TPS).
    // offset: indeks awal (0-based), limit: jumlah item per halaman
    // Gunakan ini sebagai pengganti getAllTpsIds() saat jumlah TPS sangat banyak.
    function getTpsIdsPaged(uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        uint256 total = allTpsIds.length;
        if (offset >= total) return new uint256[](0);
        uint256 end = offset + limit > total ? total : offset + limit;
        uint256[] memory result = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = allTpsIds[i];
        }
        return result;
    }

    function getTpsCount() external view returns (uint256) {
        return _tpsCounter;
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
