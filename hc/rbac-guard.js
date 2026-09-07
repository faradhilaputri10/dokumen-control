// Guard RBAC bersama untuk halaman HC.
//
// Permission dibaca dari roles/{roleId} yang direferensikan oleh users.email.
// Mode demo tidak diblokir agar mockup tetap dapat dipresentasikan tanpa Auth.
(function () {
  var PAGE_KEYS = {
    'dashboard-hc.html': 'dashboard',
    'rekrutmen.html': 'rekrutmen',
    'data-karyawan.html': 'data_karyawan',
    'pengajuan-persetujuan.html': 'pengajuan',
    'attendance-schedule.html': 'kehadiran',
    'document.html': 'dokumen',
    'arsitektur-kompensasi.html': 'penggajian',
    'konfigurasi-penggajian.html': 'penggajian',
    'pph21-pph26-setting.html': 'penggajian',
    'payroll-karyawan-detail.html': 'penggajian',
    'rekonsiliasi-payroll.html': 'penggajian',
    'learning-center-hc.html': 'talenta',
    'performance-management-hc.html': 'talenta',
    'talent-assessment-hc.html': 'talenta',
    'user-management.html': 'user_management'
  };

  function currentPageKey() {
    return PAGE_KEYS[location.pathname.split('/').pop()] || null;
  }

  function canRead(role, key) {
    if (!role || !key) return false;
    var permission = role.permissions && role.permissions[key];
    return permission === true || !!(permission && permission.read === true);
  }

  function destinationFor(role) {
    if (canRead(role, 'dashboard')) return 'dashboard-hc.html';
    var target = Object.keys(PAGE_KEYS).find(function (page) {
      return canRead(role, PAGE_KEYS[page]);
    });
    return target || 'login-hc.html';
  }

  function showDenied(role) {
    var destination = role ? destinationFor(role) : 'login-hc.html';
    document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F8FAFC;font-family:Inter,Segoe UI,Arial,sans-serif;color:#334155;padding:24px;text-align:center;">' +
      '<div><h1 style="margin:0 0 8px;color:#0F172A;font-size:22px;">Akses ditolak</h1>' +
      '<p style="margin:0 0 18px;">Role Anda tidak memiliki hak Read untuk halaman ini.</p>' +
      '<a href="' + destination + '" style="color:#2563EB;font-weight:600;">Kembali ke halaman yang diizinkan</a></div></div>';
  }

  function applyMenu(role) {
    document.querySelectorAll('.sidebar a.menu-item[href]').forEach(function (link) {
      var page = link.getAttribute('href').split('#')[0].split('?')[0];
      var key = PAGE_KEYS[page];
      if (key && !canRead(role, key)) link.style.display = 'none';
    });
    document.querySelectorAll('.sidebar .menu-item[data-page]').forEach(function (item) {
      if (item.closest('#sub-rekrutmen') && !canRead(role, 'rekrutmen')) item.style.display = 'none';
    });
    document.querySelectorAll('.sidebar .submenu').forEach(function (submenu) {
      var visible = Array.prototype.some.call(submenu.querySelectorAll('.menu-item'), function (link) {
        return link.style.display !== 'none';
      });
      if (!visible) {
        submenu.style.display = 'none';
        if (submenu.previousElementSibling) submenu.previousElementSibling.style.display = 'none';
      }
    });
    var parentKeys = {
      'Data Master Karyawan': 'data_karyawan',
      'Penggajian': 'penggajian',
      'Pengajuan & Persetujuan': 'pengajuan',
      'Jadwal & Kehadiran': 'kehadiran',
      'Dokumen': 'dokumen',
      'Rekrutmen': 'rekrutmen',
      'Manajemen Talenta': 'talenta'
    };
    document.querySelectorAll('.sidebar .menu-item[data-tip]').forEach(function (item) {
      var label = item.getAttribute('data-tip').replace(/&amp;/g, '&');
      var key = parentKeys[label];
      if (key && !canRead(role, key)) item.style.display = 'none';
    });
  }

  async function loadRole(user) {
    var db = firebase.firestore();
    var userSnap = await db.collection('users').where('email', '==', user.email).limit(1).get();
    if (userSnap.empty) {
      // Akun bootstrap lokal dibuat sebelum user profile tersimpan.
      if (user.email === 'admin@dasaria-lokal.test') {
        var roleSnap = await db.collection('roles').where('nama', 'in', ['PCC', 'Admin HRIS', 'Super Admin']).limit(1).get();
        return roleSnap.empty ? null : Object.assign({ id: roleSnap.docs[0].id }, roleSnap.docs[0].data());
      }
      return null;
    }
    var profile = userSnap.docs[0].data();
    if (profile.status && profile.status !== 'Aktif') return null;
    var roleDoc = await db.collection('roles').doc(profile.roleId).get();
    return roleDoc.exists ? Object.assign({ id: roleDoc.id }, roleDoc.data()) : null;
  }

  async function enforce(user) {
    if (!user || typeof isConfigured === 'undefined' || !isConfigured) return;
    var role = await loadRole(user);
    if (!role) {
      showDenied(null);
      return;
    }
    window.DasariaAuth.role = role;
    applyMenu(role);
    var key = currentPageKey();
    if (key && !canRead(role, key)) showDenied(role);
  }

  function start() {
    if (typeof DasariaAuth === 'undefined') return;
    DasariaAuth.ready().then(enforce).catch(function (err) {
      console.error('RBAC gagal dimuat:', err);
      showDenied();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
