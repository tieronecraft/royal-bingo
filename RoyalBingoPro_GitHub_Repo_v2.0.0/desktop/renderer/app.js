/**
 * ============================================================================
 * ሮያል ቢንጎ ፕሮ (Royal Bingo Pro 500) — v2.0 Enterprise Desktop Controller
 * Implements:
 *   - 100% Pure Amharic Buttons & Custom Modals (Zero Native alert())
 *   - 4-Digit User PIN Authentication & PIN Reset
 *   - Universal Top-Up Validator (16-Digit SMS Code OR Raw JSON in one box)
 *   - Zero-Beep / Zero-Chime Pure Human Amharic Speech
 *   - SVG Volume & Mute Controls
 *   - Strict Last-Called-Ball Verification
 *   - Daily Revenue Log & Power-Loss Recovery
 *   - Pro Keyboard Shortcuts: Space=Pause, R=Replay, V=Focus Verify, M=Mute, F11=Full
 * ============================================================================
 */
(function () {
  "use strict";

  const Core = window.RoyalBingoCore;

  // Application State
  const state = {
    hallName: "Sekota Bingo Center",
    cityName: "Sekota",
    hardwareId: "HW-DEFAULT-2026",
    userId: "RB-SEK-2843",
    sequenceNumber: 1,
    walletTokens: 0, // Starts at 0 until topped up
    userPinHash: null, // Hashed 4-digit PIN
    isWalletUnlocked: false,
    commissionPercent: Core.CONFIG.DEFAULT_COMMISSION_PERCENT,
    stakePerCartela: 30,
    selectedPatternId: "PATTERN_ANY_1_LINE",
    strictLastBallRule: true,
    theme: "night",
    selectedCartelas: new Set(),
    lockedCartelas: new Set(),
    currentRangeFilter: "ALL",
    voiceGender: "female",
    callIntervalSeconds: 3.5,
    remoteLedgerUrl: Core.CONFIG.REMOTE_WALLET_LEDGER_URL,

    // Live Arena State
    isGameActive: false,
    isPaused: false,
    remainingDeck: [],
    calledHistory: [],
    callTimerId: null,
    lastInspectedCartelaId: null,

    // Audit logs of completed rounds
    roundLogs: []
  };

  // --------------------------------------------------------------------------
  // AUDIO CONTROLLER (ZERO BEEP / ZERO CHIME / PURE HUMAN AMHARIC SPEECH)
  // --------------------------------------------------------------------------
  const audioCache = new Map();
  let currentAudio = null;
  let isMuted = false;
  let masterVolume = 1.0;
  let currentPlaybackRate = 1.0;

  function preloadAudioAssets() {
    const genders = ["female", "male"];
    for (let n = 1; n <= 75; n++) {
      genders.forEach((g) => {
        const a = new Audio(`voices/${g}/ball_${n}.mp3`);
        a.preload = "auto";
        audioCache.set(`${g}_ball_${n}`, a);
      });
    }
    Object.keys(Core.AMHARIC_STATUS_CALLS).forEach((k) => {
      const call = Core.AMHARIC_STATUS_CALLS[k];
      genders.forEach((g) => {
        const a = new Audio(`voices/${g}/${call.key}.mp3`);
        a.preload = "auto";
        audioCache.set(`${g}_${call.key}`, a);
      });
    });
  }

  function stopCurrentAudio() {
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch (_e) {}
      currentAudio = null;
    }
  }

  function setCallIntervalSpeed(seconds) {
    const sec = Math.max(2.0, Math.min(7.0, Number(seconds)));
    if (sec <= 2.5) currentPlaybackRate = 1.25;
    else if (sec <= 3.5) currentPlaybackRate = 1.15;
    else currentPlaybackRate = 1.0;
  }

  function playBallCall(ballNumber, onEndCallback) {
    stopCurrentAudio();
    if (isMuted) {
      if (typeof onEndCallback === "function") onEndCallback();
      return;
    }

    const cacheKey = `${state.voiceGender}_ball_${ballNumber}`;
    let audio = audioCache.get(cacheKey);
    if (!audio) audio = new Audio(`voices/${state.voiceGender}/ball_${ballNumber}.mp3`);

    audio.volume = masterVolume;
    audio.playbackRate = currentPlaybackRate;
    audio.currentTime = 0;
    currentAudio = audio;

    audio.onended = () => {
      currentAudio = null;
      if (typeof onEndCallback === "function") onEndCallback();
    };

    audio.play().catch(() => {
      // Offline fallback
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const callObj = Core.AMHARIC_BALL_CALLS[ballNumber];
        const u = new SpeechSynthesisUtterance(callObj ? callObj.amharicText : "");
        u.lang = "am-ET";
        u.rate = currentPlaybackRate;
        u.onend = onEndCallback;
        window.speechSynthesis.speak(u);
      } else if (typeof onEndCallback === "function") {
        onEndCallback();
      }
    });
  }

  function playStatusAnnouncement(statusKey, onEndCallback) {
    stopCurrentAudio();
    if (isMuted) {
      if (typeof onEndCallback === "function") onEndCallback();
      return;
    }

    const cacheKey = `${state.voiceGender}_${statusKey}`;
    let audio = audioCache.get(cacheKey);
    if (!audio) audio = new Audio(`voices/${state.voiceGender}/${statusKey}.mp3`);

    audio.volume = masterVolume;
    audio.playbackRate = 1.0;
    audio.currentTime = 0;
    currentAudio = audio;

    audio.onended = () => {
      currentAudio = null;
      if (typeof onEndCallback === "function") onEndCallback();
    };

    audio.play().catch(() => {
      if (typeof onEndCallback === "function") onEndCallback();
    });
  }

  // --------------------------------------------------------------------------
  // CUSTOM IN-APP TOAST (REPLACES NATIVE alert())
  // --------------------------------------------------------------------------
  function showToast(message, isError = false) {
    const toast = document.getElementById("customToast");
    if (!toast) return;
    toast.textContent = message;
    toast.style.borderColor = isError ? "#ef4444" : "#facc15";
    toast.style.color = isError ? "#fca5a5" : "#ffffff";
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 3200);
  }

  // --------------------------------------------------------------------------
  // PERSISTENCE & HARDWARE FINGERPRINT
  // --------------------------------------------------------------------------
  async function loadSavedState() {
    let saved = null;
    if (window.RoyalDesktopBridge && window.RoyalDesktopBridge.getHardwareId) {
      try {
        state.hardwareId = await window.RoyalDesktopBridge.getHardwareId();
        saved = await window.RoyalDesktopBridge.loadState();
      } catch (_e) {}
    }
    if (!saved) {
      const raw = localStorage.getItem("ROYAL_BINGO_PRO_500_V2_STATE");
      if (raw) {
        try { saved = JSON.parse(raw); } catch (_e) {}
      }
    }
    if (saved) {
      state.hallName = saved.hallName || state.hallName;
      state.cityName = saved.cityName || state.cityName;
      state.sequenceNumber = Number(saved.sequenceNumber) || 1;
      state.walletTokens = typeof saved.walletTokens === "number" ? saved.walletTokens : 0;
      state.userPinHash = saved.userPinHash || null;
      state.commissionPercent = typeof saved.commissionPercent === "number" ? saved.commissionPercent : 25;
      state.stakePerCartela = Number(saved.stakePerCartela) || 30;
      state.strictLastBallRule = saved.strictLastBallRule !== false;
      state.theme = saved.theme || "night";
      state.remoteLedgerUrl = saved.remoteLedgerUrl || Core.CONFIG.REMOTE_WALLET_LEDGER_URL;
      state.roundLogs = Array.isArray(saved.roundLogs) ? saved.roundLogs : [];
    }
    state.userId = Core.generateMachineUserId(state.cityName, state.hallName, state.hardwareId);
  }

  async function persistState() {
    const payload = {
      hallName: state.hallName,
      cityName: state.cityName,
      userId: state.userId,
      sequenceNumber: state.sequenceNumber,
      walletTokens: state.walletTokens,
      userPinHash: state.userPinHash,
      commissionPercent: state.commissionPercent,
      stakePerCartela: state.stakePerCartela,
      strictLastBallRule: state.strictLastBallRule,
      theme: state.theme,
      remoteLedgerUrl: state.remoteLedgerUrl,
      roundLogs: state.roundLogs
    };
    localStorage.setItem("ROYAL_BINGO_PRO_500_V2_STATE", JSON.stringify(payload));
    if (window.RoyalDesktopBridge && window.RoyalDesktopBridge.saveState) {
      try { await window.RoyalDesktopBridge.saveState(payload); } catch (_e) {}
    }
  }

  // --------------------------------------------------------------------------
  // FINANCIAL CALCULATIONS & UI UPDATES
  // --------------------------------------------------------------------------
  function getFinancialSummary() {
    const count = state.selectedCartelas.size;
    const gross = count * state.stakePerCartela;
    const houseCut = Math.round(gross * (state.commissionPercent / 100));
    const netPrize = gross - houseCut;
    return { count, gross, houseCut, netPrize };
  }

  function renderPatternMiniGrid(containerId, patternId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    const pat = Core.WINNING_PATTERNS.find((p) => p.id === patternId) || Core.WINNING_PATTERNS[0];
    const activeSet = new Set(pat.previewCells.map(([r, c]) => `${r},${c}`));
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const div = document.createElement("div");
        div.className = "mini-cell";
        if (r === 2 && c === 2) div.classList.add("free");
        if (activeSet.has(`${r},${c}`)) div.classList.add("active");
        container.appendChild(div);
      }
    }
  }

  function updateHeaderAndCalculatorUI() {
    const fin = getFinancialSummary();
    const pat = Core.WINNING_PATTERNS.find((p) => p.id === state.selectedPatternId) || Core.WINNING_PATTERNS[0];

    document.getElementById("hallIdentityDisplay").textContent = `${state.hallName} (${state.cityName}) — User ID: ${state.userId}`;
    document.getElementById("topActivePatternName").textContent = pat.titleAm;
    document.getElementById("topBookedCount").textContent = `${fin.count} ካርቴላ`;
    document.getElementById("topNetPrizeDisplay").textContent = `${fin.netPrize.toLocaleString()} ብር`;

    // Wallet display respects 4-digit PIN lock
    const walletEl = document.getElementById("walletBalanceText");
    walletEl.textContent = state.isWalletUnlocked
      ? `${state.walletTokens.toLocaleString()} ቶከን`
      : "••••••••";

    document.getElementById("calcCartelaCount").textContent = `${fin.count} ካርቴላ`;
    document.getElementById("calcGrossAmount").textContent = `${fin.gross.toLocaleString()} ብር`;
    document.getElementById("calcCommissionPct").textContent = state.commissionPercent;
    document.getElementById("calcHouseCut").textContent = `${fin.houseCut.toLocaleString()} ብር`;
    document.getElementById("calcNetPrizeGold").textContent = `${fin.netPrize.toLocaleString()} ብር`;

    document.getElementById("setupPatternTitleAm").textContent = `${pat.order}. ${pat.titleAm}`;
    document.getElementById("setupPatternDescAm").textContent = pat.description;
    renderPatternMiniGrid("setupPatternMiniGrid", state.selectedPatternId);

    // Arena Widgets
    document.getElementById("arenaPatternTitle").textContent = pat.titleAm;
    document.getElementById("arenaPrizeValue").textContent = `${fin.netPrize.toLocaleString()} ብር`;
    renderPatternMiniGrid("arenaPatternMiniGrid", state.selectedPatternId);

    const lockedArr = Array.from(state.lockedCartelas).sort((a, b) => a - b);
    document.getElementById("lockedCartelasListText").textContent =
      lockedArr.length > 0 ? lockedArr.map((x) => `#${x}`).join(", ") : "የለም";

    // Theme body class
    document.body.className = state.theme === "day" ? "theme-day" : "theme-night";
    document.getElementById("themeToggleBtn").textContent =
      state.theme === "day" ? "🌙 የምሽት ገጽታ" : "☀️ የቀን ገጽታ";
  }

  // --------------------------------------------------------------------------
  // CARTELA SELECTION GRID (1 TO 500)
  // --------------------------------------------------------------------------
  function render500CartelaGrid() {
    const grid = document.getElementById("cartelaGrid500");
    grid.innerHTML = "";
    let min = 1, max = 500;
    if (state.currentRangeFilter !== "ALL") {
      const parts = state.currentRangeFilter.split("-").map(Number);
      min = parts[0];
      max = parts[1];
    }

    for (let id = min; id <= max; id++) {
      const btn = document.createElement("button");
      btn.className = "cartela-tile";
      if (state.selectedCartelas.has(id)) btn.classList.add("selected");
      btn.textContent = id;
      btn.title = `ካርቴላ #${id} — ለመያዝ ይንኩ፤ ለማየት በረጅሙ ይያዙ`;
      btn.addEventListener("click", () => {
        if (state.selectedCartelas.has(id)) {
          state.selectedCartelas.delete(id);
          btn.classList.remove("selected");
        } else {
          state.selectedCartelas.add(id);
          btn.classList.add("selected");
        }
        updateHeaderAndCalculatorUI();
      });
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openVerifierModal(id, "INSPECT");
      });
      grid.appendChild(btn);
    }
  }

  // --------------------------------------------------------------------------
  // MASTER 1-75 CALLED BOARD
  // --------------------------------------------------------------------------
  function renderMaster75Board() {
    const container = document.getElementById("master75Grid");
    container.innerHTML = "";
    const rows = [
      { letter: "B", min: 1, max: 15 },
      { letter: "I", min: 16, max: 30 },
      { letter: "N", min: 31, max: 45 },
      { letter: "G", min: 46, max: 60 },
      { letter: "O", min: 61, max: 75 }
    ];
    const calledSet = new Set(state.calledHistory);
    const latestNum = state.calledHistory.length > 0 ? state.calledHistory[state.calledHistory.length - 1] : null;

    rows.forEach((r) => {
      const rowEl = document.createElement("div");
      rowEl.className = "master-row";
      const letterBox = document.createElement("div");
      letterBox.className = "master-letter-box";
      letterBox.textContent = r.letter;
      rowEl.appendChild(letterBox);

      for (let n = r.min; n <= r.max; n++) {
        const cell = document.createElement("div");
        cell.className = "master-ball-cell";
        if (calledSet.has(n)) cell.classList.add("called");
        if (n === latestNum) cell.classList.add("latest-call");
        cell.textContent = n;
        rowEl.appendChild(cell);
      }
      container.appendChild(rowEl);
    });

    document.getElementById("calledCountBadge").textContent = `${state.calledHistory.length} / 75`;
  }

  function updateArenaLiveCircles() {
    const len = state.calledHistory.length;
    const current = len >= 1 ? state.calledHistory[len - 1] : null;
    const prev1 = len >= 2 ? state.calledHistory[len - 2] : null;
    const prev2 = len >= 3 ? state.calledHistory[len - 3] : null;
    const prev3 = len >= 4 ? state.calledHistory[len - 4] : null;

    if (current) {
      const callObj = Core.AMHARIC_BALL_CALLS[current];
      document.getElementById("liveBallLetter").textContent = callObj.letter;
      document.getElementById("liveBallNumber").textContent = callObj.number;
      document.getElementById("liveBallAmharicSub").textContent = callObj.amharicText;
      document.getElementById("liveAmharicPhraseBanner").textContent = `"${callObj.amharicText}"`;
    } else {
      document.getElementById("liveBallLetter").textContent = "B";
      document.getElementById("liveBallNumber").textContent = "--";
      document.getElementById("liveBallAmharicSub").textContent = "ለመጀመር ዝግጁ";
      document.getElementById("liveAmharicPhraseBanner").textContent = '"ጨዋታው ተጀምሯል፣ መልካም ዕድል!"';
    }

    document.getElementById("prevBall1Text").textContent = prev1 ? Core.AMHARIC_BALL_CALLS[prev1].code : "--";
    document.getElementById("prevBall2Text").textContent = prev2 ? Core.AMHARIC_BALL_CALLS[prev2].code : "--";
    document.getElementById("prevBall3Text").textContent = prev3 ? Core.AMHARIC_BALL_CALLS[prev3].code : "--";
  }

  // --------------------------------------------------------------------------
  // LIVE CALLER LOOP WITH EXACT DURATION CHAINING
  // --------------------------------------------------------------------------
  function drawNextBall() {
    if (!state.isGameActive || state.isPaused) return;
    if (state.remainingDeck.length === 0) {
      pauseGame(true);
      return;
    }

    const nextNum = state.remainingDeck.pop();
    state.calledHistory.push(nextNum);
    renderMaster75Board();
    updateArenaLiveCircles();
    playBallCall(nextNum);
  }

  function scheduleNextCall() {
    if (state.callTimerId) clearInterval(state.callTimerId);
    state.callTimerId = setInterval(() => {
      if (state.isGameActive && !state.isPaused) {
        drawNextBall();
      }
    }, state.callIntervalSeconds * 1000);
  }

  function startNewGameRound() {
    const fin = getFinancialSummary();
    if (fin.count < 2) {
      showToast("እባክዎ ጨዋታ ከመጀመርዎ በፊት ቢያንስ 2 ካርቴላዎችን ይምረጡ!", true);
      return;
    }
    if (state.walletTokens < fin.houseCut) {
      showToast(`የዋሌት ቶከንዎ (${state.walletTokens.toLocaleString()}) ለዚህ ዙር ኮሚሽን (${fin.houseCut.toLocaleString()}) በቂ አይደለም! እባክዎ ዋሌት ይሙሉ።`, true);
      openWalletModal();
      return;
    }

    // Deduct operator cut from Wallet Token
    state.walletTokens -= fin.houseCut;
    persistState();

    // Shuffle 1..75
    const deck = [];
    for (let i = 1; i <= 75; i++) deck.push(i);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }

    state.remainingDeck = deck;
    state.calledHistory = [];
    state.lockedCartelas.clear();
    state.isGameActive = true;
    state.isPaused = false;

    // Switch view
    document.getElementById("setupView").classList.remove("active-view");
    document.getElementById("arenaView").classList.add("active-view");
    document.getElementById("pauseResumeBtn").textContent = "⏸️ ጨዋታ አቁም";

    updateHeaderAndCalculatorUI();
    renderMaster75Board();
    updateArenaLiveCircles();

    playStatusAnnouncement("status_game_start", () => {
      scheduleNextCall();
    });
  }

  function pauseGame(silent) {
    state.isPaused = true;
    const btn = document.getElementById("pauseResumeBtn");
    if (btn) btn.textContent = "▶️ ጨዋታ ቀጥል";
    stopCurrentAudio();
    if (!silent) playStatusAnnouncement("status_game_paused");
  }

  function resumeGame() {
    if (!state.isGameActive) return;
    state.isPaused = false;
    const btn = document.getElementById("pauseResumeBtn");
    if (btn) btn.textContent = "⏸️ ጨዋታ አቁም";
    playStatusAnnouncement("status_game_resumed");
  }

  // --------------------------------------------------------------------------
  // SMART WIN VERIFIER & STRICT LAST-BALL ENGINE
  // --------------------------------------------------------------------------
  function openVerifierModal(cartelaId, mode) {
    const id = Number(cartelaId);
    if (!Number.isInteger(id) || id < 1 || id > 500) {
      showToast("እባክዎ ከ 1 እስከ 500 ያለ ትክክለኛ የካርቴላ ቁጥር ያስገቡ!", true);
      return;
    }
    if (state.isGameActive && !state.isPaused) pauseGame(true);

    state.lastInspectedCartelaId = id;
    const cartela = Core.generateCartelaById(id);
    const result = Core.verifyCartelaWin(
      cartela,
      state.calledHistory,
      state.selectedPatternId,
      state.strictLastBallRule
    );
    const isBooked = state.selectedCartelas.has(id);
    const isAlreadyLocked = state.lockedCartelas.has(id);
    const fin = getFinancialSummary();
    const pat = Core.WINNING_PATTERNS.find((p) => p.id === state.selectedPatternId) || Core.WINNING_PATTERNS[0];

    document.getElementById("modalCartelaNumber").textContent = `#${id}`;
    document.getElementById("modalPrizeAmountText").textContent = `${fin.netPrize.toLocaleString()} ብር`;
    document.getElementById("modalPatternNameText").textContent = pat.titleAm;
    document.getElementById("modalBookingStatusText").textContent = isBooked
      ? "✅ በዚህ ዙር የተመዘገበ ካርቴላ"
      : "⚠️ በዚህ ዙር ያልተመዘገበ ካርቴላ!";

    const banner = document.getElementById("verifierStatusBanner");
    const unlockBtn = document.getElementById("unlockCartelaBtn");
    const lockBadge = document.getElementById("modalCartelaLockBadge");

    if (mode === "VERIFY") {
      if (isAlreadyLocked) {
        banner.className = "verifier-status-banner locked";
        banner.textContent = `🔒 ካርቴላ #${id} ቀድሞውኑ ታስሯል!`;
        unlockBtn.style.display = "block";
      } else if (result.isWinner) {
        banner.className = "verifier-status-banner win";
        banner.textContent = `🎉 ካርቴላ #${id} አሸንፏል! ለአሸናፊ ደራሽ፦ ${fin.netPrize.toLocaleString()} ብር!`;
        unlockBtn.style.display = "none";
        playStatusAnnouncement("status_cartela_won");

        // Record round in audit log
        state.roundLogs.unshift({
          roundId: state.roundLogs.length + 1,
          time: new Date().toLocaleTimeString("am-ET"),
          players: fin.count,
          stake: state.stakePerCartela,
          gross: fin.gross,
          houseCut: fin.houseCut,
          netPrize: fin.netPrize,
          winnerCartela: id
        });
        persistState();
        renderAuditTable();
      } else if (result.missedLastBall) {
        state.lockedCartelas.add(id);
        updateHeaderAndCalculatorUI();
        banner.className = "verifier-status-banner locked";
        banner.textContent = result.summaryAm;
        unlockBtn.style.display = "block";
        playStatusAnnouncement("status_missed_last_ball");
      } else {
        state.lockedCartelas.add(id);
        updateHeaderAndCalculatorUI();
        banner.className = "verifier-status-banner locked";
        banner.textContent = `❌ አልዘጋም! ካርቴላ #${id} በዚህ ዙር ታስሯል!`;
        unlockBtn.style.display = "block";
        playStatusAnnouncement("status_cartela_locked");
      }
    } else {
      // INSPECT ONLY
      banner.className = "verifier-status-banner inspect";
      banner.textContent = `🔍 የቁጥር ማረጋገጫ ብቻ — ካርቴላ #${id} አልታሰረም`;
      unlockBtn.style.display = state.lockedCartelas.has(id) ? "block" : "none";
      playStatusAnnouncement("status_inspect_only");
    }

    lockBadge.textContent = state.lockedCartelas.has(id) ? "🔒 የታሰረ" : "🟢 ንቁ";

    // 5x5 Cartela Grid
    const gridEl = document.getElementById("modalCartela5x5Grid");
    gridEl.innerHTML = "";
    const hitSet = new Set(result.allHitCells.map(([r, c]) => `${r},${c}`));
    const winSet = new Set(result.winningCells.map(([r, c]) => `${r},${c}`));

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const cell = document.createElement("div");
        cell.className = "cartela-cell";
        const val = cartela.grid[r][c];
        cell.textContent = val === 0 ? "Free" : val;
        const key = `${r},${c}`;
        if (hitSet.has(key)) cell.classList.add("hit");
        if (winSet.has(key) && result.isWinner) cell.classList.add("win-line");
        gridEl.appendChild(cell);
      }
    }

    document.getElementById("verifierModal").classList.add("open");
  }

  // --------------------------------------------------------------------------
  // 4-DIGIT PIN AUTHENTICATION & WALLET DIALOGS
  // --------------------------------------------------------------------------
  function promptUserPin(onSuccessCallback) {
    if (state.isWalletUnlocked) {
      if (typeof onSuccessCallback === "function") onSuccessCallback();
      return;
    }

    const modal = document.getElementById("pinAuthModal");
    const pinInput = document.getElementById("userPinInput");
    pinInput.value = "";

    const isFirstTime = !state.userPinHash;
    document.getElementById("pinModalTitle").textContent = isFirstTime
      ? "🔐 አዲስ ባለ 4-አሃዝ ሚስጥር ቁጥር (PIN) ይፍጠሩ"
      : "🔐 ባለ 4-አሃዝ ሚስጥር ቁጥርዎን ያስገቡ";
    document.getElementById("pinModalDesc").textContent = isFirstTime
      ? "የዋሌት ሂሳብዎንና ሪፖርቶችን ለወደፊት ለመጠበቅ የራስዎን 4 አሃዝ ሚስጥር ቁጥር አሁን ይፍጠሩ፦"
      : "ቀሪ ዋሌትንና የገቢ ሪፖርቶችን ለመክፈት ሚስጥር ቁጥርዎን ያስገቡ፦";

    const submitHandler = () => {
      const pin = pinInput.value.trim();
      if (!/^\d{4}$/.test(pin)) {
        showToast("እባክዎ 4 አሃዝ ቁጥር ብቻ ያስገቡ!", true);
        return;
      }

      if (isFirstTime) {
        state.userPinHash = Core.hashUserPin(pin, state.userId);
        state.isWalletUnlocked = true;
        persistState();
        modal.classList.remove("open");
        showToast("ሚስጥር ቁጥርዎ በተሳካ ሁኔታ ተቀምጧል!");
        updateHeaderAndCalculatorUI();
        if (typeof onSuccessCallback === "function") onSuccessCallback();
      } else {
        const testHash = Core.hashUserPin(pin, state.userId);
        if (testHash === state.userPinHash || pin === Core.CONFIG.ADMIN_SECRET_PIN) {
          state.isWalletUnlocked = true;
          modal.classList.remove("open");
          updateHeaderAndCalculatorUI();
          if (typeof onSuccessCallback === "function") onSuccessCallback();
        } else {
          showToast("የተሳሳተ ሚስጥር ቁጥር!", true);
        }
      }
    };

    document.getElementById("submitPinBtn").onclick = submitHandler;
    pinInput.onkeydown = (e) => { if (e.key === "Enter") submitHandler(); };

    modal.classList.add("open");
    setTimeout(() => pinInput.focus(), 150);
  }

  function openWalletModal() {
    promptUserPin(() => {
      document.getElementById("modalMachineUserId").textContent = state.userId;
      document.getElementById("modalSequenceNumber").textContent = state.sequenceNumber;
      document.getElementById("modalCurrentWallet").textContent = `${state.walletTokens.toLocaleString()} ቶከን`;
      document.getElementById("hallNameInput").value = state.hallName;
      document.getElementById("cityNameInput").value = state.cityName;
      document.getElementById("remoteLedgerUrlInput").value = state.remoteLedgerUrl;
      document.getElementById("walletTopUpFeedback").textContent = "";
      renderAuditTable();
      document.getElementById("walletModal").classList.add("open");
    });
  }

  // Universal Top-Up Handler (Accepts 16-Char Code OR Full JSON snippet)
  async function handleUniversalTopUp() {
    const inputVal = document.getElementById("universalTopUpInput").value.trim();
    const feedback = document.getElementById("walletTopUpFeedback");

    const res = Core.verifyUniversalTopUpInput(inputVal, state.userId, state.sequenceNumber);
    if (!res.valid) {
      feedback.style.color = "#ef4444";
      feedback.textContent = res.reasonAm;
      return;
    }

    state.walletTokens += res.amountTokens;
    state.sequenceNumber = res.newSequenceNumber;
    document.getElementById("universalTopUpInput").value = "";
    await persistState();

    updateHeaderAndCalculatorUI();
    document.getElementById("modalCurrentWallet").textContent = `${state.walletTokens.toLocaleString()} ቶከን`;
    document.getElementById("modalSequenceNumber").textContent = state.sequenceNumber;

    feedback.style.color = "#22c55e";
    feedback.textContent = res.messageAm;
    playStatusAnnouncement("status_wallet_topup_success");
  }

  // Online Hotspot Auto-Sync
  async function handleOnlineAutoTopUp() {
    const feedback = document.getElementById("walletTopUpFeedback");
    feedback.style.color = "#facc15";
    feedback.textContent = "⏳ ከኢንተርኔት Ledger ጋር በመገናኘት ላይ...";
    const url = document.getElementById("remoteLedgerUrlInput").value.trim();
    state.remoteLedgerUrl = url;
    await persistState();

    try {
      const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const entries = Array.isArray(data.credits) ? data.credits : [];

      const matching = entries.find(
        (item) =>
          String(item.userId).toUpperCase().trim() === state.userId &&
          Number(item.sequenceNumber) === state.sequenceNumber
      );

      if (!matching) {
        feedback.style.color = "#ef4444";
        feedback.textContent = `ለUser ID (${state.userId}) በSequence #${state.sequenceNumber} የተላከ አዲስ ክሬዲት አልተገኘም።`;
        return;
      }

      const verifyRes = Core.verifyUniversalTopUpInput(matching.signedKey, state.userId, state.sequenceNumber);
      if (!verifyRes.valid) {
        feedback.style.color = "#ef4444";
        feedback.textContent = verifyRes.reasonAm;
        return;
      }

      state.walletTokens += verifyRes.amountTokens;
      state.sequenceNumber = verifyRes.newSequenceNumber;
      await persistState();

      updateHeaderAndCalculatorUI();
      document.getElementById("modalCurrentWallet").textContent = `${state.walletTokens.toLocaleString()} ቶከን`;
      document.getElementById("modalSequenceNumber").textContent = state.sequenceNumber;

      feedback.style.color = "#22c55e";
      feedback.textContent = verifyRes.messageAm;
      playStatusAnnouncement("status_wallet_topup_success");
    } catch (_err) {
      feedback.style.color = "#ef4444";
      feedback.textContent = "ኢንተርኔት አልተገኘም ወይም የLedger URL አልተከፈተም! እባክዎ ባለ 16-ፊደሉን ኮድ ይጠቀሙ።";
    }
  }

  // Daily Audit Table
  function renderAuditTable() {
    const tbody = document.getElementById("auditTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (state.roundLogs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="padding:10px; color:#94a3b8;">ምንም የተመዘገበ የጨዋታ ዙር የለም</td></tr>`;
      return;
    }
    state.roundLogs.forEach((log) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>#${log.roundId}</strong></td>
        <td>${log.time}</td>
        <td>${log.players}</td>
        <td>${log.stake} ብር</td>
        <td>${log.gross.toLocaleString()} ብር</td>
        <td style="color:#22c55e;">${log.houseCut.toLocaleString()} ብር</td>
        <td style="color:#facc15;">${log.netPrize.toLocaleString()} ብር</td>
        <td><strong>ካርቴላ #${log.winnerCartela}</strong></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // --------------------------------------------------------------------------
  // INITIALIZATION & EVENT BINDINGS
  // --------------------------------------------------------------------------
  async function initApp() {
    await loadSavedState();
    preloadAudioAssets();

    // Populate Winning Patterns Dropdown (Pure Amharic)
    const patSelect = document.getElementById("winningPatternSelect");
    Core.WINNING_PATTERNS.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.order}. ${p.titleAm}`;
      if (p.id === state.selectedPatternId) opt.selected = true;
      patSelect.appendChild(opt);
    });

    patSelect.addEventListener("change", (e) => {
      state.selectedPatternId = e.target.value;
      updateHeaderAndCalculatorUI();
    });

    // Stake Presets
    document.querySelectorAll(".stake-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".stake-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.stakePerCartela = Number(btn.dataset.stake);
        document.getElementById("customStakeInput").value = state.stakePerCartela;
        persistState();
        updateHeaderAndCalculatorUI();
      });
    });

    document.getElementById("customStakeInput").addEventListener("input", (e) => {
      const val = Number(e.target.value);
      if (val > 0) {
        state.stakePerCartela = val;
        updateHeaderAndCalculatorUI();
      }
    });

    // Quick Add
    const quickInput = document.getElementById("quickCartelaInput");
    const triggerQuickAdd = () => {
      const id = Number(quickInput.value);
      if (Number.isInteger(id) && id >= 1 && id <= 500) {
        if (state.selectedCartelas.has(id)) state.selectedCartelas.delete(id);
        else state.selectedCartelas.add(id);
        quickInput.value = "";
        render500CartelaGrid();
        updateHeaderAndCalculatorUI();
      }
    };
    document.getElementById("quickAddBtn").addEventListener("click", triggerQuickAdd);
    quickInput.addEventListener("keydown", (e) => { if (e.key === "Enter") triggerQuickAdd(); });

    // Swap Cartela
    document.getElementById("swapCartelaBtn").addEventListener("click", () => {
      const fromId = Number(document.getElementById("swapFromInput").value);
      const toId = Number(document.getElementById("swapToInput").value);
      if (Number.isInteger(fromId) && Number.isInteger(toId) && fromId >= 1 && fromId <= 500 && toId >= 1 && toId <= 500) {
        state.selectedCartelas.delete(fromId);
        state.selectedCartelas.add(toId);
        document.getElementById("swapFromInput").value = "";
        document.getElementById("swapToInput").value = "";
        render500CartelaGrid();
        updateHeaderAndCalculatorUI();
      }
    });

    // Range Tabs
    document.querySelectorAll("#cartelaRangeTabs .tab-btn").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll("#cartelaRangeTabs .tab-btn").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        state.currentRangeFilter = tab.dataset.range;
        render500CartelaGrid();
      });
    });

    // Clear Selected & Start Game
    document.getElementById("clearAllSelectedBtn").addEventListener("click", () => {
      state.selectedCartelas.clear();
      render500CartelaGrid();
      updateHeaderAndCalculatorUI();
    });

    document.getElementById("startGameBtn").addEventListener("click", startNewGameRound);

    // Arena Controls
    document.getElementById("pauseResumeBtn").addEventListener("click", () => {
      if (state.isPaused) resumeGame();
      else pauseGame(false);
    });

    document.getElementById("replayVoiceBtn").addEventListener("click", () => {
      if (state.calledHistory.length > 0) {
        const last = state.calledHistory[state.calledHistory.length - 1];
        playBallCall(last);
      }
    });

    document.getElementById("callSpeedSlider").addEventListener("input", (e) => {
      state.callIntervalSeconds = Number(e.target.value);
      document.getElementById("speedValueLabel").textContent = `${state.callIntervalSeconds.toFixed(1)} ሰከንድ`;
      setCallIntervalSpeed(state.callIntervalSeconds);
      if (state.isGameActive) scheduleNextCall();
    });

    document.getElementById("voiceGenderSelect").addEventListener("change", (e) => {
      state.voiceGender = e.target.value;
    });

    document.getElementById("arenaResetBoardBtn").addEventListener("click", () => {
      if (confirm("የቀጥታ ጨዋታውን ሰሌዳ እንደገና ማጽዳት ይፈልጋሉ?")) {
        state.calledHistory = [];
        renderMaster75Board();
        updateArenaLiveCircles();
      }
    });

    // Volume & Mute Controls
    const volSlider = document.getElementById("masterVolumeSlider");
    const volBtn = document.getElementById("volumeMuteBtn");
    volSlider.addEventListener("input", (e) => {
      masterVolume = Number(e.target.value) / 100;
      if (currentAudio) currentAudio.volume = masterVolume;
    });
    volBtn.addEventListener("click", () => {
      isMuted = !isMuted;
      volBtn.style.opacity = isMuted ? "0.4" : "1.0";
      if (isMuted) stopCurrentAudio();
    });

    // Return to Setup
    document.getElementById("returnHomeBtn").addEventListener("click", () => {
      if (state.callTimerId) clearInterval(state.callTimerId);
      state.isGameActive = false;
      state.isPaused = false;
      document.getElementById("arenaView").classList.remove("active-view");
      document.getElementById("setupView").classList.add("active-view");
      render500CartelaGrid();
      updateHeaderAndCalculatorUI();
    });

    // Verifier & Inspect Buttons
    document.getElementById("verifyWinBtn").addEventListener("click", () => {
      const id = Number(document.getElementById("verifyCartelaInput").value);
      openVerifierModal(id, "VERIFY");
    });

    document.getElementById("inspectOnlyBtn").addEventListener("click", () => {
      const id = Number(document.getElementById("verifyCartelaInput").value);
      openVerifierModal(id, "INSPECT");
    });

    document.getElementById("verifyCartelaInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") openVerifierModal(Number(e.target.value), "VERIFY");
    });

    document.getElementById("closeVerifierModalBtn").addEventListener("click", () => {
      document.getElementById("verifierModal").classList.remove("open");
    });

    document.getElementById("unlockCartelaBtn").addEventListener("click", () => {
      if (state.lastInspectedCartelaId) {
        state.lockedCartelas.delete(state.lastInspectedCartelaId);
        updateHeaderAndCalculatorUI();
        openVerifierModal(state.lastInspectedCartelaId, "INSPECT");
        playStatusAnnouncement("status_cartela_unlocked");
      }
    });

    document.getElementById("resumeAfterVerifyBtn").addEventListener("click", () => {
      document.getElementById("verifierModal").classList.remove("open");
      resumeGame();
    });

    document.getElementById("newRoundAfterWinBtn").addEventListener("click", () => {
      document.getElementById("verifierModal").classList.remove("open");
      if (state.callTimerId) clearInterval(state.callTimerId);
      state.isGameActive = false;
      document.getElementById("arenaView").classList.remove("active-view");
      document.getElementById("setupView").classList.add("active-view");
    });

    // Wallet Modals & Top-Up
    document.getElementById("walletToggleBtn").addEventListener("click", () => {
      promptUserPin(() => {
        showToast(`ቀሪ ዋሌት፦ ${state.walletTokens.toLocaleString()} ቶከን`);
      });
    });

    document.getElementById("openWalletModalBtn").addEventListener("click", openWalletModal);
    document.getElementById("closeWalletModalBtn").addEventListener("click", () => {
      document.getElementById("walletModal").classList.remove("open");
    });

    document.getElementById("applyUniversalTopUpBtn").addEventListener("click", handleUniversalTopUp);
    document.getElementById("onlineAutoTopUpBtn").addEventListener("click", handleOnlineAutoTopUp);

    // PIN Reset Modal
    document.getElementById("closePinModalBtn").addEventListener("click", () => {
      document.getElementById("pinAuthModal").classList.remove("open");
    });

    document.getElementById("forgotPinBtn").addEventListener("click", () => {
      document.getElementById("pinAuthModal").classList.remove("open");
      document.getElementById("pinResetModal").classList.add("open");
    });

    document.getElementById("closePinResetModalBtn").addEventListener("click", () => {
      document.getElementById("pinResetModal").classList.remove("open");
    });

    document.getElementById("applyPinResetBtn").addEventListener("click", () => {
      const code = document.getElementById("pinResetCodeInput").value.trim();
      const newPin = document.getElementById("newPinInput").value.trim();
      const feedback = document.getElementById("pinResetFeedback");

      if (!/^\d{4}$/.test(newPin)) {
        feedback.style.color = "#ef4444";
        feedback.textContent = "እባክዎ 4 አሃዝ አዲስ ሚስጥር ቁጥር ያስገቡ!";
        return;
      }

      if (Core.verifyPinResetToken(code, state.userId) || code === Core.CONFIG.ADMIN_SECRET_PIN) {
        state.userPinHash = Core.hashUserPin(newPin, state.userId);
        state.isWalletUnlocked = true;
        persistState();
        feedback.style.color = "#22c55e";
        feedback.textContent = "አዲሱ ሚስጥር ቁጥርዎ በተሳካ ሁኔታ ተቀምጧል!";
        setTimeout(() => {
          document.getElementById("pinResetModal").classList.remove("open");
          updateHeaderAndCalculatorUI();
        }, 1200);
      } else {
        feedback.style.color = "#ef4444";
        feedback.textContent = "የተሳሳተ የReset ኮድ! እባክዎ ከAdmin ትክክለኛውን ኮድ ይጠይቁ።";
      }
    });

    // Bonus Modal
    document.getElementById("openBonusInfoBtn").addEventListener("click", () => {
      document.getElementById("bonusModal").classList.add("open");
    });
    document.getElementById("closeBonusModalBtn").addEventListener("click", () => {
      document.getElementById("bonusModal").classList.remove("open");
    });
    document.getElementById("closeBonusDoneBtn").addEventListener("click", () => {
      document.getElementById("bonusModal").classList.remove("open");
    });

    // Audit Table Toggle & Clear
    document.getElementById("toggleAuditTableBtn").addEventListener("click", () => {
      const wrap = document.getElementById("auditTableContainer");
      wrap.style.display = wrap.style.display === "none" ? "block" : "none";
    });

    document.getElementById("clearAuditLogsBtn").addEventListener("click", () => {
      if (confirm("የጨዋታ ዙሮች ሪፖርቱን በሙሉ ማጽዳት ይፈልጋሉ?")) {
        state.roundLogs = [];
        persistState();
        renderAuditTable();
      }
    });

    // Theme Toggle
    document.getElementById("themeToggleBtn").addEventListener("click", () => {
      state.theme = state.theme === "night" ? "day" : "night";
      persistState();
      updateHeaderAndCalculatorUI();
    });

    // Settings Modal
    document.getElementById("openSettingsModalBtn").addEventListener("click", () => {
      document.getElementById("commissionPercentInput").value = state.commissionPercent;
      document.getElementById("strictLastBallRuleSelect").value = String(state.strictLastBallRule);
      document.getElementById("themeSelectField").value = state.theme;
      document.getElementById("settingsModal").classList.add("open");
    });

    document.getElementById("closeSettingsModalBtn").addEventListener("click", () => {
      document.getElementById("settingsModal").classList.remove("open");
    });

    document.getElementById("saveSettingsBtn").addEventListener("click", async () => {
      const cut = Number(document.getElementById("commissionPercentInput").value);
      if (cut >= 5 && cut <= 50) state.commissionPercent = cut;
      state.strictLastBallRule = document.getElementById("strictLastBallRuleSelect").value === "true";
      state.theme = document.getElementById("themeSelectField").value;
      await persistState();
      updateHeaderAndCalculatorUI();
      document.getElementById("settingsModal").classList.remove("open");
      showToast("ውቅሮች በተሳካ ሁኔታ ተቀምጠዋል!");
    });

    // Fullscreen
    document.getElementById("fullscreenBtn").addEventListener("click", () => {
      if (window.RoyalDesktopBridge && window.RoyalDesktopBridge.toggleFullscreen) {
        window.RoyalDesktopBridge.toggleFullscreen();
      } else if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Pro Keyboard Shortcuts
    window.addEventListener("keydown", (e) => {
      if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "SELECT") return;

      if (e.code === "Space") {
        e.preventDefault();
        if (state.isGameActive) {
          if (state.isPaused) resumeGame();
          else pauseGame(false);
        }
      } else if (e.key === "r" || e.key === "R") {
        if (state.calledHistory.length > 0) playBallCall(state.calledHistory[state.calledHistory.length - 1]);
      } else if (e.key === "v" || e.key === "V") {
        document.getElementById("verifyCartelaInput").focus();
      } else if (e.key === "m" || e.key === "M") {
        isMuted = !isMuted;
        document.getElementById("volumeMuteBtn").style.opacity = isMuted ? "0.4" : "1.0";
        if (isMuted) stopCurrentAudio();
      }
    });

    render500CartelaGrid();
    updateHeaderAndCalculatorUI();
  }

  window.addEventListener("DOMContentLoaded", initApp);
})();
