// sidebar-toggle.js — ciutkan/lebarkan sidebar, dipakai identik di SEMUA halaman mgmt/hc/*.html.
// Sidebar-nya sendiri di-copy-paste inline di tiap file (lihat komentar "SIDEBAR (shared across
// all HC modules)" di dashboard-hc.html) - bukan komponen bersama seperti sidebar.js di app Doc
// Control. Supaya fitur ciutkan/lebarkan TETAP tidak perlu logic ditulis ulang di tiap halaman,
// semua perilakunya (CSS collapsed, wrap teks label jadi <span> supaya bisa disembunyikan
// terpisah dari ikon SVG-nya, tombol toggle, localStorage) hidup di SATU file ini. Satu-satunya
// yang perlu ditambahkan ke tiap halaman adalah satu baris <script src="sidebar-toggle.js">.

(function () {
  var STORAGE_KEY = 'ess_hc_sidebar_collapsed';

  function isCollapsed() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }
  function setCollapsed(v) {
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch (e) { /* localStorage diblokir - biarkan default lebar */ }
  }

  // CSS collapsed disuntik lewat <style> di <head>, bukan diedit di tiap file - target class
  // ".sidebar.collapsed" tidak pernah bentrok dengan CSS asli tiap halaman (namanya baru).
  // "!important" pada .submenu perlu karena baris itu sudah punya inline style="display:..."
  // per item (dipakai toggleSubmenu() bawaan halaman) yang kalau tidak menang akan tetap
  // membuka submenu di lebar 76px.
  function injectStyle() {
    var style = document.createElement('style');
    style.textContent =
      '.sidebar{transition:width .15s ease;}' +
      '.sidebar.collapsed{width:76px;}' +
      '.sidebar.collapsed .mi-label,' +
      '.sidebar.collapsed .name,' +
      '.sidebar.collapsed .menu-label,' +
      '.sidebar.collapsed .submenu-label,' +
      '.sidebar.collapsed .chev,' +
      '.sidebar.collapsed .u-name,' +
      '.sidebar.collapsed .u-role{display:none!important;}' +
      '.sidebar.collapsed .submenu{display:none!important;}' +
      // Ditemukan 2026-08-29: aturan di atas (perlu, supaya submenu tidak numpuk kepaksa masuk
      // 76px) sebagai efek samping membuat SEMUA menu yang punya submenu (Dokumen, Rekrutmen,
      // Penggajian, dst.) TIDAK BISA DIAKSES SAMA SEKALI saat sidebar diciutkan -- klik parent-nya
      // tidak pernah menampilkan apa pun. Perbaikannya: submenu yang lagi "open" (ditandai JS
      // repositionFlyouts() di bawah lewat class .sb-flyout) ditampilkan sebagai panel MELAYANG
      // di samping ikonnya (bukan diperlebar di tempat) -- pola submenu standar untuk sidebar
      // yang diciutkan, sekarang benar-benar bisa diklik & dipakai lagi.
      // TIDAK diawali ".sidebar.collapsed" (beda dari aturan lain di sini) -- openFlyout_() JS
      // memindah elemen ini jadi anak <body> (lihat komentar di sana), jadi begitu dipindah dia
      // BUKAN LAGI descendant .sidebar sama sekali; selector yang mensyaratkan ".sidebar.collapsed"
      // di depan tidak akan pernah cocok lagi & seluruh styling ini (termasuk position:fixed)
      // gagal diterapkan -- gejalanya teks flyout melayang transparan tanpa kotak putih/bayangan
      // sama sekali (ketemu 2026-08-29 lewat screenshot, computed style sempat kelihatan benar
      // karena position/left/top disetel manual lewat inline style, cuma background/border/dst.
      // yang hilang karena rule CSS-nya tidak pernah match).
      '.submenu.sb-flyout{display:block!important;position:fixed;width:230px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 12px 32px rgba(15,23,42,.16);padding:6px;z-index:250;}' +
      '.submenu.sb-flyout .menu-item{justify-content:flex-start!important;margin:1px 0!important;padding:9px 12px!important;font-size:13.5px!important;}' +
      '.submenu.sb-flyout .mi-label{display:inline!important;}' +
      '.sidebar.collapsed .brand{justify-content:center;padding:20px 8px 16px;}' +
      '.sidebar.collapsed .menu-item{justify-content:center;margin:2px 8px;padding:9px;gap:0;}' +
      '.sidebar.collapsed .sidebar-user{justify-content:center;}' +
      '.sb-toggle-btn{display:flex;align-items:center;gap:10px;width:calc(100% - 24px);margin:4px 12px 8px;padding:9px 12px;border:none;background:transparent;border-radius:8px;cursor:pointer;color:#475569;font-family:inherit;font-size:13px;}' +
      '.sb-toggle-btn:hover{background:#f7f8fa;}' +
      '.sidebar.collapsed .sb-toggle-btn{justify-content:center;width:auto;margin:4px 8px 8px;padding:9px;}' +
      '.sb-toggle-btn svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.8;flex-shrink:0;}' +
      '.sidebar.collapsed .sb-toggle-btn span{display:none;}';
    document.head.appendChild(style);
  }

  // Bungkus tiap text node langsung di dalam .menu-item jadi <span class="mi-label"> - teks menu
  // sekarang ditulis polos (bukan di dalam span) di markup asli tiap halaman, jadi tidak ada cara
  // CSS murni untuk menyembunyikan TEKS-nya saja tanpa ikut menyembunyikan <svg> ikonnya. Aman
  // dipanggil berkali-kali (idempotent) - text node yang sudah dibungkus tidak dibungkus ulang.
  function wrapMenuLabels() {
    document.querySelectorAll('.sidebar .menu-item').forEach(function (item) {
      Array.prototype.slice.call(item.childNodes).forEach(function (node) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
          var span = document.createElement('span');
          span.className = 'mi-label';
          item.replaceChild(span, node);
          span.appendChild(node);
        }
      });
    });
  }

  function applyState(sidebar, collapsed) {
    sidebar.classList.toggle('collapsed', collapsed);
    var btn = sidebar.querySelector('.sb-toggle-btn');
    if (btn) {
      btn.querySelector('span').textContent = collapsed ? 'Perluas' : 'Ciutkan';
      btn.querySelector('svg').innerHTML = collapsed
        ? '<path d="M9 6l6 6-6 6"/>'
        : '<path d="M15 6l-6 6 6 6"/>';
      btn.title = collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar';
    }
    if (!collapsed) closeAllFlyouts(); // balik ke lebar penuh -- bersihkan style flyout sisa
  }

  // Daftar TETAP semua <div class="submenu"> milik sidebar ini, dikumpulkan SEKALI di init()
  // sebelum ada yang dipindah ke <body> (lihat openFlyout_ di bawah) -- dipakai closeAllFlyouts/
  // repositionFlyouts supaya tetap bisa menjangkau submenu yang saat ini sudah tidak lagi jadi
  // anak DOM sidebar (querySelector('.sidebar .submenu') tidak akan menemukannya lagi setelah
  // dipindah, makanya daftar ini dibuat TETAP, bukan di-query ulang tiap panggil).
  var allSubmenus = [];

  /** Simpan anchor (comment node kosong) tepat di posisi asli submenu di DOM, sekali saja per
      submenu -- dipakai openFlyout_/closeFlyout_ untuk tahu ke mana harus dikembalikan setelah
      dipindah ke <body>. previousElementSibling tetap benar dipanggil SEBELUM/SESUDAH anchor
      disisipkan (anchor berupa comment node, diabaikan previousElementSibling). */
  function setupFlyoutAnchor_(sub) {
    if (sub.__sbAnchor) return;
    var anchor = document.createComment('sb-flyout-anchor');
    sub.parentNode.insertBefore(anchor, sub);
    sub.__sbAnchor = anchor;
    sub.__sbTrigger = sub.previousElementSibling; // menu-item yang men-toggle submenu ini
  }

  /**
   * Pindahkan submenu jadi anak langsung <body> lalu posisikan position:fixed di samping kanan
   * menu induknya. WAJIB dipindah keluar dari <div class="sidebar"> (bukan cuma diberi
   * position:fixed di tempat) -- ditemukan 2026-08-29: `.sidebar` sendiri `position:sticky`,
   * dan itu membuat descendant position:fixed-nya TERJEBAK dalam stacking context sidebar
   * (z-index setinggi apa pun tetap kalah/ketutup konten halaman lain, mis. #funnel-body di
   * Dashboard) alih-alih benar-benar escape ke lapisan atas viewport seperti position:fixed
   * seharusnya. Pindah ke <body> menghilangkan masalah itu total -- sama seperti perbaikan
   * drawer offering-detail-drawer/rr-detail-drawer sebelumnya (harus di luar .app/.content).
   */
  function openFlyout_(sub) {
    setupFlyoutAnchor_(sub);
    if (sub.parentNode !== document.body) document.body.appendChild(sub);
    if (!sub.__sbTrigger) return;
    var rect = sub.__sbTrigger.getBoundingClientRect();
    sub.classList.add('sb-flyout');
    sub.style.position = 'fixed';
    sub.style.left = (rect.right + 6) + 'px';
    sub.style.top = rect.top + 'px';
  }

  /** Kembalikan submenu ke posisi asli di sidebar (pakai anchor), reset semua style flyout, DAN
      samakan sub.style.display jadi 'none' -- toggleSubmenu() bawaan tiap halaman cuma cek
      "display !== 'none'" untuk tahu status buka/tutup, jadi ini WAJIB disamakan; kalau cuma
      tampilan flyout-nya yang disembunyikan tapi display:block dibiarkan, klik BERIKUTNYA di
      parent-nya dikira "masih terbuka" dan langsung menutup lagi alih-alih membuka flyout baru
      (ditemukan 2026-08-29 saat tes). */
  function closeFlyout_(sub) {
    sub.classList.remove('sb-flyout');
    sub.style.position = ''; sub.style.left = ''; sub.style.top = '';
    sub.style.display = 'none';
    if (sub.__sbTrigger) sub.__sbTrigger.classList.remove('open');
    if (sub.__sbAnchor && sub.__sbAnchor.parentNode && sub.parentNode !== sub.__sbAnchor.parentNode) {
      sub.__sbAnchor.parentNode.insertBefore(sub, sub.__sbAnchor.nextSibling);
    }
  }

  // BUG DITEMUKAN 30 Ags 2026 (laporan langsung user: submenu yang lagi terbuka tertutup lagi
  // sendiri begitu pindah halaman) -- kondisi ini dulu JUGA mencocokkan submenu yang cuma
  // "display:block" BIASA (mis. submenu halaman ini sendiri, di-hardcode terbuka di markup
  // asli tiap file), bukan cuma flyout sungguhan (sudah dipindah ke <body>, class .sb-flyout).
  // applyState() memanggil closeAllFlyouts() SETIAP init() (tiap page load, bukan cuma saat
  // toggle ciutkan/lebarkan), jadi submenu halaman aktif yang seharusnya tetap terbuka malah
  // ikut ditutup paksa tiap kali halaman baru dimuat. Cek SEKARANG cuma class .sb-flyout --
  // itu satu-satunya penanda submenu sungguh sudah jadi flyout (lihat openFlyout_/
  // repositionFlyouts, keduanya selalu menambahkan class ini sebelum/saat submenu dipindah).
  function closeAllFlyouts() {
    allSubmenus.forEach(function (sub) {
      if (sub.classList.contains('sb-flyout')) closeFlyout_(sub);
    });
  }

  /** Submenu yang lagi "open" (style.display sudah di-set 'block' oleh toggleSubmenu() bawaan
      tiap halaman) diposisikan sebagai flyout tepat di samping kanan menu induknya -- dipanggil
      tiap kali ada klik di dalam sidebar saat keadaan diciutkan, supaya posisinya selalu akurat
      mengikuti item mana yang baru diklik (setiap menu ada di ketinggian/posisi Y berbeda). */
  function repositionFlyouts(sidebar) {
    if (!sidebar.classList.contains('collapsed')) { return; }
    allSubmenus.forEach(function (sub) {
      var isOpen = sub.style.display === 'block';
      if (isOpen) openFlyout_(sub); else if (sub.classList.contains('sb-flyout')) closeFlyout_(sub);
    });
  }

  /**
   * Buka otomatis submenu yang berisi link ke HALAMAN INI (30 Ags 2026, laporan langsung user:
   * submenu yang dibuka manual tertutup lagi begitu pindah ke halaman lain di dalamnya). Akar
   * masalahnya: tiap halaman HARUSNYA hardcode submenu-nya sendiri jadi style="display:block"
   * di markup asli, tapi 14+ file salinan sidebar rawan tidak konsisten/lupa. Dicek lewat href
   * (bukan class .active yang disetel skrip tiap halaman sendiri -- itu bisa belum sempat
   * jalan duluan sebelum baris ini, race condition), jadi selalu akurat berapa pun urutan
   * script tiap halaman.
   */
  function openSubmenuForCurrentPage(sidebar) {
    var currentFile = location.pathname.split('/').pop();
    allSubmenus.forEach(function (sub) {
      var links = sub.querySelectorAll('.menu-item[href]');
      var hasMatch = Array.prototype.some.call(links, function (a) {
        var hrefFile = a.getAttribute('href').split('#')[0].split('?')[0];
        return hrefFile === currentFile;
      });
      if (hasMatch) {
        sub.style.display = 'block';
        if (sub.__sbTrigger) sub.__sbTrigger.classList.add('open');
      }
    });
  }

  function init() {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    injectStyle();
    wrapMenuLabels();
    allSubmenus = Array.prototype.slice.call(sidebar.querySelectorAll(':scope > .submenu'));
    allSubmenus.forEach(setupFlyoutAnchor_);
    if (!isCollapsed()) openSubmenuForCurrentPage(sidebar);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sb-toggle-btn';
    btn.innerHTML = '<svg viewBox="0 0 24 24"></svg><span></span>';
    btn.addEventListener('click', function () {
      var next = !sidebar.classList.contains('collapsed');
      setCollapsed(next);
      applyState(sidebar, next);
    });

    var foot = sidebar.querySelector('.sidebar-foot');
    if (foot) sidebar.insertBefore(btn, foot); else sidebar.appendChild(btn);

    applyState(sidebar, isCollapsed());

    // Klik apa pun di dalam sidebar (mis. klik "Dokumen" untuk toggleSubmenu() bawaan halaman)
    // -- tunggu 1 tick (setTimeout 0) supaya onclick asli halaman itu SUDAH SELESAI menyetel
    // style.display submenu-nya duluan, baru reposisi jadi flyout berdasarkan display terbaru.
    sidebar.addEventListener('click', function () {
      setTimeout(function () { repositionFlyouts(sidebar); }, 0);
    });
    // Klik di LUAR sidebar DAN di luar flyout yang lagi terbuka -- tutup semua flyout (perilaku
    // umum popover). Flyout dicek terpisah karena elemennya sekarang anak <body> (dipindah oleh
    // openFlyout_), bukan lagi descendant .sidebar -- sidebar.contains() saja tidak cukup, kalau
    // tidak klik LINK di dalam flyout sendiri akan salah dianggap "klik di luar".
    document.addEventListener('click', function (e) {
      if (sidebar.contains(e.target)) return;
      if (e.target.closest && e.target.closest('.submenu.sb-flyout')) return;
      closeAllFlyouts();
    });
    // Resize/scroll bisa bikin posisi flyout basi (sidebar sticky ikut bergeser) -- reposisi ulang.
    window.addEventListener('resize', function () { repositionFlyouts(sidebar); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
