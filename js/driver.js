// ---------- SCORM init ----------
window.addEventListener('load', () => {
  try {
    scorm.init();
    if (scorm.get("cmi.core.lesson_status") === "not attempted") {
      scorm.set("cmi.core.lesson_status", "incomplete");
      scorm.save();
    }
  } catch (e) { console.warn('SCORM init warning:', e); }
});
window.addEventListener('beforeunload', () => { try { scorm.quit(); } catch(e){} });

// ---------- App State & Constants ----------
const TOTAL_SLIDES = 22;
const AUTO_ADVANCE_DELAY_MS = 3500;
let currentSlide = 0;
let autoMode = false;
let autoTimer = null;
let utterance = null; // For TTS fallback
let quizState = {}; // State management for the quiz

// ---------- DOM refs ----------
const slideContentArea = document.getElementById('slide-content-area');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const slideCounter = document.getElementById('slide-counter');
const progressBar = document.getElementById('progress-bar');
const themeToggle = document.getElementById('theme-toggle');
const narrationToggle = document.getElementById('narration-toggle');
const presentationContainer = document.getElementById('presentation-container');
const audioToggle = document.getElementById('audio-toggle');
const audioEl = document.getElementById('narration-audio');
const autoToggle = document.getElementById('auto-toggle');

// ---------- Core Logic ----------
async function showSlide(index) {
  stopAllAudio();
  autoTimer && clearTimeout(autoTimer);

  try {
    const response = await fetch(`slides/slide${index + 1}.html`, {cache: "no-cache"});
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    slideContentArea.innerHTML = await response.text();
    const slideDiv = slideContentArea.firstElementChild;
    if (slideDiv) {
        slideDiv.classList.add('slide', 'active');
        const animatedElements = slideDiv.querySelectorAll('.animated-element');
        animatedElements.forEach(el => {
            el.style.animation = 'none';
            void el.offsetWidth;
            el.style.animation = '';
        });
    }
  } catch (error) {
    slideContentArea.innerHTML = `<div class="text-center text-red-500"><p><strong>Error Loading Slide</strong></p><p>${error.message}</p></div>`;
    console.error("Failed to fetch slide:", error);
    return;
  }

  // After loading, check for interactive slides
  setTimeout(() => {
    if (index === 6) { // Slide 7
      setupToggleButton('aspirin-toggle-btn', 'aspirin-smiles');
      setupToggleButton('caffeine-toggle-btn', 'caffeine-smiles');
    }
    if (index === 17) { // Slide 18
      setupFlipCard('card1');
      setupFlipCard('card2');
    }
	if (index === 18 || index === 19) { // Slides 19 & 20
      setupQuizSlide(index);
    }
  }, 100);
  
  currentSlide = index;
  updateUI();
  
  if (currentSlide === TOTAL_SLIDES - 1) {
    try {
      if (scorm.get("cmi.core.lesson_status") !== "completed") {
        scorm.set("cmi.core.lesson_status", "completed");
        scorm.save();
      }
    } catch(e) { console.warn('SCORM completion set failed', e); }
  }
  
  preloadAudioForSlide(currentSlide + 1);

  if (autoMode) {
    runAutoFromCurrent();
  }
}

function updateUI() {
  slideCounter.textContent = `Slide ${currentSlide + 1} / ${TOTAL_SLIDES}`;
  prevBtn.disabled = currentSlide === 0;
  nextBtn.disabled = currentSlide === TOTAL_SLIDES - 1;
  progressBar.style.width = `${((currentSlide + 1) / TOTAL_SLIDES) * 100}%`;
  const themeIconLight = document.getElementById('theme-icon-light');
  const themeIconDark = document.getElementById('theme-icon-dark');
  if (document.documentElement.classList.contains('dark')) {
      themeIconLight.classList.add('hidden');
      themeIconDark.classList.remove('hidden');
  } else {
      themeIconLight.classList.remove('hidden');
      themeIconDark.classList.add('hidden');
  }
}

// ---------- Audio & Auto-play ----------
function stopAllAudio() {
    if (utterance) {
        speechSynthesis.cancel();
        utterance = null;
    }
    audioEl.pause();
    audioEl.currentTime = 0;
    setAudioIcon(false);
}

function setAudioIcon(speaking) {
    document.getElementById('audio-play-icon').classList.toggle('hidden', speaking);
    document.getElementById('audio-stop-icon').classList.toggle('hidden', !speaking);
}

