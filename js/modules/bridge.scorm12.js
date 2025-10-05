// SCORM 1.2 bridge. Listens to CourseBus events and talks to the LMS.
// Driver stays generic; enable/disable via config.scorm.enabled

(function () {
  const cfg = (window.PRESENTATION_CONFIG && window.PRESENTATION_CONFIG.scorm) || {};
  if (!cfg.enabled) return;

  const state = {
    masteryScore: Number(cfg.masteryScore ?? 70),
    // quiz score aggregation
    quizScores: new Map(), // slideIndex -> {score, max}
  };

  // safe SCORM getters
  function scormAvailable() {
    try { return typeof scorm !== "undefined" && scorm; } catch { return false; }
  }

  function initSCORM() {
    try {
      if (!scormAvailable()) return;
      scorm.init();
      const ls = scorm.get("cmi.core.lesson_status");
      if (!ls || ls === "not attempted") {
        scorm.set("cmi.core.lesson_status", "incomplete");
      }
      // Try to read LMS mastery score
      const ms = Number(scorm.get("cmi.student_data.mastery_score"));
      if (!isNaN(ms) && isFinite(ms)) state.masteryScore = ms;
      scorm.save && scorm.save();
    } catch (e) { console.warn("SCORM init failed:", e); }
  }

  function quitSCORM() { try { if (scormAvailable()) scorm.quit(); } catch {} }

  function setLocation(index) {
    try {
      if (!scormAvailable()) return;
      scorm.set("cmi.core.lesson_location", String(index));
      scorm.save && scorm.save();
    } catch {}
  }

  function writeInteraction({ id, result, response, correct }) {
    try {
      if (!scormAvailable()) return;
      const i = Number(scorm.get("cmi.interactions._count")) || 0;
      scorm.set(`cmi.interactions.${i}.id`, id);
      scorm.set(`cmi.interactions.${i}.type`, "choice");
      scorm.set(`cmi.interactions.${i}.result`, result); // "correct" | "wrong"
      scorm.set(`cmi.interactions.${i}.student_response`, response ?? "");
      if (correct != null) scorm.set(`cmi.interactions.${i}.correct_responses.0.pattern`, correct);
      scorm.set(`cmi.interactions.${i}.weighting`, "1");
      scorm.save && scorm.save();
    } catch (e) { console.warn("SCORM interaction write failed:", e); }
  }

  function writeScorePercent() {
    const items = Array.from(state.quizScores.values());
    if (!items.length) return null;
    const total = items.reduce((a, b) => a + (Number(b.score) || 0), 0);
    const max   = items.reduce((a, b) => a + (Number(b.max)   || 0), 0) || 1;
    const pct   = Math.round((total / max) * 100);
    try {
      if (!scormAvailable()) return pct;
      scorm.set("cmi.core.score.raw", pct);
      scorm.set("cmi.core.score.min", 0);
      scorm.set("cmi.core.score.max", 100);
      scorm.save && scorm.save();
    } catch {}
    return pct;
  }

  function evaluateAndSetStatus(atEnd) {
    const pct = writeScorePercent(); // null if no quizzes
    try {
      if (!scormAvailable()) return;
      if (pct != null) {
        const passed = pct >= state.masteryScore;
        scorm.set("cmi.core.lesson_status", passed ? "passed" : (atEnd ? "failed" : (scorm.get("cmi.core.lesson_status") || "incomplete")));
      } else if (atEnd && cfg.completeOnLastSlide) {
        scorm.set("cmi.core.lesson_status", "completed");
      }
      scorm.save && scorm.save();
    } catch {}
  }

  // ---- Wire window events ----
  window.addEventListener("load", initSCORM);
  window.addEventListener("beforeunload", quitSCORM);

  // ---- Wire CourseBus events ----
  CourseBus.on("course:init", (p) => {
    // nothing extra; SCORM is initialized on load
  });

  CourseBus.on("slide:change", ({ index }) => setLocation(index));

  CourseBus.on("quiz:interaction", ({ slideIndex, id, result, response, correct }) => {
    writeInteraction({ id, result, response, correct });
    if (cfg.evaluateOnLastSlide !== true) evaluateAndSetStatus(false);
  });

  CourseBus.on("quiz:score", ({ slideIndex, score, max }) => {
    state.quizScores.set(slideIndex, { score, max });
    if (cfg.evaluateOnLastSlide !== true) evaluateAndSetStatus(false);
  });

  CourseBus.on("course:complete", () => {
    evaluateAndSetStatus(true);
  });
})();
