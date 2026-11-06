/**
 * ============================================================================
 * ሮያል ቢንጎ ፕሮ (Royal Bingo Pro 500) — Mobile `.APK` Player & Secret Admin App
 * Implements Item 9:
 *  - 100% Identical 500 Cartelas as Desktop `.EXE`
 *  - Single or Split-Screen Dual Cartela Mode (1 or 2 Cartelas simultaneously)
 *  - Golden Daub toggle, Automatic "ቢንጎ!" voice call & self-verification
 *  - 27-Tap Secret Owner Admin Token Generator Mode (works 100% offline on phone)
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
    daubed1: new Set([0]), // 0 = center FREE space always daubed
    daubed2: new Set([0]),
    logoTapCount: 0,
    lastTapTimestamp: 0
  };

  function speakBingoAlert(amharicPhrase) {
    try {
      const audio = new Audio("voices/status_cartela_won.mp3");
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

  function renderMobileCartela(cardIndex) {
    const id = cardIndex === 1 ? mobileState.cartela1Id : mobileState.cartela2Id;
    const daubSet = cardIndex === 1 ? mobileState.daubed1 : mobileState.daubed2;
    const gridEl = document.getElementById(
      cardIndex === 1 ? "mobileGrid1" : "mobileGrid2"
    );
    const titleEl = document.getElementById(
      cardIndex === 1 ? "card1TitleNum" : "card2TitleNum"
    );
    const sigEl = document.getElementById(
      cardIndex === 1 ? "card1Sig" : "card2Sig"
    );

    const cartela = Core.generateCartelaById(id);
    titleEl.textContent = `#${id}`;
    sigEl.textContent = `ID-${cartela.signature}`;
    gridEl.innerHTML = "";

    const evalRes = Core.verifyCartelaWin(
      cartela,
      Array.from(daubSet),
      mobileState.patternId
    );
    const winCellKeys = new Set(
      evalRes.winningCells.map(([r, c]) => `${r},${c}`)
    );

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const val = cartela.grid[r][c];
        const cell = document.createElement("div");
        cell.className = "m-cell";
        cell.textContent = val === 0 ? "ነፃ" : val;

        if (val === 0 || daubSet.has(val)) {
          cell.classList.add("daubed");
        }
        if (evalRes.isWinner && winCellKeys.has(`${r},${c}`)) {
          cell.classList.add("win-cell");
        }

        cell.addEventListener("click", () => {
          if (val === 0) return; // Center FREE space stays active
          if (daubSet.has(val)) {
            daubSet.delete(val);
          } else {
            daubSet.add(val);
          }
          renderMobileCartela(cardIndex);
          checkAutoBingoAnnouncement(cardIndex);
        });

        gridEl.appendChild(cell);
      }
    }
  }

  function checkAutoBingoAnnouncement(cardIndex, explicitCheck) {
    const id = cardIndex === 1 ? mobileState.cartela1Id : mobileState.cartela2Id;
    const daubSet = cardIndex === 1 ? mobileState.daubed1 : mobileState.daubed2;
    const res = Core.verifyCartelaWin(
      id,
      Array.from(daubSet),
      mobileState.patternId
    );
    const banner = document.getElementById("mobileWinAlertBanner");

    if (res.isWinner) {
      banner.style.display = "block";
      banner.className = "m-win-banner";
      banner.textContent = `🎉 ቢንጎ! ካርቴላ #${id} ዘግቷል! ለአጫዋቹ ቁጥር #${id}ን ያሳውቁ!`;
      speakBingoAlert("ቢንጎ! ይህ ካርቴላ አሸንፏል!");
    } else if (explicitCheck) {
      banner.style.display = "block";
      banner.className = "m-win-banner not-yet";
      banner.textContent = `⚠️ ካርቴላ #${id} የተመረጠውን ዝግ ገና አልሞላም!`;
    } else {
      banner.style.display = "none";
    }
  }

  function resetAllDaubs() {
    mobileState.daubed1 = new Set([0]);
    mobileState.daubed2 = new Set([0]);
    document.getElementById("mobileWinAlertBanner").style.display = "none";
    renderMobileCartela(1);
    if (mobileState.mode === 2) renderMobileCartela(2);
  }

  // 27-Tap Secret Admin Mode Handler
  function handleSecretLogoTap() {
    const now = Date.now();
    if (now - mobileState.lastTapTimestamp > 4000) {
      mobileState.logoTapCount = 0;
    }
    mobileState.lastTapTimestamp = now;
    mobileState.logoTapCount += 1;

    const hintEl = document.getElementById("tapCounterHint");
    if (mobileState.logoTapCount >= 20 && mobileState.logoTapCount < 27) {
      hintEl.textContent = `Admin Mode: ${27 - mobileState.logoTapCount} ጊዜ ይቀራል...`;
    } else if (mobileState.logoTapCount >= 27) {
      mobileState.logoTapCount = 0;
      hintEl.textContent = "100% Offline Digital Cartela";
      document.getElementById("adminPinInput").value = "";
      document.getElementById("adminPinModal").classList.add("open");
    }
  }

  function initMobileApp() {
    // Populate 18 Winning Patterns
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

    document
      .getElementById("cartelaModeSelect")
      .addEventListener("change", (e) => {
        mobileState.mode = Number(e.target.value);
        const f2 = document.getElementById("mobileCartela2Field");
        const c2 = document.getElementById("mobileCard2");
        if (mobileState.mode === 2) {
          f2.style.display = "flex";
          c2.style.display = "block";
          renderMobileCartela(2);
        } else {
          f2.style.display = "none";
          c2.style.display = "none";
        }
      });

    document
      .getElementById("mobileCartela1Input")
      .addEventListener("input", (e) => {
        const v = Number(e.target.value);
        if (Number.isInteger(v) && v >= 1 && v <= 500) {
          mobileState.cartela1Id = v;
          mobileState.daubed1 = new Set([0]);
          renderMobileCartela(1);
        }
      });

    document
      .getElementById("mobileCartela2Input")
      .addEventListener("input", (e) => {
        const v = Number(e.target.value);
        if (Number.isInteger(v) && v >= 1 && v <= 500) {
          mobileState.cartela2Id = v;
          mobileState.daubed2 = new Set([0]);
          renderMobileCartela(2);
        }
      });

    document
      .getElementById("resetBoardBtn")
      .addEventListener("click", resetAllDaubs);

    document.querySelectorAll(".m-verify-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cardIdx = Number(btn.dataset.card);
        checkAutoBingoAnnouncement(cardIdx, true);
      });
    });

    // 27-Tap Secret Admin Trigger
    document
      .getElementById("secretAdminLogoTrigger")
      .addEventListener("click", handleSecretLogoTap);

    document
      .getElementById("cancelAdminPinBtn")
      .addEventListener("click", () => {
        document.getElementById("adminPinModal").classList.remove("open");
      });

    document.getElementById("unlockAdminBtn").addEventListener("click", () => {
      const pin = document.getElementById("adminPinInput").value.trim();
      if (
        pin === Core.CONFIG.ADMIN_SECRET_PIN ||
        pin === Core.CONFIG.ADMIN_MASTER_SECRET
      ) {
        document.getElementById("adminPinModal").classList.remove("open");
        document.getElementById("adminGeneratorModal").classList.add("open");
      } else {
        alert("የተሳሳተ Master PIN!");
      }
    });

    document
      .getElementById("closeAdminGenBtn")
      .addEventListener("click", () => {
        document.getElementById("adminGeneratorModal").classList.remove("open");
      });

    document
      .getElementById("adminTokenPreset")
      .addEventListener("change", (e) => {
        document.getElementById("adminCustomTokens").value = e.target.value;
      });

    document
      .getElementById("generateSignedKeyBtn")
      .addEventListener("click", () => {
        const uid = document.getElementById("adminBuyerUserId").value.trim();
        const seq = Number(document.getElementById("adminBuyerSeq").value);
        const tokens = Number(
          document.getElementById("adminCustomTokens").value
        );

        try {
          const entry = Core.generateRemoteLedgerEntry(
            uid,
            seq,
            tokens,
            "Issued via Owner Mobile APK Admin Mode"
          );
          document.getElementById("generated16KeyDisplay").textContent =
            entry.signedKey;
          document.getElementById("generatedJsonSnippet").textContent =
            JSON.stringify(entry, null, 2);
          document.getElementById("adminGeneratedOutput").style.display =
            "block";
        } catch (err) {
          alert(err.message);
        }
      });

    document.getElementById("copySmsKeyBtn").addEventListener("click", () => {
      const key = document.getElementById("generated16KeyDisplay").textContent;
      navigator.clipboard.writeText(key).catch(() => {});
      alert(`ኮዱ ኮፒ ተደርጓል፦ ${key}`);
    });

    document
      .getElementById("copyJsonSnippetBtn")
      .addEventListener("click", () => {
        const jsonTxt = document.getElementById(
          "generatedJsonSnippet"
        ).textContent;
        navigator.clipboard.writeText(jsonTxt).catch(() => {});
        alert("JSON ኮፒ ተደርጓል!");
      });

    renderMobileCartela(1);
  }

  window.addEventListener("DOMContentLoaded", initMobileApp);
})();
