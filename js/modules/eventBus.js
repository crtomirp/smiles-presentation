(function () {
  const listeners = {};
  window.CourseBus = {
    on(evt, fn) { (listeners[evt] ||= new Set()).add(fn); return () => listeners[evt].delete(fn); },
    emit(evt, payload) {
      const group = listeners[evt]; if (!group) return;
      group.forEach(fn => { try { fn(payload); } catch (e) { console.warn("CourseBus handler error", e); } });
    }
  };
})();
