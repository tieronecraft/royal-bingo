/**
 * ============================================================================
 * ሮያል ቢንጎ ፕሮ (Royal Bingo Pro 500) — Shared Core Engine
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
  // ITEM 1: CONCRETE DEVELOPER INPUTS & CONSTANTS
  // --------------------------------------------------------------------------
  const CONFIG = {
    UNIFIED_APP_TITLE: "ሮያል ቢንጎ ፕሮ (Royal Bingo Pro 500)",
    DESKTOP_EXE_NAME: "RoyalBingoPro_Setup.exe",
    ANDROID_PACKAGE_NAME: "com.royalcraft.habeshabingo500",
    CARTELA_SEED_KEY: "ROYAL_HABESHA_BINGO_500_SEED_2026_V1",
    ADMIN_MASTER_SECRET: "RBP_MASTER_KEY_998877665544332211_ETHIOPIA",
    ADMIN_SECRET_PIN: "202627", // Default Master PIN after 27 logo taps (configurable)
    DEFAULT_COMMISSION_PERCENT: 25, // 25% Operator commission, 75% Net Player Prize
    DEFAULT_PACKAGE_TOKENS: 1000000,
    DEFAULT_PACKAGE_ETB: 10000,
    ADMIN_CONTACT: {
      phone: "+251 925432016",
      telegram: "@OneGBEthiopia",
      banks: "CBE: 1000212746367 | Telebirr: 0925432016"
    },
    REMOTE_WALLET_LEDGER_URL:
      "https://raw.githubusercontent.com/tieronecraft/royal-bingo-wallets/main/wallets.json"
  };

  // --------------------------------------------------------------------------
  // ITEM 2: SHARED 500-CARTELA DETERMINISTIC ENGINE (100% IDENTICAL IN .EXE & .APK)
  // Uses FNV-1a + Mulberry32 PRNG keyed with ROYAL_HABESHA_BINGO_500_SEED_2026_V1
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
    for (let n = min; n <= max; n++) {
      pool.push(n);
    }
    // Fisher-Yates shuffle using deterministic RNG
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return pool.slice(0, count);
  }

  /**
   * Generates a unique 5x5 Bingo Cartela for IDs 1..500.
   * Returns { id, columns: { B, I, N, G, O }, grid: 5x5 row-major matrix, signature }
   * Center cell grid[2][2] is 0 (representing FREE / ነፃ).
   */
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
    const colN = [colN_raw[0], colN_raw[1], 0, colN_raw[2], colN_raw[3]]; // 0 = FREE / ነፃ
    const colG = pickUniqueDeterministic(46, 60, 5, rng);
    const colO = pickUniqueDeterministic(61, 75, 5, rng);

    // Build 5x5 row-major grid: grid[row][col]
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

  // Pre-compute cache of all 500 cartelas on initialization for instant lookup
  const CARTELA_CACHE = {};
  function getAll500Cartelas() {
    if (Object.keys(CARTELA_CACHE).length === 500) return CARTELA_CACHE;
    for (let i = 1; i <= 500; i++) {
      CARTELA_CACHE[i] = generateCartelaById(i);
    }
    return CARTELA_CACHE;
  }

  // --------------------------------------------------------------------------
  // ITEM 3: COMPLETE AMHARIC NUMBER CALLS (B:1 TO O:75) & GAME STATUS PHRASES
  // --------------------------------------------------------------------------
  const AMHARIC_UNITS = {
    1: "አንድ",
    2: "ሁለት",
    3: "ሶስት",
    4: "አራት",
    5: "አምስት",
    6: "ስድስት",
    7: "ሰባት",
    8: "ስምንት",
    9: "ዘጠኝ",
    10: "አስር"
  };

  const AMHARIC_TENS = {
    10: "አስር",
    20: "ሃያ",
    30: "ሰላሳ",
    40: "አርባ",
    50: "ሃምሳ",
    60: "ስልሳ",
    70: "ሰባ"
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
    const letter = getLetterForNumber(n);
    const words = numberToAmharicWords(n);
    AMHARIC_BALL_CALLS[n] = {
      number: n,
      letter: letter.en,
      code: `${letter.en}-${n}`,
      amharicText: `${letter.am} ${words}`,
      audioFile: `voices/ball_${n}.mp3`
    };
  }

  const AMHARIC_STATUS_CALLS = {
    GAME_START: {
      key: "game_start",
      amharicText: "ጨዋታው ተጀምሯል፣ መልካም ዕድል!",
      audioFile: "voices/status_game_start.mp3"
    },
    GAME_PAUSED: {
      key: "game_paused",
      amharicText: "ጨዋታው ለጊዜው ቆሟል",
      audioFile: "voices/status_game_paused.mp3"
    },
    CARTELA_WON: {
      key: "cartela_won",
      amharicText: "ይህ ካርቴላ አሸንፏል! እንኳን ደስ አለዎት!",
      audioFile: "voices/status_cartela_won.mp3"
    },
    CARTELA_LOCKED: {
      key: "cartela_locked",
      amharicText: "ይህ ካርቴላ አልዘጋም! ካርቴላው ታስሯል!",
      audioFile: "voices/status_cartela_locked.mp3"
    }
  };

  // --------------------------------------------------------------------------
  // ITEM 5: COMPLETE 18 WINNING PATTERNS SELECTOR & EVALUATOR ENGINE
  // --------------------------------------------------------------------------
  const WINNING_PATTERNS = [
    {
      id: "PATTERN_1_HORIZ",
      order: 1,
      titleAm: "1 አግዳሚ",
      titleEn: "1 Horizontal Line",
      description: "ማንኛውም 1 አግዳሚ መስመር (5 ቁጥሮች)",
      previewCells: [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]]
    },
    {
      id: "PATTERN_1_VERT",
      order: 2,
      titleAm: "1 ቋሚ",
      titleEn: "1 Vertical Line",
      description: "ማንኛውም 1 ቋሚ መስመር (5 ቁጥሮች)",
      previewCells: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]]
    },
    {
      id: "PATTERN_1_DIAG",
      order: 3,
      titleAm: "1 ዲያጎናል (/ ወይም \\)",
      titleEn: "1 Diagonal Line",
      description: "ማንኛውም 1 ዲያጎናል መስመር",
      previewCells: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]]
    },
    {
      id: "PATTERN_ANY_1_LINE",
      order: 4,
      titleAm: "ወደተፈለገበት 1 ዝግ",
      titleEn: "Any 1 Line (Horiz, Vert, or Diag)",
      description: "አግዳሚ፣ ቋሚ ወይም ዲያጎናል 1 መስመር",
      previewCells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]
    },
    {
      id: "PATTERN_1H_1V",
      order: 5,
      titleAm: "1 አግዳሚ እና 1 ቋሚ",
      titleEn: "1 Horizontal + 1 Vertical Line",
      description: "ቢያንስ 1 አግዳሚ እና 1 ቋሚ መስመር በአንድ ላይ",
      previewCells: [
        [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
        [1, 0], [2, 0], [3, 0], [4, 0], [2, 2]
      ]
    },
    {
      id: "PATTERN_ANY_2_LINES",
      order: 6,
      titleAm: "ወደተፈለገበት 2 ዝግ",
      titleEn: "Any 2 Lines",
      description: "ማንኛውም 2 መስመሮች (አግዳሚ፣ ቋሚ ወይም ዲያጎናል)",
      previewCells: [
        [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
        [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [2, 2]
      ]
    },
    {
      id: "PATTERN_ANY_3_LINES",
      order: 7,
      titleAm: "ወደተፈለገበት 3 ዝግ",
      titleEn: "Any 3 Lines",
      description: "ማንኛውም 3 መስመሮች (አግዳሚ፣ ቋሚ ወይም ዲያጎናል)",
      previewCells: [
        [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
        [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]
      ]
    },
    {
      id: "PATTERN_ANY_4_LINES",
      order: 8,
      titleAm: "ወደተፈለገበት 4 ዝግ",
      titleEn: "Any 4 Lines",
      description: "ማንኛውም 4 መስመሮች",
      previewCells: [
        [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
        [1, 0], [1, 1], [1, 2], [1, 3], [1, 4],
        [3, 0], [3, 1], [3, 2], [3, 3], [3, 4],
        [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [2, 2]
      ]
    },
    {
      id: "PATTERN_FEDERATION_OUTER_4",
      order: 9,
      titleAm: "ፌዴሬሽን / 4 ማዕዘን",
      titleEn: "Federation — 4 Outer Corners",
      description: "4ቱ የውጭ ማዕዘን ቁጥሮች",
      previewCells: [[0, 0], [0, 4], [4, 0], [4, 4], [2, 2]]
    },
    {
      id: "PATTERN_INNER_4_CORNERS",
      order: 10,
      titleAm: "ውስጥ 4 ማዕዘን",
      titleEn: "Inner 4 Corners around Free Space",
      description: "በነፃው ሳጥን ዙሪያ ያሉት 4ቱ የውስጥ ማዕዘኖች",
      previewCells: [[1, 1], [1, 3], [3, 1], [3, 3], [2, 2]]
    },
    {
      id: "PATTERN_FEDERATION_PLUS_1_LINE",
      order: 11,
      titleAm: "ፌዴሬሽን + 1 መስመር",
      titleEn: "4 Corners + Any 1 Line",
      description: "4ቱ የውጭ ማዕዘኖች እና ማንኛውም 1 ሙሉ መስመር",
      previewCells: [
        [0, 0], [0, 4], [4, 0], [4, 4],
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]
      ]
    },
    {
      id: "PATTERN_X_SHAPE",
      order: 12,
      titleAm: "X-ቅርጽ (ሁለቱም ዲያጎናሎች)",
      titleEn: "X-Pattern (Both Diagonals)",
      description: "ሁለቱም ዲያጎናል መስመሮች በሙሉ (X ቅርጽ)",
      previewCells: [
        [0, 0], [1, 1], [2, 2], [3, 3], [4, 4],
        [0, 4], [1, 3], [3, 1], [4, 0]
      ]
    },
    {
      id: "PATTERN_T_L_PLUS",
      order: 13,
      titleAm: "T-ቅርጽ / L-ቅርጽ / Plus (+) ቅርጽ",
      titleEn: "T-Shape / L-Shape / Plus (+) Shape",
      description: "የT፣ የL ወይም የመደመር (+) ቅርጽ የሚሰሩ 2 መስመሮች",
      previewCells: [
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
        [0, 2], [1, 2], [3, 2], [4, 2]
      ]
    },
    {
      id: "PATTERN_FULL_HOUSE",
      order: 14,
      titleAm: "ሙሉ ካርቴላ (Full House / Blackout)",
      titleEn: "Full House / Blackout (All 24 Numbers)",
      description: "በካርቴላው ላይ ያሉት 24ቱም ቁጥሮች በሙሉ ሲወጡ",
      previewCells: (function () {
        const all = [];
        for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) all.push([r, c]);
        return all;
      })()
    },
    {
      id: "PATTERN_1H_1V_1D",
      order: 15,
      titleAm: "1 አግዳሚ፣ 1 ቋሚና 1 ዲያጎናል",
      titleEn: "1 Horizontal + 1 Vertical + 1 Diagonal",
      description: "ቢያንስ 1 አግዳሚ፣ 1 ቋሚ እና 1 ዲያጎናል መስመር",
      previewCells: [
        [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
        [1, 0], [2, 0], [3, 0], [4, 0],
        [1, 1], [2, 2], [3, 3], [4, 4]
      ]
    },
    {
      id: "PATTERN_ANY_5_LINES",
      order: 16,
      titleAm: "ወደተፈለገበት 5 ዝግ",
      titleEn: "Any 5 Lines",
      description: "ማንኛውም 5 መስመሮች (አግዳሚ፣ ቋሚ ወይም ዲያጎናል)",
      previewCells: [
        [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
        [1, 0], [1, 1], [1, 2], [1, 3], [1, 4],
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
        [3, 0], [3, 1], [3, 2], [3, 3], [3, 4],
        [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]
      ]
    },
    {
      id: "PATTERN_ANY_6_LINES",
      order: 17,
      titleAm: "ወደተፈለገበት 6 ዝግ",
      titleEn: "Any 6 Lines",
      description: "ማንኛውም 6 መስመሮች (አግዳሚ፣ ቋሚ ወይም ዲያጎናል)",
      previewCells: [
        [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
        [1, 0], [1, 1], [1, 2], [1, 3], [1, 4],
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
        [3, 0], [3, 1], [3, 2], [3, 3], [3, 4],
        [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]
      ]
    },
    {
      id: "PATTERN_ANY_1_LINE_CLASSIC",
      order: 18,
      titleAm: "ወደተፈለገበት 1 ዝግ (Classic Any 1 Line)",
      titleEn: "Any 1 Line (Classic Mode)",
      description: "ማንኛውም 1 መስመር (አግዳሚ፣ ቋሚ ወይም ዲያጎናል)",
      previewCells: [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]]
    }
  ];

  /**
   * Evaluates whether a cartela satisfies the selected winning pattern given a Set/Array of called numbers.
   * Returns { isWinner: boolean, winningCells: Array<[r, c]>, matchedLinesCount: number, summaryAm: string }
   */
  function verifyCartelaWin(cartelaIdOrObj, calledNumbersInput, patternId) {
    const cartela =
      typeof cartelaIdOrObj === "number"
        ? generateCartelaById(cartelaIdOrObj)
        : cartelaIdOrObj;
    const calledSet = new Set(
      Array.isArray(calledNumbersInput)
        ? calledNumbersInput.map(Number)
        : Array.from(calledNumbersInput).map(Number)
    );
    calledSet.add(0); // Center FREE space is always matched

    const grid = cartela.grid;
    const isHit = (r, c) => (r === 2 && c === 2 ? true : calledSet.has(grid[r][c]));

    // Check all 5 horizontal rows
    const horizLines = [];
    for (let r = 0; r < 5; r++) {
      const cells = [[r, 0], [r, 1], [r, 2], [r, 3], [r, 4]];
      if (cells.every(([rr, cc]) => isHit(rr, cc))) horizLines.push(cells);
    }

    // Check all 5 vertical columns
    const vertLines = [];
    for (let c = 0; c < 5; c++) {
      const cells = [[0, c], [1, c], [2, c], [3, c], [4, c]];
      if (cells.every(([rr, cc]) => isHit(rr, cc))) vertLines.push(cells);
    }

    // Check 2 main diagonals
    const diagLines = [];
    const diagMain = [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]];
    const diagAnti = [[0, 4], [1, 3], [2, 2], [3, 1], [4, 0]];
    if (diagMain.every(([r, c]) => isHit(r, c))) diagLines.push(diagMain);
    if (diagAnti.every(([r, c]) => isHit(r, c))) diagLines.push(diagAnti);

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

    const outerCorners = [[0, 0], [0, 4], [4, 0], [4, 4]];
    const hasOuterCorners = outerCorners.every(([r, c]) => isHit(r, c));

    const innerCorners = [[1, 1], [1, 3], [3, 1], [3, 3]];
    const hasInnerCorners = innerCorners.every(([r, c]) => isHit(r, c));

    let isWinner = false;
    let winningCells = [];

    switch (patternId) {
      case "PATTERN_1_HORIZ":
        isWinner = horizLines.length >= 1;
        winningCells = mergeCells(horizLines);
        break;
      case "PATTERN_1_VERT":
        isWinner = vertLines.length >= 1;
        winningCells = mergeCells(vertLines);
        break;
      case "PATTERN_1_DIAG":
        isWinner = diagLines.length >= 1;
        winningCells = mergeCells(diagLines);
        break;
      case "PATTERN_ANY_1_LINE":
      case "PATTERN_ANY_1_LINE_CLASSIC":
        isWinner = totalLines >= 1;
        winningCells = mergeCells(allMatchedLines);
        break;
      case "PATTERN_1H_1V":
        isWinner = horizLines.length >= 1 && vertLines.length >= 1;
        winningCells = mergeCells([...horizLines, ...vertLines]);
        break;
      case "PATTERN_ANY_2_LINES":
        isWinner = totalLines >= 2;
        winningCells = mergeCells(allMatchedLines);
        break;
      case "PATTERN_ANY_3_LINES":
        isWinner = totalLines >= 3;
        winningCells = mergeCells(allMatchedLines);
        break;
      case "PATTERN_ANY_4_LINES":
        isWinner = totalLines >= 4;
        winningCells = mergeCells(allMatchedLines);
        break;
      case "PATTERN_ANY_5_LINES":
        isWinner = totalLines >= 5;
        winningCells = mergeCells(allMatchedLines);
        break;
      case "PATTERN_ANY_6_LINES":
        isWinner = totalLines >= 6;
        winningCells = mergeCells(allMatchedLines);
        break;
      case "PATTERN_FEDERATION_OUTER_4":
        isWinner = hasOuterCorners;
        winningCells = hasOuterCorners ? [...outerCorners, [2, 2]] : [];
        break;
      case "PATTERN_INNER_4_CORNERS":
        isWinner = hasInnerCorners;
        winningCells = hasInnerCorners ? [...innerCorners, [2, 2]] : [];
        break;
      case "PATTERN_FEDERATION_PLUS_1_LINE":
        isWinner = hasOuterCorners && totalLines >= 1;
        winningCells = isWinner ? mergeCells([outerCorners, ...allMatchedLines]) : [];
        break;
      case "PATTERN_X_SHAPE":
        isWinner = diagLines.length === 2;
        winningCells = isWinner ? mergeCells(diagLines) : [];
        break;
      case "PATTERN_T_L_PLUS": {
        const r0 = [0, 1, 2, 3, 4].every((c) => isHit(0, c));
        const r2 = [0, 1, 2, 3, 4].every((c) => isHit(2, c));
        const r4 = [0, 1, 2, 3, 4].every((c) => isHit(4, c));
        const c0 = [0, 1, 2, 3, 4].every((r) => isHit(r, 0));
        const c2 = [0, 1, 2, 3, 4].every((r) => isHit(r, 2));
        const c4 = [0, 1, 2, 3, 4].every((r) => isHit(r, 4));

        const matchedShapes = [];
        if (r2 && c2) matchedShapes.push([[2,0],[2,1],[2,2],[2,3],[2,4],[0,2],[1,2],[3,2],[4,2]]);
        if (r0 && c2) matchedShapes.push([[0,0],[0,1],[0,2],[0,3],[0,4],[1,2],[2,2],[3,2],[4,2]]);
        if (r4 && c2) matchedShapes.push([[4,0],[4,1],[4,2],[4,3],[4,4],[0,2],[1,2],[2,2],[3,2]]);
        if (r2 && c0) matchedShapes.push([[0,0],[1,0],[2,0],[3,0],[4,0],[2,1],[2,2],[2,3],[2,4]]);
        if (r2 && c4) matchedShapes.push([[0,4],[1,4],[2,4],[3,4],[4,4],[2,0],[2,1],[2,2],[2,3]]);
        if (r4 && c0) matchedShapes.push([[0,0],[1,0],[2,0],[3,0],[4,0],[4,1],[4,2],[4,3],[4,4]]);
        if (r4 && c4) matchedShapes.push([[0,4],[1,4],[2,4],[3,4],[4,4],[4,0],[4,1],[4,2],[4,3]]);
        if (r0 && c0) matchedShapes.push([[0,0],[1,0],[2,0],[3,0],[4,0],[0,1],[0,2],[0,3],[0,4]]);
        if (r0 && c4) matchedShapes.push([[0,4],[1,4],[2,4],[3,4],[4,4],[0,0],[0,1],[0,2],[0,3]]);

        isWinner = matchedShapes.length > 0;
        winningCells = mergeCells(matchedShapes);
        break;
      }
      case "PATTERN_FULL_HOUSE": {
        const allCells = [];
        let allHit = true;
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 5; c++) {
            if (!isHit(r, c)) allHit = false;
            allCells.push([r, c]);
          }
        }
        isWinner = allHit;
        winningCells = allHit ? allCells : [];
        break;
      }
      case "PATTERN_1H_1V_1D":
        isWinner = horizLines.length >= 1 && vertLines.length >= 1 && diagLines.length >= 1;
        winningCells = isWinner ? mergeCells([...horizLines, ...vertLines, ...diagLines]) : [];
        break;
      default:
        isWinner = totalLines >= 1;
        winningCells = mergeCells(allMatchedLines);
    }

    const allHitCells = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (isHit(r, c)) allHitCells.push([r, c]);
      }
    }

    return {
      cartelaId: cartela.id,
      patternId,
      isWinner,
      winningCells,
      allHitCells,
      matchedLinesCount: totalLines,
      summaryAm: isWinner
        ? "🎉 ይህ ካርቴላ አሸንፏል! እንኳን ደስ አለዎት!"
        : "❌ ይህ ካርቴላ አልዘጋም! ካርቴላው ታስሯል!"
    };
  }

  // --------------------------------------------------------------------------
  // ITEM 8: ZERO-ANYDESK CRYPTOGRAPHIC WALLET & 16-DIGIT SIGNED TOKEN ENGINE
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
      if (!Number.isNaN(thousands) && thousands > 0) {
        return thousands * 1000;
      }
    }
    throw new Error("Invalid token amount code segment: " + clean);
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
      throw new Error("Valid User ID and Sequence Number (>= 1) are required.");
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

  function verifyOffline16DigitKey(inputKey, machineUserId, expectedSequenceNumber, masterSecret) {
    const raw = String(inputKey).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (raw.length !== 16 || !raw.startsWith("RBP")) {
      return { valid: false, reasonAm: "ኮዱ ልክ አይደለም! ባለ 16 ፊደል RBP ኮድ ያስገቡ።" };
    }
    const group1 = raw.slice(0, 4);
    const group2 = raw.slice(4, 8);
    const group3 = raw.slice(8, 12);
    const group4 = raw.slice(12, 16);

    const normalizedUser = String(machineUserId).toUpperCase().trim();
    const expectedUidTail4 = normalizedUser.replace(/[^A-Z0-9]/g, "").slice(-4).padStart(4, "0");
    if (group2 !== expectedUidTail4) {
      return {
        valid: false,
        reasonAm: `ይህ ኮድ ለእርስዎ User ID (${normalizedUser}) የተሰጠ አይደለም!`
      };
    }

    let amountTokens = 0;
    try {
      amountTokens = decodeAmountFrom4Chars(group3);
    } catch (e) {
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
      messageAm: `🎉 እንኳን ደስ አለዎት! ${amountTokens.toLocaleString()} Wallet Tokens በተሳካ ሁኔታ ተሞልቷል!`
    };
  }

  function generateRemoteLedgerEntry(userId, sequenceNumber, amountTokens, note, masterSecret) {
    const keyObj = generateOffline16DigitKey(userId, sequenceNumber, amountTokens, masterSecret);
    return {
      userId: keyObj.userId,
      sequenceNumber: keyObj.sequenceNumber,
      amountTokens: keyObj.amountTokens,
      signedKey: keyObj.key,
      issuedAt: new Date().toISOString(),
      note: note || "Top-Up via Admin Mobile Generator"
    };
  }

  function generateMachineUserId(cityName, hallName, hardwareFingerprint) {
    const cleanCity = String(cityName || "ETH")
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
    verifyOffline16DigitKey,
    generateRemoteLedgerEntry,
    generateMachineUserId
  };
});
