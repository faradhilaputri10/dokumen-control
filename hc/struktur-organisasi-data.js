// Data master Struktur & Organisasi bersama — SATU sumber untuk dashboard-hc.html
// (halaman "Struktur dan Organisasi", tab Kantor/Direktorat/Divisi/Departemen/Unit/Posisi
// Pegawai) dan rekrutmen.html (dropdown Working Area/Lokasi Kerja/Direktorat/Divisi/
// Departemen/Job Title di form Offering Letter). Sebelum file ini ada, kedua halaman itu
// punya datanya sendiri-sendiri (dashboard-hc.html: tabel HTML statis; rekrutmen.html:
// `ORG_MASTER` versi ringkas/karangan sendiri, TIDAK sinkron) -- sekarang disatukan di sini
// supaya kalau data berubah, cukup diedit 1 tempat.
//
// SUMBER data ini: isi tabel yang SUDAH ADA di dashboard-hc.html (disalin apa adanya, bukan
// ditebak/dikarang baru). Beberapa tabel di dashboard-hc.html punya label pagination lebih
// besar dari jumlah baris yang benar-benar ada (mis. Unit "1-10 dari 14", Divisi "dari 12",
// Departemen "dari 24") -- pagination-nya dekoratif/belum fungsional, baris sisanya memang
// belum pernah diisi di mockup ini. Yang disalin ke bawah HANYA baris yang benar-benar ada.
// Kalau nanti ditambah di dashboard-hc.html, tambah juga entrinya di sini -- kedua halaman
// otomatis ikut update.
//
// CATATAN KUALITAS DATA (bukan dibuat-buat, ini apa adanya di sumbernya): tabel Departemen &
// Posisi Pegawai di dashboard-hc.html mereferensikan beberapa nama Divisi/Departemen yang
// TIDAK ada di tabel Divisi/Departemen itu sendiri (mis. "Human Capital Division",
// "Business Operations Department", "Compensation & Benefits") -- kemungkinan baris itu
// termasuk 2 Divisi & 14 Departemen yang belum sempat diisi (lihat paragraf di atas). Baris
// begini tetap disalin apa adanya (tidak diperbaiki sepihak) -- akibatnya kalau dipilih lewat
// cascading dropdown Direktorat->Divisi->Departemen, entri Departemen dengan induk Divisi yang
// tidak terdaftar itu tidak akan pernah muncul (induknya tidak ada di pilihan Divisi).
//
// Ditulis sebagai script biasa (bukan ES module) supaya bisa dibuka langsung lewat file://
// sama seperti file JS bersama lainnya (data-layer.js, sidebar-toggle.js).

var STRUKTUR_KANTOR = [
  { nama: 'Head Office', deskripsi: 'Kantor pusat, tempat utama pengelolaan dan pengambilan keputusan perusahaan.' },
  { nama: 'Branch', deskripsi: 'Kantor cabang atau bagian dari perusahaan yang berada di lokasi lain.' }
];

var STRUKTUR_KEMITRAAN_DEFAULT = [
  { nama: 'PBKK', deskripsi: 'Perjanjian kerja sama kemitraan khusus' },
  { nama: 'PBP', deskripsi: 'Perjanjian bisnis partnership' },
  { nama: 'PMTR', deskripsi: 'Perjanjian mitra tenaga kerja' },
  { nama: 'MMIN', deskripsi: 'Mitra mandiri' }
];
var STRUKTUR_KEMITRAAN = (function(){
  try {
    var saved = JSON.parse(localStorage.getItem('dasaria.jenisKerjasama') || 'null');
    return Array.isArray(saved) ? saved : STRUKTUR_KEMITRAAN_DEFAULT.slice();
  } catch (err) {
    console.warn('Master Jenis Kerjasama lokal tidak dapat dibaca:', err);
    return STRUKTUR_KEMITRAAN_DEFAULT.slice();
  }
})();
function saveStrukturKemitraan(items){
  STRUKTUR_KEMITRAAN = items;
  localStorage.setItem('dasaria.jenisKerjasama', JSON.stringify(items));
  window.STRUKTUR_KEMITRAAN = STRUKTUR_KEMITRAAN;
}

