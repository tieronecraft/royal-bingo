/**
 * ============================================================================
 * ሮያል ቢንጎ ፕሮ (Royal Bingo Pro 500) — Desktop `.EXE` Hall Controller
 * Implements Items 1, 2, 3, 4, 5, 6, 7, and 8 with zero placeholders.
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
    userId: "RB-SKT-4829",
    sequenceNumber: 1,
    walletTokens: 1000000,
    walletMasked: false,
    commissionPercent: Core.CONFIG.DEFAULT_COMMISSION_PERCENT,
    stakePerCartela: 30,
    selectedPatternId: "PATTERN_ANY_1_LINE",
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
    calledHistory: [], // chronological list of called numbers (1..75)
    callTimerId: null,
    lastInspectedCartelaId: null
  };

  // Web Audio Synthesizer for crisp Casino Chime + Amharic Voice Caller
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playCasinoChime(type) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "win") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.12);
        osc.frequency.setValueAtTime(783.99, now + 0.24);
        osc.frequency.setValueAtTime(1046.5, now + 0.36);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
        osc.start(now);
        osc.stop(now + 0.85);
      } else if (type === "lock") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(146.83, now + 0.2);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.start(now);
        osc.stop(now + 0.55);
      } else {
        // Standard ball call chime
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      }
    } catch (_e) {
      // Ignore audio context errors if muted
    }
  }

  /**
   * Plays pre-bundled offline neural Amharic MP3 (`voices/female/ball_X.mp3` or `voices/male/ball_X.mp3`)
   * and falls back automatically to Web Speech API (`am-ET`) if MP3 is not yet generated in dev mode.
   */
  function speakAmharicCall(audioRelName, amharicText, chimeType) {
    playCasinoChime(chimeType || "ball");
    const banner = document.getElementById("liveAmharicPhraseBanner");
    if (banner) banner.textContent = `"${amharicText}"`;

    const genderPath = `voices/${state.voiceGender}/${audioRelName}`;
    const audio = new Audio(genderPath);
    audio.play().catch(() => {
      // Fallback to root voices path or Web Speech API (`am-ET`)
      const fallbackAudio = new Audio(`voices/${audioRelName}`);
      fallbackAudio.play().catch(() => {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(amharicText);
          utter.lang = "am-ET";
          utter.rate = 0.92;
          window.speechSynthesis.speak(utter);
        }
      });
    });
  }

  // Persistence Helpers (Electron IPC + localStorage fallback)
  async function loadSavedState() {
    let saved = null;
    if (window.RoyalDesktopBridge && window.RoyalDesktopBridge.getHardwareId) {
      try {
        state.hardwareId = await window.RoyalDesktopBridge.getHardwareId();
        saved = await window.RoyalDesktopBridge.loadState();
      } catch (_e) {}
    }
    if (!saved) {
      const raw = localStorage.getItem("ROYAL_BINGO_PRO_500_STATE_V1");
      if (raw) {
        try {
          saved = JSON.parse(raw);
        } catch (_e) {}
      }
    }
    if (saved) {
      state.hallName = saved.hallName || state.hallName;
      state.cityName = saved.cityName || state.cityName;
      state.sequenceNumber = Number(saved.sequenceNumber) || 1;
      state.walletTokens =
        typeof saved.walletTokens === "number" ? saved.walletTokens : 1000000;
      state.commissionPercent =
        typeof saved.commissionPercent === "number" ? saved.commissionPercent : 25;
      state.stakePerCartela = Number(saved.stakePerCartela) || 30;
      state.remoteLedgerUrl =
        saved.remoteLedgerUrl || Core.CONFIG.REMOTE_WALLET_LEDGER_URL;
    }
    state.userId = Core.generateMachineUserId(
      state.cityName,
      state.hallName,
      state.hardwareId
    );
  }

  async function persistState() {
    const payload = {
      hallName: state.hallName,
      cityName: state.cityName,
      userId: state.userId,
      sequenceNumber: state.sequenceNumber,
      walletTokens: state.walletTokens,
      commissionPercent: state.commissionPercent,
      stakePerCartela: state.stakePerCartela,
      remoteLedgerUrl: state.remoteLedgerUrl
    };
    localStorage.setItem("ROYAL_BINGO_PRO_500_STATE_V1", JSON.stringify(payload));
    if (window.RoyalDesktopBridge && window.RoyalDesktopBridge.saveState) {
      try {
        await window.RoyalDesktopBridge.saveState(payload);
      } catch (_e) {}
    }
  }

  // Prize & Wallet Calculations
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
    const pat =
      Core.WINNING_PATTERNS.find((p) => p.id === patternId) ||
      Core.WINNING_PATTERNS[0];
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
    const pat =
      Core.WINNING_PATTERNS.find((p) => p.id === state.selectedPatternId) ||
      Core.WINNING_PATTERNS[0];

    document.getElementById("hallIdentityDisplay").textContent =
      `${state.hallName} (${state.cityName}) — User ID: ${state.userId}`;
    document.getElementById("topActivePatternName").textContent = pat.titleAm;
    document.getElementById("topBookedCount").textContent = `${fin.count} ካርቴላ`;
    document.getElementById("topNetPrizeDisplay").textContent =
      `${fin.netPrize.toLocaleString()} ብር`;

    const walletEl = document.getElementById("walletBalanceText");
    walletEl.textContent = state.walletMasked
      ? "••••••••"
      : state.walletTokens.toLocaleString();

    document.getElementById("calcCartelaCount").textContent = `${fin.count} ካርቴላ`;
    document.getElementById("calcGrossAmount").textContent =
      `${fin.gross.toLocaleString()} ብር`;
    document.getElementById("calcCommissionPct").textContent =
      state.commissionPercent;
    document.getElementById("calcHouseCut").textContent =
      `${fin.houseCut.toLocaleString()} ብር`;
    document.getElementById("calcNetPct").textContent =
      100 - state.commissionPercent;
    document.getElementById("calcNetPrizeGold").textContent =
      `${fin.netPrize.toLocaleString()} ብር`;

    document.getElementById("setupPatternTitleAm").textContent =
      `${pat.order}. ${pat.titleAm}`;
    document.getElementById("setupPatternDescAm").textContent = pat.description;
    renderPatternMiniGrid("setupPatternMiniGrid", state.selectedPatternId);

    // Update Arena Locked Pattern Corner
    document.getElementById("arenaPatternTitle").textContent = pat.titleAm;
    document.getElementById("arenaPrizeValue").textContent =
      `${fin.netPrize.toLocaleString()} ብር`;
    renderPatternMiniGrid("arenaPatternMiniGrid", state.selectedPatternId);

    const lockedArr = Array.from(state.lockedCartelas).sort((a, b) => a - b);
    document.getElementById("lockedCartelasListText").textContent =
      lockedArr.length > 0 ? lockedArr.map((x) => `#${x}`).join(", ") : "የለም";
  }

  // Render 1..500 Cartela Selection Grid
  function render500CartelaGrid() {
    const grid = document.getElementById("cartelaGrid500");
    grid.innerHTML = "";
    let min = 1;
    let max = 500;
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
      btn.title = `ካርቴላ #${id} — ለመያዝ/ለመተው ይንኩ (Right-Click ለማየት)`;
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

  // Render Master 1-75 Called Numbers Board
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
    const latestNum =
      state.calledHistory.length > 0
        ? state.calledHistory[state.calledHistory.length - 1]
        : null;

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
        cell.id = `master-cell-${n}`;
        if (calledSet.has(n)) cell.classList.add("called");
        if (n === latestNum) cell.classList.add("latest-call");
        cell.textContent = n;
        rowEl.appendChild(cell);
      }
      container.appendChild(rowEl);
    });

    document.getElementById("calledCountBadge").textContent =
      `${state.calledHistory.length} / 75`;
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
      document.getElementById("liveBallAmharicSub").textContent =
        callObj.amharicText;
    } else {
      document.getElementById("liveBallLetter").textContent = "B";
      document.getElementById("liveBallNumber").textContent = "--";
      document.getElementById("liveBallAmharicSub").textContent = "ለመጀመር ዝግጁ";
    }

    document.getElementById("prevBall1Text").textContent = prev1
      ? Core.AMHARIC_BALL_CALLS[prev1].code
      : "--";
    document.getElementById("prevBall2Text").textContent = prev2
      ? Core.AMHARIC_BALL_CALLS[prev2].code
      : "--";
    document.getElementById("prevBall3Text").textContent = prev3
      ? Core.AMHARIC_BALL_CALLS[prev3].code
      : "--";
  }

  // Live Caller Loop
  function drawNextBall() {
    if (!state.isGameActive || state.isPaused) return;
    if (state.remainingDeck.length === 0) {
      pauseGame(true);
      return;
    }
    const nextNum = state.remainingDeck.pop();
    state.calledHistory.push(nextNum);
    const callInfo = Core.AMHARIC_BALL_CALLS[nextNum];
    renderMaster75Board();
    updateArenaLiveCircles();
    speakAmharicCall(`ball_${nextNum}.mp3`, callInfo.amharicText, "ball");
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
      alert("እባክዎ ጨዋታ ከመጀመርዎ በፊት ቢያንስ 2 ካርቴላዎችን ይምረጡ!");
      return;
    }
    if (state.walletTokens < fin.houseCut) {
      alert(
        `የእርስዎ Wallet Token (${state.walletTokens.toLocaleString()}) ለዚህ ዙር ኮሚሽን (${fin.houseCut.toLocaleString()}) በቂ አይደለም! እባክዎ Wallet ይሙሉ።`
      );
      openWalletModal();
      return;
    }

    // Deduct operator commission from Wallet Token balance
    state.walletTokens -= fin.houseCut;
    persistState();

    // Prepare shuffled 1..75 deck
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

    // Switch view to Live Arena
    document.getElementById("setupView").classList.remove("active-view");
    document.getElementById("arenaView").classList.add("active-view");
    document.getElementById("pauseResumeBtn").textContent =
      "⏸️ ጨዋታ አቁም (Pause - Space)";

    updateHeaderAndCalculatorUI();
    renderMaster75Board();
    updateArenaLiveCircles();

    speakAmharicCall(
      "status_game_start.mp3",
      Core.AMHARIC_STATUS_CALLS.GAME_START.amharicText,
      "win"
    );

    scheduleNextCall();
  }

  function pauseGame(silent) {
    state.isPaused = true;
    const btn = document.getElementById("pauseResumeBtn");
    if (btn) btn.textContent = "▶️ ጨዋታ ቀጥል (Resume - Space)";
    if (!silent) {
      speakAmharicCall(
        "status_game_paused.mp3",
        Core.AMHARIC_STATUS_CALLS.GAME_PAUSED.amharicText,
        "ball"
      );
    }
  }

  function resumeGame() {
    if (!state.isGameActive) return;
    state.isPaused = false;
    const btn = document.getElementById("pauseResumeBtn");
    if (btn) btn.textContent = "⏸️ ጨዋታ አቁም (Pause - Space)";
  }

  // Smart Win Verifier & Inspect Modal (ተራ ቁጥር 7)
  function openVerifierModal(cartelaId, mode) {
    const id = Number(cartelaId);
    if (!Number.isInteger(id) || id < 1 || id > 500) {
      alert("እባክዎ ከ 1 እስከ 500 ያለ ትክክለኛ የካርቴላ ቁጥር ያስገቡ!");
      return;
    }
    if (state.isGameActive && !state.isPaused) {
      pauseGame(true);
    }

    state.lastInspectedCartelaId = id;
    const cartela = Core.generateCartelaById(id);
    const result = Core.verifyCartelaWin(
      cartela,
      state.calledHistory,
      state.selectedPatternId
    );
    const isBooked = state.selectedCartelas.has(id);
    const isAlreadyLocked = state.lockedCartelas.has(id);
    const fin = getFinancialSummary();
    const pat =
      Core.WINNING_PATTERNS.find((p) => p.id === state.selectedPatternId) ||
      Core.WINNING_PATTERNS[0];

    document.getElementById("modalCartelaNumber").textContent = `#${id}`;
    document.getElementById("modalPrizeAmountText").textContent =
      `${fin.netPrize.toLocaleString()} ብር`;
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
        banner.textContent = `🔒 ካርቴላ #${id} ቀድሞውኑ ታስሯል (Disqualified)!`;
        unlockBtn.style.display = "block";
      } else if (result.isWinner) {
        banner.className = "verifier-status-banner win";
        banner.textContent = `🎉 ካርቴላ #${id} አሸንፏል! ደራሽ ሂሳብ፦ ${fin.netPrize.toLocaleString()} ብር!`;
        unlockBtn.style.display = "none";
        speakAmharicCall(
          "status_cartela_won.mp3",
          Core.AMHARIC_STATUS_CALLS.CARTELA_WON.amharicText,
          "win"
        );
      } else {
        // Auto-lock disqualified cartela!
        state.lockedCartelas.add(id);
        updateHeaderAndCalculatorUI();
        banner.className = "verifier-status-banner locked";
        banner.textContent = `❌ አልዘጋም! ካርቴላ #${id} በዚህ ዙር ታስሯል (Locked)!`;
        unlockBtn.style.display = "block";
        speakAmharicCall(
          "status_cartela_locked.mp3",
          Core.AMHARIC_STATUS_CALLS.CARTELA_LOCKED.amharicText,
          "lock"
        );
      }
    } else {
      // INSPECT ONLY MODE (Does NOT lock the cartela)
      banner.className = "verifier-status-banner inspect";
      banner.textContent = `🔍 የቁጥር ማረጋገጫ ብቻ (Inspect Only) — ካርቴላ #${id} አልታሰረም`;
      unlockBtn.style.display = state.lockedCartelas.has(id) ? "block" : "none";
    }

    lockBadge.textContent = state.lockedCartelas.has(id)
      ? "🔒 የታሰረ (Locked)"
      : "🟢 ንቁ (Active)";

    // Render 5x5 Cartela Numbers with Hit & Win-Line Highlights
    const gridEl = document.getElementById("modalCartela5x5Grid");
    gridEl.innerHTML = "";
    const hitSet = new Set(result.allHitCells.map(([r, c]) => `${r},${c}`));
    const winSet = new Set(result.winningCells.map(([r, c]) => `${r},${c}`));

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const cell = document.createElement("div");
        cell.className = "cartela-cell";
        const val = cartela.grid[r][c];
        cell.textContent = val === 0 ? "ነፃ" : val;
        const key = `${r},${c}`;
        if (hitSet.has(key)) cell.classList.add("hit");
        if (winSet.has(key) && result.isWinner) cell.classList.add("win-line");
        gridEl.appendChild(cell);
      }
    }

    document.getElementById("verifierModal").classList.add("open");
  }

  // Wallet Top-Up Modal (ተራ ቁጥር 8)
  function openWalletModal() {
    document.getElementById("modalMachineUserId").textContent = state.userId;
    document.getElementById("modalSequenceNumber").textContent =
      state.sequenceNumber;
    document.getElementById("modalCurrentWallet").textContent =
      `${state.walletTokens.toLocaleString()} Tokens`;
    document.getElementById("hallNameInput").value = state.hallName;
    document.getElementById("cityNameInput").value = state.cityName;
    document.getElementById("remoteLedgerUrlInput").value =
      state.remoteLedgerUrl;
    document.getElementById("walletTopUpFeedback").textContent = "";
    document.getElementById("walletModal").classList.add("open");
  }

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
      const ledgerData = await res.json();
      const entries = Array.isArray(ledgerData.credits)
        ? ledgerData.credits
        : [];
      const matching = entries.find(
        (item) =>
          String(item.userId).toUpperCase() === state.userId &&
          Number(item.sequenceNumber) === state.sequenceNumber
      );

      if (!matching) {
        feedback.style.color = "#ef4444";
        feedback.textContent = `ለUser ID (${state.userId}) በSequence #${state.sequenceNumber} የተላከ አዲስ ቶከን አልተገኘም።`;
        return;
      }

      const verifyRes = Core.verifyOffline16DigitKey(
        matching.signedKey,
        state.userId,
        state.sequenceNumber
      );
      if (!verifyRes.valid) {
        feedback.style.color = "#ef4444";
        feedback.textContent = verifyRes.reasonAm;
        return;
      }

      state.walletTokens += verifyRes.amountTokens;
      state.sequenceNumber = verifyRes.newSequenceNumber;
      await persistState();
      updateHeaderAndCalculatorUI();
      openWalletModal();
      feedback.style.color = "#22c55e";
      feedback.textContent = verifyRes.messageAm;
      playCasinoChime("win");
    } catch (err) {
      feedback.style.color = "#ef4444";
      feedback.textContent =
        "ኢንተርኔት አልተገኘም ወይም የLedger URL አልተከፈተም! እባክዎ የ16-ፊደል Offline ኮድ ይጠቀሙ።";
    }
  }

  async function handleOfflineKeyTopUp() {
    const keyInput = document.getElementById("offlineKeyInput").value.trim();
    const feedback = document.getElementById("walletTopUpFeedback");
    const verifyRes = Core.verifyOffline16DigitKey(
      keyInput,
      state.userId,
      state.sequenceNumber
    );
    if (!verifyRes.valid) {
      feedback.style.color = "#ef4444";
      feedback.textContent = verifyRes.reasonAm;
      playCasinoChime("lock");
      return;
    }

    state.walletTokens += verifyRes.amountTokens;
    state.sequenceNumber = verifyRes.newSequenceNumber;
    document.getElementById("offlineKeyInput").value = "";
    await persistState();
    updateHeaderAndCalculatorUI();
    openWalletModal();
    feedback.style.color = "#22c55e";
    feedback.textContent = verifyRes.messageAm;
    playCasinoChime("win");
  }

  // Initialize UI & Event Listeners
  async function initApp() {
    await loadSavedState();

    // Populate 18 Winning Patterns Dropdown
    const patSelect = document.getElementById("winningPatternSelect");
    Core.WINNING_PATTERNS.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.order}. ${p.titleAm} (${p.titleEn})`;
      if (p.id === state.selectedPatternId) opt.selected = true;
      patSelect.appendChild(opt);
    });

    patSelect.addEventListener("change", (e) => {
      state.selectedPatternId = e.target.value;
      updateHeaderAndCalculatorUI();
    });

    // Stake Presets & Custom Input
    document.querySelectorAll(".stake-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".stake-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.stakePerCartela = Number(btn.dataset.stake);
        document.getElementById("customStakeInput").value =
          state.stakePerCartela;
        persistState();
        updateHeaderAndCalculatorUI();
      });
    });

    document
      .getElementById("customStakeInput")
      .addEventListener("input", (e) => {
        const val = Number(e.target.value);
        if (val > 0) {
          state.stakePerCartela = val;
          updateHeaderAndCalculatorUI();
        }
      });

    // Quick Add Cartela Input
    const quickInput = document.getElementById("quickCartelaInput");
    const triggerQuickAdd = () => {
      const id = Number(quickInput.value);
      if (Number.isInteger(id) && id >= 1 && id <= 500) {
        if (state.selectedCartelas.has(id)) {
          state.selectedCartelas.delete(id);
        } else {
          state.selectedCartelas.add(id);
        }
        quickInput.value = "";
        render500CartelaGrid();
        updateHeaderAndCalculatorUI();
      }
    };
    document
      .getElementById("quickAddBtn")
      .addEventListener("click", triggerQuickAdd);
    quickInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") triggerQuickAdd();
    });

    // Swap Cartela Button
    document.getElementById("swapCartelaBtn").addEventListener("click", () => {
      const fromId = Number(document.getElementById("swapFromInput").value);
      const toId = Number(document.getElementById("swapToInput").value);
      if (
        Number.isInteger(fromId) &&
        Number.isInteger(toId) &&
        fromId >= 1 &&
        fromId <= 500 &&
        toId >= 1 &&
        toId <= 500
      ) {
        state.selectedCartelas.delete(fromId);
        state.selectedCartelas.add(toId);
        document.getElementById("swapFromInput").value = "";
        document.getElementById("swapToInput").value = "";
        render500CartelaGrid();
        updateHeaderAndCalculatorUI();
      }
    });

    // Range Filter Tabs
    document.querySelectorAll("#cartelaRangeTabs .tab-btn").forEach((tab) => {
      tab.addEventListener("click", () => {
        document
          .querySelectorAll("#cartelaRangeTabs .tab-btn")
          .forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        state.currentRangeFilter = tab.dataset.range;
        render500CartelaGrid();
      });
    });

    // Clear & Start Game Buttons
    document
      .getElementById("clearAllSelectedBtn")
      .addEventListener("click", () => {
        state.selectedCartelas.clear();
        render500CartelaGrid();
        updateHeaderAndCalculatorUI();
      });

    document
      .getElementById("startGameBtn")
      .addEventListener("click", startNewGameRound);

    // Arena Controls
    document.getElementById("pauseResumeBtn").addEventListener("click", () => {
      if (state.isPaused) resumeGame();
      else pauseGame(false);
    });

    document.getElementById("replayVoiceBtn").addEventListener("click", () => {
      if (state.calledHistory.length > 0) {
        const last = state.calledHistory[state.calledHistory.length - 1];
        const callInfo = Core.AMHARIC_BALL_CALLS[last];
        speakAmharicCall(`ball_${last}.mp3`, callInfo.amharicText, "ball");
      }
    });

    document
      .getElementById("callSpeedSlider")
      .addEventListener("input", (e) => {
        state.callIntervalSeconds = Number(e.target.value);
        document.getElementById("speedValueLabel").textContent =
          `${state.callIntervalSeconds.toFixed(1)} ሰከንድ`;
        if (state.isGameActive) scheduleNextCall();
      });

    document
      .getElementById("voiceGenderSelect")
      .addEventListener("change", (e) => {
        state.voiceGender = e.target.value;
      });

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

    document
      .getElementById("verifyCartelaInput")
      .addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          openVerifierModal(Number(e.target.value), "VERIFY");
        }
      });

    document
      .getElementById("closeVerifierModalBtn")
      .addEventListener("click", () => {
        document.getElementById("verifierModal").classList.remove("open");
      });

    document.getElementById("unlockCartelaBtn").addEventListener("click", () => {
      if (state.lastInspectedCartelaId) {
        state.lockedCartelas.delete(state.lastInspectedCartelaId);
        updateHeaderAndCalculatorUI();
        openVerifierModal(state.lastInspectedCartelaId, "INSPECT");
      }
    });

    document
      .getElementById("resumeAfterVerifyBtn")
      .addEventListener("click", () => {
        document.getElementById("verifierModal").classList.remove("open");
        resumeGame();
      });

    document
      .getElementById("newRoundAfterWinBtn")
      .addEventListener("click", () => {
        document.getElementById("verifierModal").classList.remove("open");
        if (state.callTimerId) clearInterval(state.callTimerId);
        state.isGameActive = false;
        document.getElementById("arenaView").classList.remove("active-view");
        document.getElementById("setupView").classList.add("active-view");
      });

    // Keyboard shortcut: Spacebar pauses/resumes during live game
    window.addEventListener("keydown", (e) => {
      if (
        state.isGameActive &&
        e.code === "Space" &&
        document.activeElement.tagName !== "INPUT"
      ) {
        e.preventDefault();
        if (state.isPaused) resumeGame();
        else pauseGame(false);
      }
    });

    // Wallet & Settings Modals
    document.getElementById("walletToggleBtn").addEventListener("click", () => {
      state.walletMasked = !state.walletMasked;
      updateHeaderAndCalculatorUI();
    });

    document
      .getElementById("openWalletModalBtn")
      .addEventListener("click", openWalletModal);
    document
      .getElementById("closeWalletModalBtn")
      .addEventListener("click", () => {
        document.getElementById("walletModal").classList.remove("open");
      });

    document
      .getElementById("saveHallIdentityBtn")
      .addEventListener("click", async () => {
        state.hallName =
          document.getElementById("hallNameInput").value.trim() ||
          "Royal Bingo Hall";
        state.cityName =
          document.getElementById("cityNameInput").value.trim() || "ETH";
        state.userId = Core.generateMachineUserId(
          state.cityName,
          state.hallName,
          state.hardwareId
        );
        await persistState();
        updateHeaderAndCalculatorUI();
        openWalletModal();
      });

    document
      .getElementById("onlineAutoTopUpBtn")
      .addEventListener("click", handleOnlineAutoTopUp);
    document
      .getElementById("applyOfflineKeyBtn")
      .addEventListener("click", handleOfflineKeyTopUp);

    document
      .getElementById("openSettingsModalBtn")
      .addEventListener("click", () => {
        document.getElementById("commissionPercentInput").value =
          state.commissionPercent;
        document.getElementById("settingsModal").classList.add("open");
      });
    document
      .getElementById("closeSettingsModalBtn")
      .addEventListener("click", () => {
        document.getElementById("settingsModal").classList.remove("open");
      });
    document
      .getElementById("saveSettingsBtn")
      .addEventListener("click", async () => {
        const val = Number(
          document.getElementById("commissionPercentInput").value
        );
        if (val >= 5 && val <= 50) {
          state.commissionPercent = val;
          await persistState();
          updateHeaderAndCalculatorUI();
        }
        document.getElementById("settingsModal").classList.remove("open");
      });

    document.getElementById("fullscreenBtn").addEventListener("click", () => {
      if (window.RoyalDesktopBridge && window.RoyalDesktopBridge.toggleFullscreen) {
        window.RoyalDesktopBridge.toggleFullscreen();
      } else if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    render500CartelaGrid();
    updateHeaderAndCalculatorUI();
  }

  window.addEventListener("DOMContentLoaded", initApp);
})();
