/* Generic driver — no SCORM inside. Uses CourseBus + plugins. */

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

const CFG    = window.PRESENTATION_CONFIG || {};
const SLIDES = Array.isArray(CFG.slides) ? CFG.slides : [];
const OPT    = Object.assign({
  autoplayAudio: false,
  advanceOnAudioEnd: false,
  autoAdvanceDelayMs: 3500,
  rememberProgress: true
}, CFG.options || {});
const TOTAL = SLIDES.length || 1;

const STORAGE_KEY = "smiles_presentation_progress";
const THEME_KEY   = "smiles_theme";

let current = 0;
let autoMode = false;
let autoTimer = null;
let utterance = null;
let activePluginCleanups = [];

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const htmlFor = (i) => SLIDES[i]?.html  || `slides/slide${i+1}.html`;
const audioFor= (i) => SLIDES[i]?.audio || `audio/slide${i+1}.mp3`;

function updateUI(){
  const n = current + 1;
  counterEl && (counterEl.textContent = `Slide ${n} / ${TOTAL}`);
  prevBtn && (prevBtn.disabled = current <= 0);
  nextBtn && (nextBtn.disabled = current >= TOTAL - 1);
  if (progressBar) progressBar.style.width = `${(n / TOTAL) * 100}%`;
  const isDark = document.documentElement.classList.contains("dark");
  themeIconLight?.classList.toggle("hidden", isDark);
  themeIconDark?.classList.toggle("hidden", !isDark);
}
function saveProgress(){ try { OPT.rememberProgress && localStorage.setItem(STORAGE_KEY, String(current)); } catch {} }
function restoreProgress(){
  try { const s = localStorage.getItem(STORAGE_KEY); return s!=null ? clamp(parseInt(s,10)||0,0,TOTAL-1) : 0; }
  catch { return 0; }
}
function stopAllAudio(){
  try { if (audioEl) { audioEl.pause(); audioEl.currentTime=0; audioEl.removeAttribute("src"); audioEl.load(); } } catch {}
  if (utterance && window.speechSynthesis) { try { speechSynthesis.cancel(); } catch {} utterance=null; }
  playIcon?.classList.remove("hidden"); stopIcon?.classList.add("hidden");
}
function ttsFromSlide(root, onEnd){
  const narr = root?.querySelector(".narration-panel");
  const text = narr ? narr.textContent.trim() : "";
  if (!text) { onEnd && onEnd(); return; }
  try {
    utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = ()=>{ playIcon?.classList.add("hidden"); stopIcon?.classList.remove("hidden"); };
    utterance.onend   = ()=>{ playIcon?.classList.remove("hidden"); stopIcon?.classList.add("hidden"); utterance=null; onEnd && onEnd(); };
    speechSynthesis.speak(utterance);
  } catch { onEnd && onEnd(); }
}
function activateRoot(el){
  if (!el) return;
  if (!el.classList.contains("slide")) el.classList.add("slide");
  el.classList.add("active");
  el.classList.remove("hidden","invisible","opacity-0");
  if (el.hasAttribute("hidden")) el.removeAttribute("hidden");
  if (getComputedStyle(el).display === "none") el.style.display = "flex";
  el.querySelectorAll(".animated-element").forEach(node => { node.style.animation="none"; void node.offsetWidth; node.style.animation=""; });
}
function setAudioIcon(on){ playIcon?.classList.toggle("hidden", on); stopIcon?.classList.toggle("hidden", !on); }
function updateAutoButton(){ autoBtn.classList.toggle('bg-indigo-600', autoMode); autoBtn.classList.toggle('text-white', autoMode); }
function preloadAudio(i){ if (i < TOTAL) { const l=document.createElement('link'); l.rel='preload'; l.as='audio'; l.href=audioFor(i); document.head.appendChild(l); } }

function runSlidePlugins(slideIndex, root){
  activePluginCleanups.forEach(fn => { try{fn();}catch{} });
  activePluginCleanups = [];
  const hooks = SLIDES[slideIndex]?.hooks || [];
  const REG = window.SLIDE_PLUGINS || {};
  hooks.forEach(h => {
    const plug = REG[h.use]; if (typeof plug !== "function") return;
    try {
      const cleanup = plug(root, Object.assign({ slideIndex }, h));
      if (typeof cleanup === "function") activePluginCleanups.push(cleanup);
    } catch (e) { console.warn(`Plugin "${h.use}" failed on slide ${slideIndex+1}`, e); }
  });
}

