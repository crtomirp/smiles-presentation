// Project config. No driver edits needed.
const baseSlides = Array.from({ length: 22 }, (_, i) => {
  const n = i + 1;
  return {
    html: `slides/slide${n}.html`,
    audio: `audio/slide${n}.mp3`,
    title: `Slide ${n}`,
    hooks: []  // per-slide plugins (optional)
  };
});

// Add your special slide behaviors here (examples)
baseSlides[9].hooks.push( // Slide 10
  { use: "buttonToggle", target: "#aspirin-toggle-btn",  toggles: "#aspirin-smiles",  onText: "Hide SMILES", offText: "Show SMILES" },
  { use: "buttonToggle", target: "#caffeine-toggle-btn", toggles: "#caffeine-smiles", onText: "Hide SMILES", offText: "Show SMILES" }
);
baseSlides[17].hooks.push( // Slide 18
  { use: "flipCard", target: "#card1" },
  { use: "flipCard", target: "#card2" }
);
baseSlides[18].hooks.push( // Slide 19 quiz
  { use: "quiz", id: "q1", correct: "B", attempts: 2 }
);
baseSlides[19].hooks.push( // Slide 20 quiz
  { use: "quiz", id: "q2", correct: "C", attempts: 2 }
);

window.PRESENTATION_CONFIG = {
  title: "Introduction to SMILES",
  options: {
    autoplayAudio: false,
    advanceOnAudioEnd: false,
    autoAdvanceDelayMs: 3500,
    rememberProgress: true
  },
  // ✅ SCORM bridge is configured here; driver stays generic
  scorm: {
    enabled: true,           // turn SCORM on/off per project
    runtime: "1.2",          // (future-proof flag)
    masteryScore: 60,        // fallback if LMS mastery is blank
    completeOnLastSlide: true,
    evaluateOnLastSlide: true, // set passed/failed at the end; otherwise on each quiz
    scoreMode: "percent"       // "percent" for 0–100 in cmi.core.score.raw
  },
  slides: baseSlides
};
