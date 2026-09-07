// sidebar-badges.js — angka notifikasi kecil di menu sidebar (mis. "Review dan Riwayat" & "Pengajuan
// Offering") yang menghitung pengajuan offering_submissions yang masih menunggu aksi, dipakai identik
// di SEMUA halaman mgmt/hc/*.html sama seperti sidebar-toggle.js (lihat komentar di file itu).
//
// Kenapa terpisah dari data yang sudah dimuat document.html/rekrutmen.html sendiri: badge ini harus
// tetap muncul di sidebar walau user sedang berada di halaman LAIN (mis. Dashboard HC) supaya dia tahu
// ada pengajuan yang perlu ditindaklanjuti sebelum masuk ke modul Dokumen/Penggajian — jadi query
// Firestore-nya independen, bukan menunggu variabel milik halaman aktif.
//
// Aman dipanggil di halaman yang belum tersambung Firestore (belum ada firebase-config.js/data-layer.js
// di <head>) -- langsung diam (tidak ada badge) kalau dependency itu tidak ada, bukan error.

(function () {
  var CRC_BADGE_ID = 'badge-reviewriwayat';
  var COMBEN_BADGE_ID = 'badge-pengajuan-offering';

  function injectStyle() {
    var style = document.createElement('style');
    style.textContent =
      '.menu-badge{display:none;align-items:center;justify-content:center;min-width:17px;height:17px;' +
      'padding:0 5px;margin-left:auto;border-radius:999px;background:#DC2626;color:#fff;font-size:10.5px;' +
      'font-weight:700;font-family:"Inter",sans-serif;line-height:17px;text-align:center;flex-shrink:0;}' +
      '.menu-badge.show{display:inline-flex;}' +
      '.sidebar.collapsed .menu-badge{display:none!important;}';
    document.head.appendChild(style);
  }

  function setBadge(id, count) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!count) { el.classList.remove('show'); el.textContent = ''; return; }
    el.textContent = count > 99 ? '99+' : String(count);
    el.classList.add('show');
  }

  function isPending(stage) {
    return !!stage && stage.status === 'proses';
  }

  function computeCounts(subs) {
    var crc = 0, comben = 0;
    subs.forEach(function (sub) {
      if (!sub || sub.status === 'draft' || !sub.stages) return;
      if (isPending(sub.stages.reviewCRC)) crc++;
      if (isPending(sub.stages.reviewComBen)) comben++;
    });
    return { crc: crc, comben: comben };
  }

  function loadAndRender() {
    if (!window.DasariaData || !window.DasariaData.getCollection) return;
    window.DasariaData.getCollection('offering_submissions', []).then(function (subs) {
      var counts = computeCounts(subs || []);
      setBadge(CRC_BADGE_ID, counts.crc);
      setBadge(COMBEN_BADGE_ID, counts.comben);
    }).catch(function () {
      // Belum login / rules menolak (permission-denied) / offline -- diamkan saja, badge tetap tersembunyi.
    });
  }

  function init() {
    if (!document.getElementById(CRC_BADGE_ID) && !document.getElementById(COMBEN_BADGE_ID)) return;
    injectStyle();
    if (typeof firebase === 'undefined' || typeof isConfigured === 'undefined' || !isConfigured) return;
    dasariaInitFirebase();
    firebase.auth().onAuthStateChanged(function (user) {
      if (user) loadAndRender();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