function playNarrationOnce() {
    if (audioEl.paused && !utterance) {
        const currentSlideEl = document.querySelector('.slide.active');
        if (!currentSlideEl) return;
        const audioFile = currentSlideEl.dataset.audio;
        if (audioFile) {
            audioEl.src = audioFile;
            audioEl.play().catch(e => {
                console.warn("Audio playback failed, trying TTS fallback.", e);
                playTTSFallback(() => {});
            });
            setAudioIcon(true);
            audioEl.onended = () => setAudioIcon(false);
        } else {
            playTTSFallback(() => {});
        }
    } else {
        stopAllAudio();
    }
}

function playTTSFallback(onFinishCallback) {
    const currentSlideEl = document.querySelector('.slide.active');
    const narrationPanel = currentSlideEl ? currentSlideEl.querySelector('.narration-panel') : null;
    if (narrationPanel && 'speechSynthesis' in window) {
        stopAllAudio();
        const text = narrationPanel.innerText || narrationPanel.textContent;
        utterance = new SpeechSynthesisUtterance(text);
        utterance.onstart = () => setAudioIcon(true);
        utterance.onend = () => {
            setAudioIcon(false);
            utterance = null;
            if (onFinishCallback) onFinishCallback();
        };
        speechSynthesis.speak(utterance);
    } else if (onFinishCallback) {
        onFinishCallback();
    }
}

function runAutoFromCurrent() {
    if (!autoMode) return;
    const onFinish = () => {
        if (autoMode && currentSlide < TOTAL_SLIDES - 1) {
            autoTimer = setTimeout(() => showSlide(currentSlide + 1), AUTO_ADVANCE_DELAY_MS);
        } else {
            autoMode = false;
            updateAutoButton();
        }
    };

    const currentSlideEl = document.querySelector('.slide.active');
    const audioFile = currentSlideEl ? currentSlideEl.dataset.audio : null;

    if (audioFile) {
        audioEl.src = audioFile;
        audioEl.play().catch(() => playTTSFallback(onFinish));
        setAudioIcon(true);
        audioEl.onended = () => {
            setAudioIcon(false);
            onFinish();
        };
    } else {
        playTTSFallback(onFinish);
    }
}

function updateAutoButton() {
    autoToggle.classList.toggle('bg-indigo-600', autoMode);
    autoToggle.classList.toggle('text-white', autoMode);
}

function preloadAudioForSlide(slideIndex) {
    if (slideIndex >= TOTAL_SLIDES) return;
    // This is a simplified preloader. A real implementation might be more complex.
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'audio';
    link.href = `audio/slide${slideIndex + 1}.mp3`;
    document.head.appendChild(link);
}


// ---------- Interactive Slide Helpers ----------
function setupToggleButton(buttonId, codeId) { 
    const btn = document.getElementById(buttonId);
    const code = document.getElementById(codeId);
    if (btn && code) {
        btn.addEventListener('click', () => {
            const isHidden = code.classList.toggle('hidden');
            btn.textContent = isHidden ? 'Show SMILES' : 'Hide SMILES';
        });
    }
}
function setupFlipCard(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const handleFlip = () => card.classList.toggle('is-flipped');
    if (!card.dataset.listenerAttached) {
        card.addEventListener('click', handleFlip);
        card.dataset.listenerAttached = 'true';
    }
}

