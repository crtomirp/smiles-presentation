/* driver.js — UI-aligned + plugin system + audio/auto + narration */

/* ---------- SCORM (safe) ---------- */
window.addEventListener("load", () => {
  try {
    if (typeof scorm !== "undefined" && scorm && typeof scorm.init === "function") {
      scorm.init();
      if (scorm.get("cmi.core.lesson_status") === "not attempted") {
        scorm.set("cmi.core.lesson_status", "incomplete");
        scorm.save && scorm.save();
      }
    }
  } catch (e) { console.warn("SCORM init warning:", e); }
});
window.addEventListener("beforeunload", () => { try { scorm.quit(); } catch (e) {} });

/* ---------- DOM refs (match your index.html) ---------- */
const slideArea   = document.getElementById("slide-content-area");
const stage       = document.getElementById("presentation-container");
const progressBar = document.getElementById("progress-bar");
const prevBtn     = document.getElementById("prevBtn");
const nextBtn     = document.getElementById("nextBtn");
const autoBtn     = document.getElementById("auto-toggle");
const counterEl   = document.getElementById("slide-counter");
const themeBtn    = document.getElementById("theme-toggle");
const themeIconLight = document.getElementById("theme-icon-light");
const themeIconDark  = document.getElementById("theme-icon-dark");
const narrBtn     = document.getElementById("narration-toggle");
const audioBtn    = document.getElementById("audio-toggle");
const audioEl     = document.getElementById("narration-audio");
const playIcon    = document.getElementById("audio-play-icon");
const stopIcon    = document.getElementById("audio-stop-icon");

/* ---------- Config & State ---------- */
const CFG    = window.PRESENTATION_CONFIG || {};
let   SLIDES = Array.isArray(CFG.slides) ? CFG.slides : [];
const OPT    = Object.assign({
  autoplayAudio: false,
  advanceOnAudioEnd: false,
  autoAdvanceDelayMs: 3500,
  rememberProgress: true
}, CFG.options || {});

const STORAGE_KEY = "smiles_presentation_progress";
const THEME_KEY   = "smiles_theme";

const TOTAL = SLIDES.length || 22;
let current = 0;
let autoMode = false;
let autoTimer = null;
let utterance = null;                     // TTS fallback
let activePluginCleanups = [];            // per-slide plugin unbinders

// quiz score aggregator (used by quiz plugin)
const QUIZ_SLIDES = SLIDES
  .map((s, i) => ({ i, hooks: s.hooks || [] }))
  .filter(s => s.hooks.some(h => h.use === "quiz"))
  .map(s => s.i);
const quizScores = new Map();             // slideIndex -> 0/1
window._updateTotalQuizScore = function (slideIndex, score) {
  quizScores.set(slideIndex, score ? 1 : 0);
  try {
    const total = Array.from(quizScores.values()).reduce((a, b) => a + b, 0);
    const max = QUIZ_SLIDES.length || 0;
    if (typeof scorm !== "undefined" && scorm) {
      scorm.set("cmi.core.score.raw", total);
      scorm.set("cmi.core.score.min", 0);
      scorm.set("cmi.core.score.max", max);
      scorm.save && scorm.save();
    }
  } catch (e) { /* ignore */ }
};

/* ---------- Helpers ---------- */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const htmlFor = (i) => SLIDES[i]?.html  || `slides/slide${i + 1}.html`;
const audioFor= (i) => SLIDES[i]?.audio || `audio/slide${i + 1}.mp3`;

function updateUI() {
  const n = current + 1;
  counterEl && (counterEl.textContent = `Slide ${n} / ${TOTAL}`);
  prevBtn && (prevBtn.disabled = current <= 0);
  nextBtn && (nextBtn.disabled = current >= TOTAL - 1);
  if (progressBar) progressBar.style.width = `${(n / TOTAL) * 100}%`;
  const isDark = document.documentElement.classList.contains("dark");
  themeIconLight?.classList.toggle("hidden", isDark);
  themeIconDark?.classList.toggle("hidden", !isDark);
}

