// Buttons inside .quiz-options with class .quiz-option
// Mark the correct button via data-correct="true" or provide opts.correct ("A","B","C"...)
window.SLIDE_PLUGINS.quiz = function (root, opts) {
  const box = root.querySelector(".quiz-options");
  if (!box) return () => {};

  const feedback   = root.querySelector(".quiz-feedback");
  const attemptsEl = root.querySelector(".quiz-attempts");

  const maxAttempts = Number(opts.attempts ?? 2);
  let attemptsLeft  = maxAttempts;
  let answered      = false;

  const options = Array.from(root.querySelectorAll(".quiz-option"));
  const correctBtn = options.find(b => b.dataset.correct === "true") ||
                     options.find(b => (b.dataset.label || b.textContent.trim()).toUpperCase() === String(opts.correct || "").toUpperCase());

  function lock(){ options.forEach(b => b.disabled = true); }
  function setAttempts(){ attemptsEl && (attemptsEl.textContent = `Attempts remaining: ${attemptsLeft}`); }
  setAttempts();

  const clickHandler = (ev) => {
    const btn = ev.target.closest(".quiz-option");
    if (!btn || answered || btn.disabled) return;

    const studentResp = (btn.dataset.label || btn.textContent.trim());
    const correct = (btn === correctBtn);
    attemptsLeft--; setAttempts();

    if (correct) {
      answered = true; btn.classList.add("correct"); feedback && (feedback.textContent = "Correct!"); lock();
      CourseBus.emit("quiz:interaction", {
        slideIndex: opts.slideIndex, id: opts.id || `q${(opts.slideIndex ?? 0)+1}`,
        result: "correct", response: studentResp,
        correct: correctBtn ? (correctBtn.dataset.label || correctBtn.textContent.trim()) : ""
      });
      CourseBus.emit("quiz:score", { slideIndex: opts.slideIndex, score: 1, max: 1 });
    } else {
      btn.classList.add("incorrect"); btn.disabled = true;
      if (attemptsLeft > 0) {
        feedback && (feedback.textContent = "Incorrect. Try again.");
      } else {
        answered = true; feedback && (feedback.textContent = "Incorrect. The correct answer is highlighted.");
        lock(); correctBtn && correctBtn.classList.add("correct");
        CourseBus.emit("quiz:interaction", {
          slideIndex: opts.slideIndex, id: opts.id || `q${(opts.slideIndex ?? 0)+1}`,
          result: "wrong", response: studentResp,
          correct: correctBtn ? (correctBtn.dataset.label || correctBtn.textContent.trim()) : ""
        });
        CourseBus.emit("quiz:score", { slideIndex: opts.slideIndex, score: 0, max: 1 });
      }
    }
  };

  box.addEventListener("click", clickHandler);
  return () => box.removeEventListener("click", clickHandler);
};
