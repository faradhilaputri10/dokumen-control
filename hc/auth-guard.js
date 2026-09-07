// Auth guard bersama untuk halaman HC (rekrutmen.html, data-karyawan.html, dst.)
//
// - Mode demo (firebase-config.js belum diisi project sungguhan): tidak melakukan apa-apa,
//   halaman tetap terbuka & bisa didemokan seperti biasa.
// - Mode live (project sudah dibuat): mewajibkan login (Firebase Authentication) sebelum
//   data dimuat. Belum login -> redirect ke login-hc.html. Sudah login -> halaman tampil
//   seperti biasa, lewat window.DasariaAuth.currentUser bisa diakses info user yang login.
//
// Cara pakai di tiap halaman HC (setelah firebase-auth-compat.js, firebase-config.js):
//   <script src="auth-guard.js"></script>
//   ...
//   DasariaAuth.ready().then(function(){ init(); });   // ganti init() langsung dengan ini

(function () {
  var overlay = null;

  function showOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'dg-auth-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:#F8FAFC;z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;' +
      'font-family:Inter,"Segoe UI",Arial,sans-serif;color:#64748B;font-size:13px;';
    overlay.textContent = 'Memeriksa sesi login…';
    document.body.appendChild(overlay);
  }

  function hideOverlay() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  function ensureApp() {
    dasariaInitFirebase();
  }

  var readyPromise = null;

  function ready() {
    if (readyPromise) return readyPromise;

    if (!isConfigured) {
      readyPromise = Promise.resolve(null);
      return readyPromise;
    }

    showOverlay();
    ensureApp();

    readyPromise = new Promise(function (resolve) {
      firebase.auth().onAuthStateChanged(function (user) {
        if (!user) {
          var next = encodeURIComponent(location.pathname.split('/').pop() + location.hash);
          location.href = 'login-hc.html?next=' + next;
          return; // overlay tetap tampil sampai browser pindah halaman
        }
        window.DasariaAuth.currentUser = user;
        hideOverlay();
        resolve(user);
      });
    });
    return readyPromise;
  }

  function logout() {
    if (!isConfigured) { location.href = 'login-hc.html'; return; }
    ensureApp();
    firebase.auth().signOut().then(function () { location.href = 'login-hc.html'; });
  }

  window.DasariaAuth = { ready: ready, logout: logout, currentUser: null };
})();
