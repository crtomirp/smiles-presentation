window.SLIDE_PLUGINS.buttonToggle = function (root, opts) {
  const btn = root.querySelector(opts.target) || document.querySelector(opts.target);
  const tgt = root.querySelector(opts.toggles) || document.querySelector(opts.toggles);
  if (!btn || !tgt) return () => {};
  const onText  = opts.onText  ?? "Hide";
  const offText = opts.offText ?? "Show";
  const handler = () => {
    const hidden = tgt.classList.toggle("hidden");
    btn.textContent = hidden ? offText : onText;
  };
  btn.addEventListener("click", handler);
  return () => btn.removeEventListener("click", handler);
};