function saveProgress() {
  try {
    OPT.rememberProgress && localStorage.setItem(STORAGE_KEY, String(current));
    if (typeof scorm !== "undefined" && scorm) {
      scorm.set("cmi.core.lesson_location", String(current));
      scorm.save && scorm.save();
    }
  } catch (e) {}
}
function restoreProgress() {
  let idx = 0;
  try {
    if (OPT.rememberProgress) {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s !== null) idx = clamp(parseInt(s, 10) || 0, 0, TOTAL - 1);
    }
    if (typeof scorm !== "undefined" && scorm) {
      const loc = scorm.get("cmi.core.lesson_location");
      if (loc && !isNaN(Number(loc))) idx = clamp(parseInt(loc, 10) || 0, 0, TOTAL - 1);
    }
  } catch (e) {}
  return idx;
}

function stopAllAudio() {
  try {
    if (audioEl) {
      audioEl.pause(); audioEl.currentTime = 0;
      audioEl.removeAttribute("src"); audioEl.load();
    }
  } catch (e) {}
  if (utterance && window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) {} utterance = null; }
  playIcon?.classList.remove("hidden"); stopIcon?.classList.add("hidden");
}

function ttsFromSlide(slideRoot, onEnd) {
  const narr = slideRoot?.querySelector(".narration-panel");
  const text = narr ? narr.textContent.trim() : "";
  if (!text) { onEnd && onEnd(); return; }
  try {
    utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => { playIcon?.classList.add("hidden"); stopIcon?.classList.remove("hidden"); };
    utterance.onend   = () => { playIcon?.classList.remove("hidden"); stopIcon?.classList.add("hidden"); utterance = null; onEnd && onEnd(); };
    speechSynthesis.speak(utterance);
  } catch (e) { onEnd && onEnd(); }
}

function activateRoot(el) {
  if (!el) return;
  if (!el.classList.contains("slide")) el.classList.add("slide");
  el.classList.add("active");
  el.classList.remove("hidden", "invisible", "opacity-0");
  if (el.hasAttribute("hidden")) el.removeAttribute("hidden");
  if (getComputedStyle(el).display === "none") el.style.display = "flex";
  el.querySelectorAll(".animated-element").forEach(node => { node.style.animation = "none"; void node.offsetWidth; node.style.animation = ""; });
}

function setAudioIcon(on) { playIcon?.classList.toggle("hidden", on); stopIcon?.classList.toggle("hidden", !on); }
function updateAutoButton() { autoBtn.classList.toggle("bg-indigo-600", autoMode); autoBtn.classList.toggle("text-white", autoMode); }
function preloadAudio(i) { if (i < TOTAL) { const link = document.createElement("link"); link.rel = "preload"; link.as = "audio"; link.href = audioFor(i); document.head.appendChild(link); } }

/* ---------- Plugin runner ---------- */
function runSlidePlugins(slideIndex, root) {
  // cleanup previous
  for (const fn of activePluginCleanups) try { fn(); } catch {}
  activePluginCleanups = [];

  const hooks = SLIDES[slideIndex]?.hooks || [];
  if (!hooks.length) return;

  const REG = window.SLIDE_PLUGINS || {};
  hooks.forEach(h => {
    const plug = REG[h.use];
    if (typeof plug === "function") {
      try {
        const cleanup = plug(root, Object.assign({ slideIndex }, h));
        if (typeof cleanup === "function") activePluginCleanups.push(cleanup);
      } catch (e) {
        console.warn(`Plugin "${h.use}" failed on slide ${slideIndex + 1}:`, e);
      }
    } else {
      console.warn(`Unknown plugin "${h.use}" on slide ${slideIndex + 1}`);
    }
  });
}

