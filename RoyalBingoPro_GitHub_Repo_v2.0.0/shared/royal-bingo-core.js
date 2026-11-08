/**
 * ============================================================================
 * ሮያል ቢንጎ ፕሮ (Royal Bingo Pro 500) — v2.0 Enterprise Core Engine
 * Used identically by Windows Desktop (.EXE) and Android Mobile (.APK)
 * Copyright (c) 2026 RoyalCraft Software PLC. 100% Zero-Copyright Proprietary Code.
 * ============================================================================
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.RoyalBingoCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // --------------------------------------------------------------------------
  // 1. CONCRETE DEVELOPER INPUTS & SYSTEM CONFIGURATION
  // --------------------------------------------------------------------------
  const CONFIG = {
    UNIFIED_APP_TITLE: "ሮያል ቢንጎ ፕሮ (Royal Bingo Pro 500)",
    DESKTOP_EXE_NAME: "RoyalBingoPro_Setup.exe",
    ANDROID_PACKAGE_NAME: "com.royalcraft.habeshabingo500",
    CARTELA_SEED_KEY: "ROYAL_HABESHA_BINGO_500_SEED_2026_V1",
    ADMIN_MASTER_SECRET: "RBP_MASTER_KEY_998877665544332211_ETHIOPIA",
    ADMIN_SECRET_PIN: "202627", // Master PIN after 27 logo taps
    DEFAULT_COMMISSION_PERCENT: 25, // 25% Operator profit, 75% Player Net Prize
    DEFAULT_PACKAGE_TOKENS: 1000000,
    ADMIN_CONTACT: {
      phone: "+251 925432016",
      telegram: "@OneGBEthiopia",
      banks: "CBE: 1000212746367 | Telebirr: 0925432016"
    },
    REMOTE_WALLET_LEDGER_URL:
      "https://raw.githubusercontent.com/tieronecraft/royal-bingo-wallets/main/wallets.json"
  };

  // --------------------------------------------------------------------------
  // 2. SHARED 500-CARTELA DETERMINISTIC ENGINE (100% IDENTICAL IN .EXE & .APK)
  // Uses FNV-1a + Mulberry32 PRNG keyed with ROYAL_HABESHA_BINGO_500_SEED_2026_V1
  // Center cell grid[2][2] is 0 (representing Free).
  // --------------------------------------------------------------------------
  function fnv1aHash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function createMulberry32(seedInt) {
    let a = seedInt >>> 0;
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickUniqueDeterministic(min, max, count, rng) {
    const pool = [];
    for (let n = min; n <= max; n++) pool.push(n);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return pool.slice(0, count);
  }

  function generateCartelaById(id) {
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId < 1 || numId > 500) {
      throw new RangeError("Cartela ID must be an integer between 1 and 500.");
    }
    const seedString = `${CONFIG.CARTELA_SEED_KEY}::CARTELA_ID_${numId}`;
    const seedHash1 = fnv1aHash(seedString);
    const seedHash2 = fnv1aHash(seedString + "::SALT_HABESHA_V1");
    const combinedSeed = (seedHash1 ^ ((seedHash2 << 13) | (seedHash2 >>> 19))) >>> 0;
    const rng = createMulberry32(combinedSeed);

    const colB = pickUniqueDeterministic(1, 15, 5, rng);
    const colI = pickUniqueDeterministic(16, 30, 5, rng);
    const colN_raw = pickUniqueDeterministic(31, 45, 4, rng);
    const colN = [colN_raw[0], colN_raw[1], 0, colN_raw[2], colN_raw[3]]; // 0 = Free
    const colG = pickUniqueDeterministic(46, 60, 5, rng);
    const colO = pickUniqueDeterministic(61, 75, 5, rng);

    const grid = [];
    for (let r = 0; r < 5; r++) {
      grid.push([colB[r], colI[r], colN[r], colG[r], colO[r]]);
    }

    return {
      id: numId,
      columns: { B: colB, I: colI, N: colN, G: colG, O: colO },
      grid: grid,
      signature: seedHash1.toString(16).toUpperCase().padStart(8, "0")
    };
  }

  const CARTELA_CACHE = {};
  function getAll500Cartelas() {
    if (Object.keys(CARTELA_CACHE).length === 500) return CARTELA_CACHE;
    for (let i = 1; i <= 500; i++) {
      CARTELA_CACHE[i] = generateCartelaById(i);
    }
    return CARTELA_CACHE;
  }

  // --------------------------------------------------------------------------
  // 3. AMHARIC PHONETICS & NUMBER LOOKUP (B:1 TO O:75)
  // --------------------------------------------------------------------------
  const AMHARIC_UNITS = {
    1: "አንድ", 2: "ሁለት", 3: "ሶስት", 4: "አራት", 5: "አምስት",
    6: "ስድስት", 7: "ሰባት", 8: "ስምንት", 9: "ዘጠኝ", 10: "አስር"
  };
  const AMHARIC_TENS = {
    10: "አስር", 20: "ሃያ", 30: "ሰላሳ", 40: "አርባ",
    50: "ሃምሳ", 60: "ስልሳ", 70: "ሰባ"
  };

  function numberToAmharicWords(n) {
    if (n <= 10) return AMHARIC_UNITS[n];
    if (n < 20) return "አስራ " + AMHARIC_UNITS[n - 10];
    const ten = Math.floor(n / 10) * 10;
    const unit = n % 10;
    if (unit === 0) return AMHARIC_TENS[ten];
    return AMHARIC_TENS[ten] + " " + AMHARIC_UNITS[unit];
  }

  function getLetterForNumber(n) {
    if (n >= 1 && n <= 15) return { en: "B", am: "ቢ" };
    if (n >= 16 && n <= 30) return { en: "I", am: "አይ" };
    if (n >= 31 && n <= 45) return { en: "N", am: "ኤን" };
    if (n >= 46 && n <= 60) return { en: "G", am: "ጂ" };
    if (n >= 61 && n <= 75) return { en: "O", am: "ኦ" };
    throw new RangeError("Bingo number must be 1..75");
  }

  const AMHARIC_BALL_CALLS = {};
  for (let n = 1; n <= 75; n++) {
    const l = getLetterForNumber(n);
    const w = numberToAmharicWords(n);
    AMHARIC_BALL_CALLS[n] = {
      number: n,
      letter: l.en,
      code: `${l.en}-${n}`,
      amharicText: `${l.am}፣ ${w}`,
      audioFile: `ball_${n}.mp3`
    };
  }

  const AMHARIC_STATUS_CALLS = {
    GAME_START: { key: "status_game_start", text: "ጨዋታው ተጀምሯል፣ መልካም ዕድል!" },
    GAME_PAUSED: { key: "status_game_paused", text: "ጨዋታው ለጊዜው ቆሟል" },
    GAME_RESUMED: { key: "status_game_resumed", text: "ጨዋታው ቀጥሏል" },
    CARTELA_WON: { key: "status_cartela_won", text: "ይህ ካርቴላ አሸንፏል! እንኳን ደስ አለዎት!" },
    CARTELA_LOCKED: { key: "status_cartela_locked", text: "ይህ ካርቴላ አልዘጋም! ካርቴላው ታስሯል!" },
    MISSED_LAST_BALL: { key: "status_missed_last_ball", text: "ዝጉ አልፎታል! የመጨረሻዋ የተጠራች ቁጥር በዚህ ዝግ ውስጥ የለችም! ካርቴላው ታስሯል!" },
    CARTELA_UNLOCKED: { key: "status_cartela_unlocked", text: "የካርቴላው እስር ተፈቷል" },
    INSPECT_ONLY: { key: "status_inspect_only", text: "የካርቴላ ቁጥር ማረጋገጫ" },
    TOPUP_SUCCESS: { key: "status_wallet_topup_success", text: "እንኳን ደስ አለዎት! የዋሌት ቶከን በተሳካ ሁኔታ ተሞልቷል!" },
    NEW_ROUND_READY: { key: "status_new_round_ready", text: "አዲስ የጨዋታ ዙር ለመጀመር ዝግጁ ነው" }
  };

  // --------------------------------------------------------------------------
  // 4. EXPANDED 18+ WINNING PATTERNS (PURE AMHARIC TITLES)
  // --------------------------------------------------------------------------
  const WINNING_PATTERNS = [
    {
      id: "PATTERN_ANY_1_LINE",
      order: 1,
      titleAm: "ወደተፈለገበት 1 ዝግ",
      description: "ማንኛውም 1 መስመር (አግዳሚ፣ ቋሚ ወይም ዲያጎናል) ወይም 4 ማዕዘኖች",
      previewCells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]
    },
    {
      id: "PATTERN_1_HORIZ",
      order: 2,
      titleAm: "1 አግዳሚ መስመር",
      description: "ማንኛውም 1 አግዳሚ መስመር (5 ቁጥሮች)",
      previewCells: [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]]
    },
    {
      id: "PATTERN_1_VERT",
      order: 3,
      titleAm: "1 ቋሚ መስመር",
      description: "ማንኛውም 1 ቋሚ መስመር (5 ቁጥሮች)",
      previewCells: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]]
    },
    {
      id: "PATTERN_1_DIAG",
      order: 4,
      titleAm: "1 ዲያጎናል መስመር",
      description: "ማንኛውም 1 ዲያጎናል መስመር (/ ወይም \\)",
      previewCells: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]]
    },
    {
      id: "PATTERN_ANY_2_LINES",
      order: 5,
      titleAm: "ወደተፈለገበት 2 ዝግ",
      description: "ማንኛውም 2 መስመሮች (አግዳሚ፣ ቋሚ፣ ዲያጎናል ወይም X-ቅርጽ)",
      previewCells: [
        [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
        [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [2, 2]
      ]
    },
    {
      id: "PATTERN_1H_1V",
      order: 6,
      titleAm: "1 አግዳሚ እና 1 ቋሚ መስመር",
      description: "ቢያንስ 1 አግዳሚ እና 1 ቋሚ መስመር በአንድ ላይ",
      previewCells: [
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
        [0, 2], [1, 2], [3, 2], [4, 2]
      ]
    },
    {
      id: "PATTERN_1D_1V",
      order: 7,
      titleAm: "1 ዲያጎናል እና 1 ቋሚ መስመር",
      description: "1 ዲያጎናል መስመር ከ1 ቋሚ መስመር ጋር",
      previewCells: [
        [0, 0], [1, 1], [2, 2], [3, 3], [4, 4],
        [0, 2], [1, 2], [3, 2], [4, 2]
      ]
    },
    {
      id: "PATTERN_1D_1H",
      order: 8,
      titleAm: "1 ዲያጎናል እና 1 አግዳሚ መስመር",
      description: "1 ዲያጎናል መስመር ከ1 አግዳሚ መስመር ጋር",
      previewCells: [
        [0, 0], [1, 1], [2, 2], [3, 3], [4, 4],
        [2, 0], [2, 1], [2, 3], [2, 4]
      ]
    },
    {
      id: "PATTERN_X_SHAPE",
      order: 9,
      titleAm: "ሁለቱም ዲያጎናሎች (X-ቅርጽ)",
      description: "ሁለቱም ዲያጎናል መስመሮች በሙሉ (X-ቅርጽ)",
      previewCells: [
        [0, 0], [1, 1], [2, 2], [3, 3], [4, 4],
        [0, 4], [1, 3], [3, 1], [4, 0]
      ]
    },
    {
      id: "PATTERN_FEDERATION_OUTER_4",
      order: 10,
      titleAm: "4 የውጭ ማዕዘን (ፌዴሬሽን)",
      description: "4ቱ የካርቴላው የውጭ ማዕዘን ቁጥሮች",
      previewCells: [[0, 0], [0, 4], [4, 0], [4, 4], [2, 2]]
    },
    {
      id: "PATTERN_INNER_4_CORNERS",
      order: 11,
      titleAm: "4 የውስጥ ማዕዘን",
      description: "በFree ዙሪያ ያሉት 4ቱ የውስጥ ማዕዘኖች",
      previewCells: [[1, 1], [1, 3], [3, 1], [3, 3], [2, 2]]
    },
    {
      id: "PATTERN_FEDERATION_PLUS_1_LINE",
      order: 12,
      titleAm: "ፌዴሬሽን + 1 መስመር",
      description: "4ቱ የውጭ ማዕዘኖች እና ማንኛውም 1 ሙሉ መስመር",
      previewCells: [
        [0, 0], [0, 4], [4, 0], [4, 4],
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]
      ]
    },
    {
      id: "PATTERN_ANY_3_LINES",
      order: 13,
      titleAm: "ወደተፈለገበት 3 ዝግ",
      description: "ማንኛውም 3 መስመሮች (አግዳሚ፣ ቋሚ ወይም ዲያጎናል)",
      previewCells: [
        [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
        [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]
      ]
    },
    {
      id: "PATTERN_ANY_4_LINES",
      order: 14,
      titleAm: "ወደተፈለገበት 4 ዝግ",
      description: "ማንኛውም 4 መስመሮች",
      previewCells: [
        [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
        [1, 0], [1, 1], [1, 2], [1, 3], [1, 4],
        [3, 0], [3, 1], [3, 2], [3, 3], [3, 4],
        [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [2, 2]
      ]
    },
    {
      id: "PATTERN_T_L_PLUS",
      order: 15,
      titleAm: "T-ቅርጽ / L-ቅርጽ / የመደመር (+) ቅርጽ",
      description: "የT፣ የL ወይም የመደመር (+) ቅርጽ የሚሰሩ 2 መስመሮች",
      previewCells: [
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
        [0, 2], [1, 2], [3, 2], [4, 2]
      ]
    },
    {
      id: "PATTERN_1H_1V_1D",
      order: 16,
      titleAm: "1 አግዳሚ፣ 1 ቋሚና 1 ዲያጎናል",
      description: "ቢያንስ 1 አግዳሚ፣ 1 ቋሚ እና 1 ዲያጎናል መስመር",
      previewCells: [
        [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
        [1, 0], [2, 0], [3, 0], [4, 0],
        [1, 1], [2, 2], [3, 3], [4, 4]
      ]
    },
    {
      id: "PATTERN_ANY_5_LINES",
      order: 17,
      titleAm: "ወደተፈለገበት 5 ዝግ",
      description: "ማንኛውም 5 መስመሮች",
      previewCells: [
        [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
        [1, 0], [1, 1], [1, 2], [1, 3], [1, 4],
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
        [3, 0], [3, 1], [3, 2], [3, 3], [3, 4],
        [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]
      ]
    },
    {
      id: "PATTERN_FULL_HOUSE",
      order: 18,
      titleAm: "ሙሉ ካርቴላ (24ቱም ቁጥሮች)",
      description: "በካርቴላው ላይ ያሉት 24ቱም ቁጥሮች በሙሉ ሲወጡ",
      previewCells: (function () {
        const all = [];
        for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) all.push([r, c]);
        return all;
      })()
    }
  ];

  /**
   * Evaluates Cartela Win with Strict Last-Called-Ball Verification!
   * @param {number|object} cartelaIdOrObj
   * @param {Array<number>} calledHistory - Chronological array of called numbers [n1, n2, ... latest]
   * @param {string} patternId
   * @param {boolean} strictLastBallRule - If true, the latest called number MUST be in the winning line!
   */
  function verifyCartelaWin(cartelaIdOrObj, calledHistory, patternId, strictLastBallRule = true) {
    const cartela = typeof cartelaIdOrObj === "number"
      ? generateCartelaById(cartelaIdOrObj)
      : cartelaIdOrObj;

    const historyArr = Array.isArray(calledHistory) ? calledHistory.map(Number) : [];
    const calledSet = new Set(historyArr);
    calledSet.add(0); // Center Free is always matched

    const latestBall = historyArr.length > 0 ? historyArr[historyArr.length - 1] : null;
    const grid = cartela.grid;
    const isHit = (r, c) => (r === 2 && c === 2 ? true : calledSet.has(grid[r][c]));

    // All 5 horizontal rows
    const horizLines = [];
    for (let r = 0; r < 5; r++) {
      const cells = [[r, 0], [r, 1], [r, 2], [r, 3], [r, 4]];
      if (cells.every(([rr, cc]) => isHit(rr, cc))) horizLines.push(cells);
    }

    // All 5 vertical columns
    const vertLines = [];
    for (let c = 0; c < 5; c++) {
      const cells = [[0, c], [1, c], [2, c], [3, c], [4, c]];
      if (cells.every(([rr, cc]) => isHit(rr, cc))) vertLines.push(cells);
    }

    // 2 diagonals
    const diagLines = [];
    const diagMain = [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]];
    const diagAnti = [[0, 4], [1, 3], [2, 2], [3, 1], [4, 0]];
    if (diagMain.every(([r, c]) => isHit(r, c))) diagLines.push(diagMain);
    if (diagAnti.every(([r, c]) => isHit(r, c))) diagLines.push(diagAnti);

    const outerCorners = [[0, 0], [0, 4], [4, 0], [4, 4]];
    const hasOuterCorners = outerCorners.every(([r, c]) => isHit(r, c));

    const innerCorners = [[1, 1], [1, 3], [3, 1], [3, 3]];
    const hasInnerCorners = innerCorners.every(([r, c]) => isHit(r, c));

    const allMatchedLines = [...horizLines, ...vertLines, ...diagLines];
    const totalLines = allMatchedLines.length;

    const mergeCells = (lineList) => {
      const seen = new Set();
      const out = [];
      for (const line of lineList) {
        for (const [r, c] of line) {
          const k = `${r},${c}`;
          if (!seen.has(k)) {
            seen.add(k);
            out.push([r, c]);
          }
        }
      }
      return out;
    };

    let rawWinner = false;
    let candidateWinningCells = [];

    switch (patternId) {
      case "PATTERN_ANY_1_LINE":
        // 1 Line OR 4 Outer Corners OR 4 Inner Corners
        rawWinner = totalLines >= 1 || hasOuterCorners || hasInnerCorners;
        if (totalLines >= 1) candidateWinningCells = mergeCells(allMatchedLines);
        else if (hasOuterCorners) candidateWinningCells = [...outerCorners, [2, 2]];
        else if (hasInnerCorners) candidateWinningCells = [...innerCorners, [2, 2]];
        break;

      case "PATTERN_1_HORIZ":
        rawWinner = horizLines.length >= 1;
        candidateWinningCells = mergeCells(horizLines);
        break;

      case "PATTERN_1_VERT":
        rawWinner = vertLines.length >= 1;
        candidateWinningCells = mergeCells(vertLines);
        break;

      case "PATTERN_1_DIAG":
        rawWinner = diagLines.length >= 1;
        candidateWinningCells = mergeCells(diagLines);
        break;

      case "PATTERN_ANY_2_LINES":
        // Any 2 lines (horiz, vert, diag) or 1 line + 4 corners
        rawWinner = totalLines >= 2 || (totalLines >= 1 && hasOuterCorners);
        candidateWinningCells = totalLines >= 2
          ? mergeCells(allMatchedLines)
          : mergeCells([...allMatchedLines, outerCorners]);
        break;

      case "PATTERN_1H_1V":
        rawWinner = horizLines.length >= 1 && vertLines.length >= 1;
        candidateWinningCells = mergeCells([...horizLines, ...vertLines]);
        break;

      case "PATTERN_1D_1V":
        rawWinner = diagLines.length >= 1 && vertLines.length >= 1;
        candidateWinningCells = mergeCells([...diagLines, ...vertLines]);
        break;

      case "PATTERN_1D_1H":
        rawWinner = diagLines.length >= 1 && horizLines.length >= 1;
        candidateWinningCells = mergeCells([...diagLines, ...horizLines]);
        break;

      case "PATTERN_X_SHAPE":
        rawWinner = diagLines.length === 2;
        candidateWinningCells = rawWinner ? mergeCells(diagLines) : [];
        break;

      case "PATTERN_FEDERATION_OUTER_4":
        rawWinner = hasOuterCorners;
        candidateWinningCells = hasOuterCorners ? [...outerCorners, [2, 2]] : [];
        break;

      case "PATTERN_INNER_4_CORNERS":
        rawWinner = hasInnerCorners;
        candidateWinningCells = hasInnerCorners ? [...innerCorners, [2, 2]] : [];
        break;

      case "PATTERN_FEDERATION_PLUS_1_LINE":
        rawWinner = hasOuterCorners && totalLines >= 1;
        candidateWinningCells = rawWinner ? mergeCells([outerCorners, ...allMatchedLines]) : [];
        break;

      case "PATTERN_ANY_3_LINES":
        rawWinner = totalLines >= 3;
        candidateWinningCells = mergeCells(allMatchedLines);
        break;

      case "PATTERN_ANY_4_LINES":
        rawWinner = totalLines >= 4;
        candidateWinningCells = mergeCells(allMatchedLines);
        break;

      case "PATTERN_ANY_5_LINES":
        rawWinner = totalLines >= 5;
        candidateWinningCells = mergeCells(allMatchedLines);
        break;

      case "PATTERN_FULL_HOUSE": {
        let allHit = true;
        const allCells = [];
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 5; c++) {
            if (!isHit(r, c)) allHit = false;
            allCells.push([r, c]);
          }
        }
        rawWinner = allHit;
        candidateWinningCells = allHit ? allCells : [];
        break;
      }

      default:
        rawWinner = totalLines >= 1;
        candidateWinningCells = mergeCells(allMatchedLines);
    }

    // STRICT LAST-CALLED-BALL VERIFICATION
    let isWinner = rawWinner;
    let missedLastBall = false;

    if (rawWinner && strictLastBallRule && latestBall !== null) {
      // Check if the latest called ball exists inside candidateWinningCells
      const ballInWinningLine = candidateWinningCells.some(([r, c]) => {
        return grid[r][c] === latestBall;
      });
      if (!ballInWinningLine) {
        isWinner = false;
        missedLastBall = true;
      }
    }

    // Collect all matched cells on the board (for inspect mode)
    const allHitCells = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (isHit(r, c)) allHitCells.push([r, c]);
      }
    }

    let summaryAm = "";
    if (isWinner) {
      summaryAm = "🎉 ይህ ካርቴላ አሸንፏል! እንኳን ደስ አለዎት!";
    } else if (missedLastBall) {
      const lcode = AMHARIC_BALL_CALLS[latestBall] ? AMHARIC_BALL_CALLS[latestBall].code : latestBall;
      summaryAm = `❌ ዝጉ አልፎታል! የመጨረሻዋ የተጠራች ቁጥር (${lcode}) በዚህ ዝግ ውስጥ የለችም! ካርቴላው ታስሯል!`;
    } else {
      summaryAm = "❌ ይህ ካርቴላ አልዘጋም! ካርቴላው ታስሯል!";
    }

    return {
      cartelaId: cartela.id,
      patternId,
      rawWinner,
      isWinner,
      missedLastBall,
      winningCells: isWinner ? candidateWinningCells : [],
      allHitCells,
      matchedLinesCount: totalLines,
      summaryAm
    };
  }

  // --------------------------------------------------------------------------
  // 5. CRYPTOGRAPHIC WALLET, MULTI-FORMAT INPUT PARSER & 4-DIGIT PIN RESET ENGINE
  // --------------------------------------------------------------------------
  const TOKEN_TIER_CODES = {
    "50K0": 50000,
    "100K": 100000,
    "250K": 250000,
    "500K": 500000,
    "1M00": 1000000,
    "2M00": 2000000,
    "5M00": 5000000,
    "10M0": 10000000
  };

  function encodeAmountTo4Chars(amountTokens) {
    const num = Number(amountTokens);
    for (const [code, val] of Object.entries(TOKEN_TIER_CODES)) {
      if (val === num) return code;
    }
    const thousands = Math.max(1, Math.round(num / 1000));
    const b36 = thousands.toString(36).toUpperCase().padStart(3, "0").slice(-3);
    return "C" + b36;
  }

  function decodeAmountFrom4Chars(code4) {
    const clean = String(code4).toUpperCase().trim();
    if (TOKEN_TIER_CODES[clean]) return TOKEN_TIER_CODES[clean];
    if (clean.startsWith("C")) {
      const thousands = parseInt(clean.slice(1), 36);
      if (!Number.isNaN(thousands) && thousands > 0) return thousands * 1000;
    }
    throw new Error("Invalid token tier code: " + clean);
  }

  function computeCryptographicSignature(userId, sequenceNumber, amountCode4, masterSecret) {
    const secret = masterSecret || CONFIG.ADMIN_MASTER_SECRET;
    const normalizedUser = String(userId).toUpperCase().trim();
    const seq = Number(sequenceNumber);
    const amt = String(amountCode4).toUpperCase().trim();

    const payload1 = `${secret}::UID=${normalizedUser}::SEQ=${seq}::AMT=${amt}::V1`;
    const payload2 = `HABESHA_HMAC::${amt}::${seq}::${normalizedUser}::${secret}`;

    let h1 = fnv1aHash(payload1);
    let h2 = fnv1aHash(payload2);

    for (let i = 0; i < 16; i++) {
      h1 = Math.imul(h1 ^ (h2 >>> 13), 0x5bd1e995) >>> 0;
      h2 = Math.imul(h2 ^ (h1 >>> 15), 0x27d4eb2d) >>> 0;
    }

    const alphabet = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let sig = "";
    let combinedA = h1;
    let combinedB = h2;
    for (let i = 0; i < 4; i++) {
      sig += alphabet[combinedA % alphabet.length];
      combinedA = Math.floor(combinedA / alphabet.length);
    }
    for (let i = 0; i < 4; i++) {
      sig += alphabet[combinedB % alphabet.length];
      combinedB = Math.floor(combinedB / alphabet.length);
    }
    return sig;
  }

  function generateOffline16DigitKey(userId, sequenceNumber, amountTokens, masterSecret) {
    const normalizedUser = String(userId).toUpperCase().trim();
    const seq = Number(sequenceNumber);
    if (!normalizedUser || !Number.isInteger(seq) || seq < 1) {
      throw new Error("ትክክለኛ User ID እና Sequence ቁጥር ያስፈልጋል!");
    }
    const uidTail4 = normalizedUser.replace(/[^A-Z0-9]/g, "").slice(-4).padStart(4, "0");
    const amtCode4 = encodeAmountTo4Chars(amountTokens);
    const fullSig8 = computeCryptographicSignature(normalizedUser, seq, amtCode4, masterSecret);

    const group1 = "RBP" + fullSig8[0];
    const group2 = uidTail4;
    const group3 = amtCode4;
    const group4 = fullSig8.slice(1, 5);

    return {
      key: `${group1}-${group2}-${group3}-${group4}`,
      userId: normalizedUser,
      sequenceNumber: seq,
      amountTokens: decodeAmountFrom4Chars(amtCode4),
      amountCode: amtCode4
    };
  }

  /**
   * Universal Top-Up Validator (Accepts 16-Digit SMS Key OR Raw JSON snippet in one box!)
   */
  function verifyUniversalTopUpInput(rawInput, machineUserId, expectedSequenceNumber, masterSecret) {
    let inputStr = String(rawInput || "").trim();
    if (!inputStr) {
      return { valid: false, reasonAm: "እባክዎ ባለ 16-ፊደል ኮድ ወይም የJSON ጽሑፍ ያስገቡ!" };
    }

    // Check if input is a JSON snippet (e.g. {"userId":"RB-SEK-2843","signedKey":"..."})
    if (inputStr.startsWith("{") && inputStr.endsWith("}")) {
      try {
        const parsed = JSON.parse(inputStr);
        if (parsed.signedKey) inputStr = parsed.signedKey;
        if (parsed.userId && String(parsed.userId).toUpperCase().trim() !== String(machineUserId).toUpperCase().trim()) {
          return {
            valid: false,
            reasonAm: `ይህ JSON ለUser ID (${parsed.userId}) የተሰጠ ነው፤ የእርስዎ ግን (${machineUserId}) ነው!`
          };
        }
      } catch (_e) {}
    }

    const clean = inputStr.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length !== 16 || !clean.startsWith("RBP")) {
      return { valid: false, reasonAm: "ኮዱ ልክ አይደለም! ባለ 16-ፊደል RBP ኮድ ወይም የተሟላ JSON ያስገቡ።" };
    }

    const group1 = clean.slice(0, 4);
    const group2 = clean.slice(4, 8);
    const group3 = clean.slice(8, 12);
    const group4 = clean.slice(12, 16);

    const normalizedUser = String(machineUserId).toUpperCase().trim();
    const expectedUidTail4 = normalizedUser.replace(/[^A-Z0-9]/g, "").slice(-4).padStart(4, "0");
    if (group2 !== expectedUidTail4) {
      return {
        valid: false,
        reasonAm: `ይህ ኮድ ለሌላ ኮምፒውተር የተሰጠ ነው (የሚጠበቀው መለያ: ${expectedUidTail4}፣ የቀረበው: ${group2})!`
      };
    }

    let amountTokens = 0;
    try {
      amountTokens = decodeAmountFrom4Chars(group3);
    } catch (_e) {
      return { valid: false, reasonAm: "የቶከን መጠን ኮዱ የተሳሳተ ነው!" };
    }

    const expectedSig8 = computeCryptographicSignature(
      normalizedUser,
      Number(expectedSequenceNumber),
      group3,
      masterSecret
    );

    const expectedGroup1 = "RBP" + expectedSig8[0];
    const expectedGroup4 = expectedSig8.slice(1, 5);

    if (group1 !== expectedGroup1 || group4 !== expectedGroup4) {
      return {
        valid: false,
        reasonAm: `ኮዱ የተሳሳተ ነው ወይም ከዚህ በፊት ጥቅም ላይ ውሏል! (የሚጠበቅ Sequence #${expectedSequenceNumber})`
      };
    }

    return {
      valid: true,
      amountTokens,
      newSequenceNumber: Number(expectedSequenceNumber) + 1,
      messageAm: `🎉 እንኳን ደስ አለዎት! ${amountTokens.toLocaleString()} ዋሌት ቶከን በተሳካ ሁኔታ ተሞልቷል!`
    };
  }

  // 4-Digit User PIN Security & Remote Reset Token Generator
  function hashUserPin(pin4, userId) {
    const salt = `${CONFIG.ADMIN_MASTER_SECRET}::PIN_HASH::${userId}`;
    return fnv1aHash(`${pin4}::${salt}`).toString(16).toUpperCase();
  }

  function generatePinResetToken(userId, masterSecret) {
    const secret = masterSecret || CONFIG.ADMIN_MASTER_SECRET;
    const seed = `${secret}::PIN_RESET::${String(userId).toUpperCase().trim()}::V1`;
    const h = fnv1aHash(seed).toString(16).toUpperCase().padStart(8, "0");
    return `RST-${h}`;
  }

  function verifyPinResetToken(inputToken, userId, masterSecret) {
    const expected = generatePinResetToken(userId, masterSecret);
    return String(inputToken).trim().toUpperCase() === expected;
  }

  function generateRemoteLedgerEntry(userId, sequenceNumber, amountTokens, note, masterSecret) {
    const keyObj = generateOffline16DigitKey(userId, sequenceNumber, amountTokens, masterSecret);
    return {
      userId: keyObj.userId,
      sequenceNumber: keyObj.sequenceNumber,
      amountTokens: keyObj.amountTokens,
      signedKey: keyObj.key,
      issuedAt: new Date().toISOString(),
      note: note || "Top-Up via Owner Mobile APK Admin Mode"
    };
  }

  function generateMachineUserId(cityName, hallName, hardwareFingerprint) {
    const cleanCity = String(cityName || "SEKOTA")
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
    const prefix3 = (cleanCity + "ETH").slice(0, 3);
    const seed = `${cleanCity}::${hallName || "BINGO"}::${hardwareFingerprint || "DEFAULT_HW"}`;
    const hashNum = (fnv1aHash(seed) % 9000) + 1000;
    return `RB-${prefix3}-${hashNum}`;
  }

  return {
    CONFIG,
    generateCartelaById,
    getAll500Cartelas,
    AMHARIC_BALL_CALLS,
    AMHARIC_STATUS_CALLS,
    WINNING_PATTERNS,
    verifyCartelaWin,
    generateOffline16DigitKey,
    verifyUniversalTopUpInput,
    hashUserPin,
    generatePinResetToken,
    verifyPinResetToken,
    generateRemoteLedgerEntry,
    generateMachineUserId
  };
});
