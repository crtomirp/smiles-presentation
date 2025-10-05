// Simple multiple-choice quiz (buttons with .quiz-option)
// Mark correct option with data-correct="true", or pass opts.correctLabel ("A"/"B"/"C"/...)
// Usage: { use:"quiz", id:"q1", correct:"B", attempts:2 }
window.SLIDE_PLUGINS.quiz = function (root, opts) {
  const box = root.querySelector(".quiz-options");
  if (!box) return () => {};

  const feedback = root.querySelector(".quiz-feedback");
  const attemptsEl = root.querySelector(".quiz-attempts");

  const maxAttempts = Number(opts.attempts ?? 2);
  let attemptsLeft = maxAttempts;
  let answered = false;

  const options = Array.from(root.querySelectorAll(".quiz-option"));
  const correctBtn = options.find(b => b.dataset.correct === "true") ||
                     options.find(b => (b.dataset.label || b.textContent.trim()).toUpperCase() === String(opts.correct || "").toUpperCase());

  function lock() { options.forEach(b => b.disabled = true); }
  function unlock() { options.forEach(b => b.disabled = false); }
  function setAttempts() { attemptsEl && (attemptsEl.textContent = `Attempts remaining: ${attemptsLeft}`); }

  setAttempts(); unlock();

  const clickHandler = (ev) => {
    const btn = ev.target.closest(".quiz-option");
    if (!btn || answered || btn.disabled) return;

    const correct = (btn === correctBtn);
    attemptsLeft--; setAttempts();

    if (correct) {
      answered = true;
      btn.classList.add("correct"); feedback && (feedback.textContent = "Correct!");
      lock();
      // score + SCORM
      window._updateTotalQuizScore?.(opts.slideIndex, 1);
    } else {
      btn.classList.add("incorrect"); btn.disabled = true;
      if (attemptsLeft > 0) {
        feedback && (feedback.textContent = "Incorrect. Try again.");
      } else {
        answered = true;
        feedback && (feedback.textContent = "Out of attempts. Correct shown.");
        lock(); correctBtn && correctBtn.classList.add("correct");
        window._updateTotalQuizScore?.(opts.slideIndex, 0);
      }
    }
  };

  box.addEventListener("click", clickHandler);
  return () => box.removeEventListener("click", clickHandler);
};
