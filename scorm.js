/* Minimal SCORM 1.2 Wrapper */
(function (win) {
  var api = null;
  function findAPI(w) {
    var tries = 0;
    while ((w.API == null) && (w.parent != null) && (w.parent != w) && tries < 10) {
      tries++; w = w.parent;
    }
    return w.API || null;
  }
  function getAPI() {
    if (api) return api;
    api = findAPI(window) || (window.top && findAPI(window.top)) || null;
    if (!api && window.opener) api = findAPI(window.opener);
    return api;
  }
  var inited = false;
  var scorm = {
    init: function() { if (inited) return true; var A = getAPI(); if (A && typeof A.LMSInitialize === 'function') { inited = (String(A.LMSInitialize('')) === 'true'); return inited; } inited = true; return true; },
    get: function (k) { var A = getAPI(); if (A && typeof A.LMSGetValue === 'function') return A.LMSGetValue(k) || ''; if (k==='cmi.core.lesson_status') return 'not attempted'; return ''; },
    set: function (k, v) { var A = getAPI(); if (A && typeof A.LMSSetValue === 'function') return String(A.LMSSetValue(k, String(v))) === 'true'; return true; },
    save: function () { var A = getAPI(); if (A && typeof A.LMSCommit === 'function') return String(A.LMSCommit('')) === 'true'; return true; },
    quit: function () { var A = getAPI(); if (A && typeof A.LMSFinish === 'function') return String(A.LMSFinish('')) === 'true'; return true; }
  };
  win.scorm = scorm;
})(window);