/**
 * ============================================================================
 * ሮያል ቢንጎ ፕሮ (Royal Bingo Pro 500) — Mobile App Controller v2.0
 * Implements:
 *   - Pure Manual Win Verification (Never triggers auto win on daub!)
 *   - Custom Stake Amount Input & Live Player Pool Calculator
 *   - Free Center Display (English "Free")
 *   - Collapsible Daily Player Rounds Audit Log (Add/Clear)
 *   - 27-Tap Secret Admin Mode with Full Encrypted Customer CRM & Remote PIN Reset
 * ============================================================================
 */
(function () {
  "use strict";

  const Core = window.RoyalBingoCore;

  const mobileState = {
    mode: 1, // 1 or 2 cartelas
    cartela1Id: 1,
    cartela2Id: 2,
    patternId: "PATTERN_ANY_1_LINE",
    stake: 30,
    playerCount: 20,
    daubed1: new Set([0]), // 0 = Free
    daubed2: new Set([0]),
    logoTapCount: 0,
    lastTapTimestamp: 0,
    auditRounds: [],
    crmClients: []
  };

  function speakBingoAlert(amharicPhrase) {
    try {
      const audio = new Audio("voices/female/status_cartela_won.mp3");
      audio.play().catch(() => {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(amharicPhrase);
          u.lang = "am-ET";
          window.speechSynthesis.speak(u);
        }
      });
    } catch (_e) {}
  }

  function updatePlayerFinancialStrip() {
    const gross = mobileState.stake * mobileState.playerCount;
    const houseCut = Math.round(gross * 0.25);
    const netPrize = gross - houseCut;

    document.getElementById("mPlayerGrossDisplay").textContent = `${gross.toLocaleString()} ብር`;
    document.getElementById("mPlayerCutDisplay").textContent = `${houseCut.toLocaleString()} ብር`;
    document.getElementById("mPlayerNetDisplay").textContent = `${netPrize.toLocaleString()} ብር`;
  }

  function renderMobileCartela(cardIndex) {
    const id = cardIndex === 1 ? mobileState.cartela1Id : mobileState.cartela2Id;
    const daubSet = cardIndex === 1 ? mobileState.daubed1 : mobileState.daubed2;
    const gridEl = document.getElementById(cardIndex === 1 ? "mobileGrid1" : "mobileGrid2");
    const titleEl = document.getElementById(cardIndex === 1 ? "card1TitleNum" : "card2TitleNum");
    const sigEl = document.getElementById(cardIndex === 1 ? "card1Sig" : "card2Sig");

    const cartela = Core.generateCartelaById(id);
    titleEl.textContent = `#${id}`;
    sigEl.textContent = `ID-${cartela.signature}`;
    gridEl.innerHTML = "";

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const val = cartela.grid[r][c];
        const cell = document.createElement("div");
        cell.className = "m-cell";
        cell.textContent = val === 0 ? "Free" : val;

        if (val === 0 || daubSet.has(val)) {
          cell.classList.add("daubed");
        }

        cell.addEventListener("click", () => {
          if (val === 0) return; // Center Free stays active
          if (daubSet.has(val)) {
            daubSet.delete(val);
          } else {
            daubSet.add(val);
          }
          // Do NOT check or show automatic win here! Only update daub visually.
          renderMobileCartela(cardIndex);
        });

        gridEl.appendChild(cell);
      }
    }
  }

  /**
   * Manual Win Verification ONLY (Triggered ONLY when user explicitly taps 'ዝግህን አረጋግጥ')
   */
  function manualVerifyCartela(cardIndex) {
    const id = cardIndex === 1 ? mobileState.cartela1Id : mobileState.cartela2Id;
    const daubSet = cardIndex === 1 ? mobileState.daubed1 : mobileState.daubed2;
    const banner = document.getElementById("mobileWinAlertBanner");

    const res = Core.verifyCartelaWin(id, Array.from(daubSet), mobileState.patternId, false);

    if (res.isWinner) {
      banner.style.display = "block";
      banner.className = "m-win-banner";
      banner.textContent = `🎉 ቢንጎ! ካርቴላ #${id} ዘግቷል! ለአጫዋቹ ቁጥር #${id}ን ያሳውቁ!`;
      speakBingoAlert("ቢንጎ! ይህ ካርቴላ አሸንፏል!");

      // Highlight winning cells on cartela
      const gridEl = document.getElementById(cardIndex === 1 ? "mobileGrid1" : "mobileGrid2");
      const winSet = new Set(res.winningCells.map(([r, c]) => `${r},${c}`));
      const cells = gridEl.children;
      for (let i = 0; i < cells.length; i++) {
        const r = Math.floor(i / 5);
        const c = i % 5;
        if (winSet.has(`${r},${c}`)) cells[i].classList.add("win-cell");
      }

      // Record in player round audit log
      const gross = mobileState.stake * mobileState.playerCount;
      const houseCut = Math.round(gross * 0.25);
      const netPrize = gross - houseCut;
      mobileState.auditRounds.unshift({
        round: mobileState.auditRounds.length + 1,
        players: mobileState.playerCount,
        stake: mobileState.stake,
        gross: gross,
        houseCut: houseCut,
        netPrize: netPrize,
        status: `አሸነፈ (ካርቴላ #${id})`
      });
      renderAuditTable();
    } else {
      banner.style.display = "block";
      banner.className = "m-win-banner not-yet";
      banner.textContent = `⚠️ ካርቴላ #${id} የተመረጠውን የዝግ አይነት ገና አልሞላም!`;
    }
  }

  function resetAllDaubs() {
    mobileState.daubed1 = new Set([0]);
    mobileState.daubed2 = new Set([0]);
    document.getElementById("mobileWinAlertBanner").style.display = "none";
    renderMobileCartela(1);
    if (mobileState.mode === 2) renderMobileCartela(2);
  }

  function renderAuditTable() {
    const tbody = document.getElementById("mAuditTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (mobileState.auditRounds.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="padding:6px; color:#94a3b8;">ምንም የተመዘገበ ዙር የለም</td></tr>`;
      return;
    }
    mobileState.auditRounds.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>#${r.round}</td>
        <td>${r.players}</td>
        <td>${r.stake} ብር</td>
        <td>${r.gross.toLocaleString()}</td>
        <td style="color:#22c55e;">${r.houseCut.toLocaleString()}</td>
        <td style="color:#facc15;">${r.netPrize.toLocaleString()}</td>
        <td><strong>${r.status}</strong></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // --------------------------------------------------------------------------
  // 27-TAP SECRET ADMIN TRIGGER & CRM LOGIC
  // --------------------------------------------------------------------------
  function handleSecretLogoTap() {
    const now = Date.now();
    if (now - mobileState.lastTapTimestamp > 4000) mobileState.logoTapCount = 0;
    mobileState.lastTapTimestamp = now;
    mobileState.logoTapCount += 1;

    const hintEl = document.getElementById("tapCounterHint");
    if (mobileState.logoTapCount >= 20 && mobileState.logoTapCount < 27) {
      hintEl.textContent = `የአድሚን ገጽ፦ ${27 - mobileState.logoTapCount} ጊዜ ይቀራል...`;
    } else if (mobileState.logoTapCount >= 27) {
      mobileState.logoTapCount = 0;
      hintEl.textContent = "የተጫዋች ዲጂታል ካርቴላ";
      document.getElementById("adminPinInput").value = "";
      document.getElementById("adminPinModal").classList.add("open");
    }
  }

  function loadCrmClients() {
    try {
      const raw = localStorage.getItem("ROYAL_BINGO_CRM_CLIENTS");
      if (raw) mobileState.crmClients = JSON.parse(raw);
    } catch (_e) {}
    renderCrmClientList();
  }

  function saveCrmClients() {
    localStorage.setItem("ROYAL_BINGO_CRM_CLIENTS", JSON.stringify(mobileState.crmClients));
    renderCrmClientList();
  }

  function renderCrmClientList() {
    const container = document.getElementById("crmClientListContainer");
    if (!container) return;
    container.innerHTML = "";
    if (mobileState.crmClients.length === 0) {
      container.innerHTML = `<p class="m-muted" style="text-align:center; margin-top:8px;">ምንም የተመዘገበ ደንበኛ የለም።</p>`;
      return;
    }
    mobileState.crmClients.forEach((client, idx) => {
      const card = document.createElement("div");
      card.className = "crm-client-card";
      card.innerHTML = `
        <strong>${client.name} (${client.hall})</strong>
        <div>User ID፦ <code>${client.userId}</code> | ስልክ፦ ${client.phone}</div>
        <div style="margin-top:4px;">
          <button class="m-btn m-btn-gold m-btn-sm" data-action="fillKeygen" data-idx="${idx}">⚡ ዋሌት ሙላለት</button>
          <button class="m-btn m-btn-outline m-btn-sm" data-action="fillReset" data-idx="${idx}">🔑 Reset PIN</button>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll("button[data-action='fillKeygen']").forEach((b) => {
      b.onclick = () => {
        const c = mobileState.crmClients[Number(b.dataset.idx)];
        document.getElementById("adminBuyerUserId").value = c.userId;
        document.getElementById("tabKeygenBtn").click();
      };
    });
    container.querySelectorAll("button[data-action='fillReset']").forEach((b) => {
      b.onclick = () => {
        const c = mobileState.crmClients[Number(b.dataset.idx)];
        document.getElementById("pinResetUidInput").value = c.userId;
        document.getElementById("tabPinResetBtn").click();
      };
    });
  }

  // --------------------------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------------------------
  function initMobileApp() {
    // Populate Patterns
    const patSel = document.getElementById("mobilePatternSelect");
    Core.WINNING_PATTERNS.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.order}. ${p.titleAm}`;
      patSel.appendChild(opt);
    });

    patSel.addEventListener("change", (e) => {
      mobileState.patternId = e.target.value;
      renderMobileCartela(1);
      if (mobileState.mode === 2) renderMobileCartela(2);
    });

    // View Mode
    document.getElementById("cartelaModeSelect").addEventListener("change", (e) => {
      mobileState.mode = Number(e.target.value);
      const f2 = document.getElementById("mobileCartela2Field");
      const c2 = document.getElementById("mobileCard2");
      if (mobileState.mode === 2) {
        document.body.classList.add("mode-dual");
        f2.style.display = "flex";
        c2.style.display = "flex";
        renderMobileCartela(2);
      } else {
        document.body.classList.remove("mode-dual");
        f2.style.display = "none";
        c2.style.display = "none";
      }
    });

    // Cartela Inputs
    document.getElementById("mobileCartela1Input").addEventListener("input", (e) => {
      const v = Number(e.target.value);
      if (Number.isInteger(v) && v >= 1 && v <= 500) {
        mobileState.cartela1Id = v;
        mobileState.daubed1 = new Set([0]);
        renderMobileCartela(1);
      }
    });

    document.getElementById("mobileCartela2Input").addEventListener("input", (e) => {
      const v = Number(e.target.value);
      if (Number.isInteger(v) && v >= 1 && v <= 500) {
        mobileState.cartela2Id = v;
        mobileState.daubed2 = new Set([0]);
        renderMobileCartela(2);
      }
    });

    // Stake Selection (with Custom option)
    const stakeSel = document.getElementById("mobileStakeSelect");
    const customStakeInput = document.getElementById("mobileCustomStakeInput");

    stakeSel.addEventListener("change", (e) => {
      if (e.target.value === "custom") {
        customStakeInput.style.display = "block";
        customStakeInput.focus();
        mobileState.stake = Number(customStakeInput.value) || 30;
      } else {
        customStakeInput.style.display = "none";
        mobileState.stake = Number(e.target.value);
      }
      updatePlayerFinancialStrip();
    });

    customStakeInput.addEventListener("input", (e) => {
      const val = Number(e.target.value);
      if (val > 0) {
        mobileState.stake = val;
        updatePlayerFinancialStrip();
      }
    });

    // Player Count Input
    document.getElementById("mobilePlayerCountInput").addEventListener("input", (e) => {
      const val = Number(e.target.value);
      if (val > 0) {
        mobileState.playerCount = val;
        updatePlayerFinancialStrip();
      }
    });

    // Buttons
    document.getElementById("resetBoardBtn").addEventListener("click", resetAllDaubs);

    document.querySelectorAll(".m-verify-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cardIdx = Number(btn.dataset.card);
        manualVerifyCartela(cardIdx);
      });
    });

    // Collapsible Audit Table
    document.getElementById("toggleMobileAuditBtn").addEventListener("click", () => {
      const content = document.getElementById("mobileAuditContent");
      const arrow = document.getElementById("mAuditArrow");
      if (content.style.display === "none") {
        content.style.display = "block";
        arrow.textContent = "▲";
      } else {
        content.style.display = "none";
        arrow.textContent = "▼";
      }
    });

    document.getElementById("mClearAuditBtn").addEventListener("click", () => {
      if (confirm("የጨዋታ ዙሮች ሪፖርቱን ማጽዳት ይፈልጋሉ?")) {
        mobileState.auditRounds = [];
        renderAuditTable();
      }
    });

    // 27-Tap Secret Trigger
    document.getElementById("secretAdminLogoTrigger").addEventListener("click", handleSecretLogoTap);

    document.getElementById("cancelAdminPinBtn").addEventListener("click", () => {
      document.getElementById("adminPinModal").classList.remove("open");
    });

    document.getElementById("unlockAdminBtn").addEventListener("click", () => {
      const pin = document.getElementById("adminPinInput").value.trim();
      if (pin === Core.CONFIG.ADMIN_SECRET_PIN || pin === Core.CONFIG.ADMIN_MASTER_SECRET) {
        document.getElementById("adminPinModal").classList.remove("open");
        document.getElementById("adminGeneratorModal").classList.add("open");
        loadCrmClients();
      } else {
        alert("የተሳሳተ Master PIN!");
      }
    });

    document.getElementById("closeAdminGenBtn").addEventListener("click", () => {
      document.getElementById("adminGeneratorModal").classList.remove("open");
    });

    // Admin Tabs
    document.getElementById("tabKeygenBtn").addEventListener("click", () => {
      document.querySelectorAll(".m-tab-btn").forEach((b) => b.classList.remove("active"));
      document.getElementById("tabKeygenBtn").classList.add("active");
      document.getElementById("adminTabKeygen").style.display = "block";
      document.getElementById("adminTabCrm").style.display = "none";
      document.getElementById("adminTabPinReset").style.display = "none";
    });

    document.getElementById("tabCrmBtn").addEventListener("click", () => {
      document.querySelectorAll(".m-tab-btn").forEach((b) => b.classList.remove("active"));
      document.getElementById("tabCrmBtn").classList.add("active");
      document.getElementById("adminTabKeygen").style.display = "none";
      document.getElementById("adminTabCrm").style.display = "block";
      document.getElementById("adminTabPinReset").style.display = "none";
    });

    document.getElementById("tabPinResetBtn").addEventListener("click", () => {
      document.querySelectorAll(".m-tab-btn").forEach((b) => b.classList.remove("active"));
      document.getElementById("tabPinResetBtn").classList.add("active");
      document.getElementById("adminTabKeygen").style.display = "none";
      document.getElementById("adminTabCrm").style.display = "none";
      document.getElementById("adminTabPinReset").style.display = "block";
    });

    // Keygen
    document.getElementById("adminTokenPreset").addEventListener("change", (e) => {
      document.getElementById("adminCustomTokens").value = e.target.value;
    });

    document.getElementById("generateSignedKeyBtn").addEventListener("click", () => {
      const uid = document.getElementById("adminBuyerUserId").value.trim();
      const seq = Number(document.getElementById("adminBuyerSeq").value);
      const tokens = Number(document.getElementById("adminCustomTokens").value);

      try {
        const entry = Core.generateRemoteLedgerEntry(uid, seq, tokens, "Issued via Owner Mobile APK Admin Mode");
        document.getElementById("generated16KeyDisplay").textContent = entry.signedKey;
        document.getElementById("generatedJsonSnippet").textContent = JSON.stringify(entry, null, 2);
        document.getElementById("adminGeneratedOutput").style.display = "block";
      } catch (err) {
        alert(err.message);
      }
    });

    document.getElementById("copySmsKeyBtn").addEventListener("click", () => {
      const key = document.getElementById("generated16KeyDisplay").textContent;
      navigator.clipboard.writeText(key).catch(() => {});
      alert(`ኮዱ ኮፒ ተደርጓል፦ ${key}`);
    });

    document.getElementById("copyJsonSnippetBtn").addEventListener("click", () => {
      const jsonTxt = document.getElementById("generatedJsonSnippet").textContent;
      navigator.clipboard.writeText(jsonTxt).catch(() => {});
      alert("JSON ኮፒ ተደርጓል!");
    });

    // Save CRM Client
    document.getElementById("saveCrmClientBtn").addEventListener("click", () => {
      const name = document.getElementById("crmClientName").value.trim();
      const hall = document.getElementById("crmClientHall").value.trim();
      const phone = document.getElementById("crmClientPhone").value.trim();
      const uid = document.getElementById("crmClientUid").value.trim();

      if (!name || !uid) {
        alert("እባክዎ የደንበኛውን ስምና User ID ያስገቡ!");
        return;
      }

      mobileState.crmClients.unshift({ name, hall, phone, userId: uid });
      saveCrmClients();
      document.getElementById("crmClientName").value = "";
      document.getElementById("crmClientHall").value = "";
      document.getElementById("crmClientPhone").value = "";
      document.getElementById("crmClientUid").value = "";
      alert("ደንበኛው በመዝገብ ላይ ተቀምጧል!");
    });

    // Pin Reset Token
    document.getElementById("generatePinResetTokenBtn").addEventListener("click", () => {
      const uid = document.getElementById("pinResetUidInput").value.trim();
      if (!uid) {
        alert("እባክዎ የገዢውን User ID ያስገቡ!");
        return;
      }
      const token = Core.generatePinResetToken(uid);
      document.getElementById("pinResetTokenDisplay").textContent = token;
      document.getElementById("pinResetTokenOutput").style.display = "block";
    });

    document.getElementById("copyPinResetBtn").addEventListener("click", () => {
      const token = document.getElementById("pinResetTokenDisplay").textContent;
      navigator.clipboard.writeText(token).catch(() => {});
      alert(`የReset ኮድ ኮፒ ተደርጓል፦ ${token}`);
    });

    renderMobileCartela(1);
    updatePlayerFinancialStrip();
    renderAuditTable();
  }

  window.addEventListener("DOMContentLoaded", initMobileApp);
})();