var STRUKTUR_UNIT = [
  { nama: 'Pakis', departemen: 'Regional Department' },
  { nama: 'Bumiaji', departemen: 'Regional Department' },
  { nama: 'Blimbing', departemen: 'Regional Department' },
  { nama: 'Kedungkandang', departemen: 'Regional Department' },
  { nama: 'Kota Lama', departemen: 'Regional Department' },
  { nama: 'Sawojajar', departemen: 'Regional Department' },
  { nama: 'Pasuruan', departemen: 'Regional Department' },
  { nama: 'Temas', departemen: 'Regional Department' },
  { nama: 'Junrejo', departemen: 'Regional Department' },
  { nama: 'Karangploso', departemen: 'Regional Department' }
];

var STRUKTUR_DIREKTORAT = [
  'Finance, Tax, And Accounting',
  'People Corporate Compliance',
  'Information Technology',
  'Business Development',
  'Commercial',
  'General Services & Supply Chain',
  'Network Operation Center'
];

var STRUKTUR_DIVISI = [
  { nama: 'General Services & Supply Chain Division', direktorat: 'General Services & Supply Chain' },
  { nama: 'Information Technology Division', direktorat: 'Information Technology' },
  { nama: 'Finance, Tax And Accounting', direktorat: 'Finance, Tax, And Accounting' },
  { nama: 'Business Governance & Innovation', direktorat: 'Business Development' },
  { nama: 'Commercial Strategic & Partner', direktorat: 'Commercial' },
  { nama: 'Network Operation Center', direktorat: 'Network Operation Center' },
  { nama: 'Customer Experience', direktorat: 'Commercial' },
  { nama: 'Network Infrastructure', direktorat: 'Commercial' },
  { nama: 'Corporate Regulatory Compliance', direktorat: 'People Corporate Compliance' },
  { nama: 'Sales Marketing', direktorat: 'Commercial' }
];

var STRUKTUR_DEPARTEMEN = [
  { nama: 'Banner Installer Department', divisi: 'Sales Marketing' },
  { nama: 'Customer Care Department', divisi: 'Customer Experience' },
  { nama: 'People Culture Operation', divisi: 'Human Capital Division' },
  { nama: 'Core Network Infrastructure', divisi: 'Network Infrastructure' },
  { nama: 'Core Systems Department', divisi: 'Information Technology Division' },
  { nama: 'Accounting', divisi: 'Finance, Tax And Accounting' },
  { nama: 'Tax', divisi: 'Finance, Tax And Accounting' },
  { nama: 'Corporate & Legal Strategic', divisi: 'Corporate Regulatory Compliance' },
  { nama: 'Strategic Growth & Product', divisi: 'Business Governance & Innovation' },
  { nama: 'Warehouse Management & Infrastructure Service', divisi: 'General Services & Supply Chain Division' }
];

// Posisi Pegawai -- dipakai sebagai saran (datalist) untuk Job Title di form Offering, BUKAN
// dropdown tertutup: cuma 6 posisi nyata terdaftar di sumbernya, jauh lebih sedikit dari
// ragam Job Title yang akan dipakai TA sehari-hari, jadi TA tetap bisa ketik bebas.
var STRUKTUR_POSISI = [
  { nama: 'Frontend Developer', direktorat: 'Information Technology', divisi: 'Information Technology Division', departemen: 'Core Systems Department' },
  { nama: 'UI/UX Designer', direktorat: 'Information Technology', divisi: 'Information Technology Division', departemen: 'Business Operations Department' },
  { nama: 'Principal of Commercial Strategic & Partner', direktorat: 'Commercial', divisi: 'Commercial Strategic & Partner', departemen: 'Commercial Strategic & Partner' },
  { nama: 'Benefit & Rewards Analyst', direktorat: 'People Corporate Compliance', divisi: 'Human Capital Division', departemen: 'Compensation & Benefits' },
  { nama: 'UI/UX Designer', direktorat: 'Information Technology', divisi: 'Information Technology Division', departemen: 'Business Operations Department' },
  { nama: 'Customer Care Officer', direktorat: 'Commercial', divisi: 'Customer Experience', departemen: 'Customer Care Department' }
];

window.STRUKTUR_KANTOR = STRUKTUR_KANTOR;
window.STRUKTUR_KEMITRAAN = STRUKTUR_KEMITRAAN;
window.saveStrukturKemitraan = saveStrukturKemitraan;
window.STRUKTUR_UNIT = STRUKTUR_UNIT;
window.STRUKTUR_DIREKTORAT = STRUKTUR_DIREKTORAT;
window.STRUKTUR_DIVISI = STRUKTUR_DIVISI;
window.STRUKTUR_DEPARTEMEN = STRUKTUR_DEPARTEMEN;
window.STRUKTUR_POSISI = STRUKTUR_POSISI;
