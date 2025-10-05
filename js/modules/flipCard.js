// Click-to-flip a card (needs your flipcard.css)
// Usage: { use:"flipCard", target:"#card1" }
window.SLIDE_PLUGINS.flipCard = function (root, opts) {
  const card = root.querySelector(opts.target) || document.querySelector(opts.target);
  if (!card) return () => {};
  const handler = () => card.classList.toggle("is-flipped");
  card.addEventListener("click", handler);
  return () => card.removeEventListener("click", handler);
};
