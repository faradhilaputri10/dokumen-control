// Konfigurasi project Firebase Dasaria.
//
// Versi publik (GitHub Pages): sengaja TIDAK diisi kredensial project Firebase asli,
// supaya demo publik tidak pernah menyentuh data/kuota project sungguhan.
// Seluruh halaman HC tetap bisa dibuka & dicoba seperti biasa -- data disimpan
// sementara di browser (localStorage), bukan hilang/error.
//
// Ditulis sebagai script biasa (bukan ES module) supaya halaman tetap bisa dibuka
// langsung dengan dobel-klik (file://), sama seperti seluruh halaman HC lainnya.

var firebaseConfig = {
  apiKey: "GANTI_SETELAH_BUAT_PROJECT",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

var isConfigured = firebaseConfig.apiKey !== "GANTI_SETELAH_BUAT_PROJECT" && !!firebaseConfig.apiKey;

var USE_LOCAL_EMULATOR = isConfigured && (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '::1');

/** Panggil ini (bukan firebase.initializeApp langsung) di setiap titik yang menginisialisasi Firebase. */
function dasariaInitFirebase() {
  if (dasariaInitFirebase._done) return;
  dasariaInitFirebase._done = true;
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  if (USE_LOCAL_EMULATOR) {
    if (firebase.firestore) firebase.firestore().useEmulator('127.0.0.1', 8080);
    if (firebase.auth) firebase.auth().useEmulator('http://127.0.0.1:9099', { disableWarnings: true });
  }
}

function dasariaCreateAuthUser(email, password) {
  var secondaryApp = firebase.initializeApp(firebaseConfig, 'dasaria-secondary-' + Date.now());
  if (USE_LOCAL_EMULATOR) secondaryApp.auth().useEmulator('http://127.0.0.1:9099', { disableWarnings: true });
  return secondaryApp.auth().createUserWithEmailAndPassword(email, password)
    .then(function (cred) {
      return secondaryApp.auth().signOut()
        .then(function () { return secondaryApp.delete(); })
        .then(function () { return cred.user; });
    })
    .catch(function (err) {
      return secondaryApp.delete().catch(function () {}).then(function () { throw err; });
    });
}

/** Isi badge status koneksi data di topbar (elemen id="data-mode-badge") -- sama di semua halaman HC. */
function dasariaRenderDataModeBadge() {
  var el = document.getElementById('data-mode-badge');
  if (!el) return;
  if (USE_LOCAL_EMULATOR) { el.textContent = '🔵 Simulasi lokal'; el.className = 'data-mode emulator'; }
  else if (isConfigured) { el.textContent = '🟢 Firestore live'; el.className = 'data-mode live'; }
  else { el.textContent = '🟡 Mode demo (localStorage)'; el.className = 'data-mode demo'; }
}