async function showSlide(index){
  stopAllAudio();
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }

  current = clamp(index, 0, TOTAL - 1);
  const htmlUrl = htmlFor(current);
  const audioUrl = audioFor(current);

  const r = await fetch(`${htmlUrl}?ts=${Date.now()}`, { cache:"no-cache" });
  if (!r.ok) {
    slideArea.innerHTML = `<div class="p-6"><h2 class="text-xl font-semibold">Failed to load slide ${current+1}</h2><pre>${r.status} ${r.statusText}</pre></div>`;
    return;
  }
  const html = await r.text();
  slideArea.innerHTML = html;

  const root = slideArea.firstElementChild || slideArea;
  activateRoot(root);
  runSlidePlugins(current, root);

  // audio (data-audio override)
  const src = root?.dataset?.audio || audioUrl;
  if (audioEl) {
    audioEl.onended = audioEl.onerror = null;
    audioEl.src = src; audioEl.load();
    if (OPT.autoplayAudio) {
      audioEl.play().then(()=> setAudioIcon(true))
                    .catch(()=> ttsFromSlide(root, ()=> (autoMode ? nextAfterAudioOrTimer() : null)));
    } else {
      setAudioIcon(false);
    }
    audioEl.onerror = ()=> ttsFromSlide(root, ()=> (autoMode ? nextAfterAudioOrTimer() : null));
    if (OPT.advanceOnAudioEnd) nextAfterAudioOrTimer();
  } else {
    ttsFromSlide(root, ()=> (autoMode ? nextAfterAudioOrTimer() : null));
  }

  // save + UI + preload
  saveProgress();
  if (current + 1 < TOTAL) preloadAudio(current + 1);
  updateUI();

  // 🔔 Emit events for bridges (SCORM etc.)
  CourseBus?.emit("slide:change", { index: current });

  // end-of-course signal
  if (current === TOTAL - 1) CourseBus?.emit("course:complete", { index: current });

  // auto
  if (autoMode && !OPT.autoplayAudio && !OPT.advanceOnAudioEnd) {
    autoTimer = setTimeout(()=> goNext(), OPT.autoAdvanceDelayMs);
  }
}

function nextAfterAudioOrTimer(){
  if (OPT.advanceOnAudioEnd) {
    audioEl.onended = ()=> { setAudioIcon(false); if (autoMode) goNext(); };
  } else if (autoMode) {
    autoTimer = setTimeout(()=> goNext(), OPT.autoAdvanceDelayMs);
  }
}
function goNext(){ if (current < TOTAL - 1) showSlide(current + 1); updateUI(); updateAutoButton(); }

function bootTheme(){
  const html = document.documentElement;
  const saved = localStorage.getItem(THEME_KEY);
  const preferDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  html.classList.toggle("dark", saved ? saved === "dark" : preferDark);
}

function wire(){
  prevBtn?.addEventListener("click", ()=> showSlide(current - 1));
  nextBtn?.addEventListener("click", ()=> showSlide(current + 1));
  autoBtn?.addEventListener("click", ()=>{
    autoMode = !autoMode; updateAutoButton();
    if (!autoMode && autoTimer) { clearTimeout(autoTimer); autoTimer=null; }
    if (autoMode) nextAfterAudioOrTimer();
  });
  audioBtn?.addEventListener("click", ()=>{
    if (!audioEl) return;
    if (audioEl.paused){
      audioEl.play().then(()=> setAudioIcon(true))
                    .catch(()=> ttsFromSlide(slideArea.firstElementChild || slideArea));
    } else {
      audioEl.pause(); setAudioIcon(false);
    }
  });
  narrBtn?.addEventListener("click", ()=> stage?.classList.toggle("narration-visible"));
  document.addEventListener("keydown", (e)=>{
    if (e.key==="ArrowRight" && (!nextBtn || !nextBtn.disabled)) showSlide(current + 1);
    if (e.key==="ArrowLeft"  && (!prevBtn || !prevBtn.disabled)) showSlide(current - 1);
  });
  themeBtn?.addEventListener("click", ()=>{
    const html = document.documentElement;
    const dark = !html.classList.contains("dark");
    html.classList.toggle("dark", dark);
    localStorage.setItem(THEME_KEY, dark ? "dark":"light");
    updateUI();
  });
}

function boot(){
  bootTheme(); wire();
  const start = restoreProgress();
  updateUI();
  CourseBus?.emit("course:init", { totalSlides: TOTAL, title: CFG.title });
  showSlide(start);
  preloadAudio(start + 1);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

// helpers
window.goto = n => showSlide(n-1);
window.reloadCurrent = () => showSlide(current);