// =================================================================
// QUIZ LOGIC (full implementation)
// =================================================================
function initializeQuiz() {
  quizState[18] = { attempts: 2, answered: false, score: 0 };
  quizState[19] = { attempts: 2, answered: false, score: 0 };
}
function setupQuizSlide(index) {
  const slide = document.getElementById(`slide-${index + 1}`);
  if (!slide) return;
  
  const optionsContainer = slide.querySelector('.quiz-options');
  const feedbackEl = slide.querySelector('.quiz-feedback');
  const attemptsEl = slide.querySelector('.quiz-attempts');
  const state = quizState[index];

  attemptsEl.textContent = `Attempts remaining: ${state.attempts}`;
  
  optionsContainer.addEventListener('click', (event) => {
    const selectedButton = event.target.closest('.quiz-option');
    if (selectedButton) handleQuizAnswer(selectedButton, index);
  });

  if (state.answered) {
    slide.querySelectorAll('.quiz-option').forEach(btn => {
      btn.disabled = true;
      if (btn.dataset.correct === 'true') btn.classList.add('correct');
    });
    feedbackEl.textContent = "You have already answered this question.";
  }
}
function handleQuizAnswer(selectedButton, index) {
  const slide = document.getElementById(`slide-${index + 1}`);
  const state = quizState[index];

  if (state.answered || selectedButton.disabled) return;

  const feedbackEl = slide.querySelector('.quiz-feedback');
  const attemptsEl = slide.querySelector('.quiz-attempts');
  const isCorrect = selectedButton.dataset.correct === 'true';
  
  state.attempts--;
  attemptsEl.textContent = `Attempts remaining: ${state.attempts}`;

  if (isCorrect) {
    state.score = 1;
    state.answered = true;
    selectedButton.classList.add('correct');
    feedbackEl.textContent = "Correct!";
    feedbackEl.style.color = 'var(--quiz-success-bg)';
    sendScormInteraction(index, "correct", selectedButton.textContent.trim());
    slide.querySelectorAll('.quiz-option').forEach(btn => btn.disabled = true);
  } else {
    selectedButton.classList.add('incorrect');
    selectedButton.disabled = true;
    if (state.attempts > 0) {
      feedbackEl.textContent = "Incorrect. Please try again.";
      feedbackEl.style.color = 'var(--quiz-error-bg)';
    } else {
      state.answered = true;
      feedbackEl.textContent = "Incorrect. The correct answer is highlighted.";
      feedbackEl.style.color = 'var(--quiz-error-bg)';
      sendScormInteraction(index, "incorrect", selectedButton.textContent.trim());
      slide.querySelectorAll('.quiz-option').forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.correct === 'true') btn.classList.add('correct');
      });
    }
  }

  const allAnswered = Object.values(quizState).every(s => s.answered);
  if (allAnswered) updateTotalScormScore();
}
function sendScormInteraction(index, result, studentResponse) {
  try {
    const interactionIndex = scorm.get("cmi.interactions._count");
    const questionId = `smiles_quiz_q${index - 17}`;
    const slide = document.getElementById(`slide-${index + 1}`);
    const correctButton = slide.querySelector('.quiz-option[data-correct="true"]');
    const correctResponsePattern = correctButton ? correctButton.textContent.trim() : "";
    scorm.set(`cmi.interactions.${interactionIndex}.id`, questionId);
    scorm.set(`cmi.interactions.${interactionIndex}.type`, "choice");
    scorm.set(`cmi.interactions.${interactionIndex}.result`, result);
    scorm.set(`cmi.interactions.${interactionIndex}.student_response`, studentResponse);
    scorm.set(`cmi.interactions.${interactionIndex}.correct_responses.0.pattern`, correctResponsePattern);
    scorm.set(`cmi.interactions.${interactionIndex}.weighting`, '1');
    scorm.save();
  } catch(e) { console.warn("SCORM interaction failed to save:", e); }
}
function updateTotalScormScore() {
  try {
    const totalScore = Object.values(quizState).reduce((sum, state) => sum + state.score, 0);
    const maxScore = Object.keys(quizState).length;
    scorm.set("cmi.core.score.raw", totalScore);
    scorm.set("cmi.core.score.min", 0);
    scorm.set("cmi.core.score.max", maxScore);
    scorm.save();
  } catch(e) { console.warn("SCORM total score failed to save:", e); }
}

// ---------- Event Listeners ----------
document.addEventListener('DOMContentLoaded', () => {
    nextBtn.addEventListener('click', () => showSlide(currentSlide + 1));
    prevBtn.addEventListener('click', () => showSlide(currentSlide - 1));
    themeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        updateUI();
    });
    narrationToggle.addEventListener('click', () => presentationContainer.classList.toggle('narration-visible'));
    audioToggle.addEventListener('click', playNarrationOnce);
    autoToggle.addEventListener('click', () => {
        autoMode = !autoMode;
        updateAutoButton();
        if (autoMode) {
            runAutoFromCurrent();
        } else {
            stopAllAudio();
            autoTimer && clearTimeout(autoTimer);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' && !nextBtn.disabled) showSlide(currentSlide + 1);
        if (e.key === 'ArrowLeft' && !prevBtn.disabled) showSlide(currentSlide - 1);
    });

    // ---------- Initial Load ----------
    initializeQuiz();
    showSlide(0);
    preloadAudioForSlide(1);
});