/* ---------- Core ---------- */
async function showSlide(index) {
  stopAllAudio();
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }

  current = clamp(index, 0, TOTAL - 1);
  const htmlUrl  = htmlFor(current);
  const audioUrl = audioFor(current);

  try {
    const r = await fetch(`${htmlUrl}?ts=${Date.now()}`, { cache: "no-cache" });
    if (!r.ok) throw new Error(`HTTP ${r.status} while loading ${htmlUrl}`);
    const html = await r.text();
    slideArea.innerHTML = html;

    const root = slideArea.firstElementChild || slideArea;
    activateRoot(root);

    // Plugins (per-slide special behaviour)
    runSlidePlugins(current, root);

    // Audio (dataset override -> config -> default)
    const dsAudio = root?.dataset?.audio;
    const src = dsAudio || audioUrl;
    if (audioEl) {
      audioEl.onended = audioEl.onerror = null;
      audioEl.src = src; audioEl.load();
      if (OPT.autoplayAudio) {
        audioEl.play().then(() => setAudioIcon(true))
                      .catch(() => ttsFromSlide(root, () => (autoMode ? nextAfterAudioOrTimer() : null)));
      } else {
        setAudioIcon(false);
      }
      audioEl.onerror = () => ttsFromSlide(root, () => (autoMode ? nextAfterAudioOrTimer() : null));
      if (OPT.advanceOnAudioEnd) nextAfterAudioOrTimer();
    } else {
      ttsFromSlide(root, () => (autoMode ? nextAfterAudioOrTimer() : null));
    }

    saveProgress();
    if (current + 1 < TOTAL) preloadAudio(current + 1);
    updateUI();

    if (autoMode && !OPT.autoplayAudio && !OPT.advanceOnAudioEnd) {
      autoTimer = setTimeout(() => goNext(), OPT.autoAdvanceDelayMs);
    }

    if (current === TOTAL - 1) {
      try {
        if (typeof scorm !== "undefined" && scorm && scorm.get("cmi.core.lesson_status") !== "completed") {
          scorm.set("cmi.core.lesson_status", "completed");
          scorm.save && scorm.save();
        }
      } catch (e) {}
    }
  } catch (err) {
    console.error(err);
    slideArea.innerHTML = `<div class="p-6 text-gray-800 dark:text-gray-200">
      <h2 class="text-xl font-semibold mb-2">Failed to load slide ${current + 1}</h2>
      <pre class="text-sm bg-gray-900 text-gray-100 p-3 rounded">${String(err)}</pre>
    </div>`;
  }
}

/* ---------- Audio/Auto helpers ---------- */
function nextAfterAudioOrTimer() {
  if (OPT.advanceOnAudioEnd) {
    audioEl.onended = () => { setAudioIcon(false); if (autoMode) goNext(); };
  } else if (autoMode) {
    autoTimer = setTimeout(() => goNext(), OPT.autoAdvanceDelayMs);
  }
}
function goNext() { if (current < TOTAL - 1) showSlide(current + 1); updateUI(); updateAutoButton(); }

/* ---------- Wiring & Boot ---------- */
function bootTheme() {
  const html = document.documentElement;
  const saved = localStorage.getItem(THEME_KEY);
  const preferDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  html.classList.toggle("dark", saved ? saved === "dark" : preferDark);
}

function wire() {
  prevBtn?.addEventListener("click", () => showSlide(current - 1));
  nextBtn?.addEventListener("click", () => showSlide(current + 1));
  autoBtn?.addEventListener("click", () => {
    autoMode = !autoMode; updateAutoButton();
    if (!autoMode && autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    if (autoMode) nextAfterAudioOrTimer();
  });
  audioBtn?.addEventListener("click", () => {
    if (!audioEl) return;
    if (audioEl.paused) audioEl.play().then(() => setAudioIcon(true))
      .catch(() => ttsFromSlide(slideArea.firstElementChild || slideArea));
    else { audioEl.pause(); setAudioIcon(false); }
  });
  narrBtn?.addEventListener("click", () => stage?.classList.toggle("narration-visible"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" && (!nextBtn || !nextBtn.disabled)) showSlide(current + 1);
    if (e.key === "ArrowLeft"  && (!prevBtn || !prevBtn.disabled)) showSlide(current - 1);
  });
  themeBtn?.addEventListener("click", () => {
    const html = document.documentElement;
    const dark = !html.classList.contains("dark");
    html.classList.toggle("dark", dark);
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    updateUI();
  });
}

function boot() {
  bootTheme();
  wire();
  current = restoreProgress();
  updateUI();
  showSlide(current);
  preloadAudio(current + 1);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

/* helpers for console */
window.goto = n => showSlide(n - 1);
window.reloadCurrent = () => showSlide(current);
