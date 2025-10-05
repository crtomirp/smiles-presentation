// Config with declarative hooks per slide
const baseSlides = Array.from({ length: 22 }, (_, i) => {
  const n = i + 1;
  return { html: `slides/slide${n}.html`, audio: `audio/slide${n}.mp3`, title: `Slide ${n}` };
});

// Add special behaviour on specific slides (numbers are 1-based for readability)
function withHooks(slides) {
  const s = [...slides];

  // Slide 10: two "show/hide SMILES" toggles
  s[9] = Object.assign({}, s[9], {
    hooks: [
      { use: "buttonToggle", target: "#aspirin-toggle-btn",  toggles: "#aspirin-smiles",  onText: "Hide SMILES", offText: "Show SMILES" },
      { use: "buttonToggle", target: "#caffeine-toggle-btn", toggles: "#caffeine-smiles", onText: "Hide SMILES", offText: "Show SMILES" }
    ]
  });

  // Slide 18: flip cards
  s[17] = Object.assign({}, s[17], {
    hooks: [
      { use: "flipCard", target: "#card1" },
      { use: "flipCard", target: "#card2" }
    ]
  });

  // Slide 19: quiz (example—adjust IDs/labels to your markup)
  s[18] = Object.assign({}, s[18], {
    hooks: [
      { use: "quiz", id: "q1", correct: "B", attempts: 2 }
    ]
  });

  // Slide 20: quiz 2
  s[19] = Object.assign({}, s[19], {
    hooks: [
      { use: "quiz", id: "q2", correct: "C", attempts: 2 }
    ]
  });

  return s;
}

window.PRESENTATION_CONFIG = {
  title: "Introduction to SMILES",
  options: {
    autoplayAudio: false,
    advanceOnAudioEnd: false,
    autoAdvanceDelayMs: 3500,
    rememberProgress: true
  },
  slides: withHooks(baseSlides)
};
