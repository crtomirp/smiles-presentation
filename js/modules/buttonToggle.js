// Toggle visibility of a target element and swap button text
// Usage in config: { use: "buttonToggle", target:"#aspirin-toggle-btn", toggles:"#aspirin-smiles", onText:"Hide SMILES", offText:"Show SMILES" }
window.SLIDE_PLUGINS.buttonToggle = function (root, opts) {
  const btn = root.querySelector(opts.target) || document.querySelector(opts.target);
  const tgt = root.querySelector(opts.toggles) || document.querySelector(opts.toggles);
  if (!btn || !tgt) return () => {};

  const onText  = opts.onText  ?? "Hide";
  const offText = opts.offText ?? "Show";

  const handler = () => {
    const nowHidden = tgt.classList.toggle("hidden");
    btn.textContent = nowHidden ? offText : onText;
  };
  btn.addEventListener("click", handler);

  // return cleanup
  return () => btn.removeEventListener("click", handler);
};
