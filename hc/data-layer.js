// Lapisan data bersama untuk seluruh halaman HC.
//
// Kenapa file ini ada: supaya tiap halaman (data-karyawan.html, rekrutmen.html, dst.)
// tidak perlu tahu apakah project Firebase sudah dibuat atau belum.
//   - Kalau firebase-config.js SUDAH diisi -> baca/tulis ke Firestore sungguhan
//     (lewat Firebase "compat" SDK yang dimuat di <head> tiap halaman).
//   - Kalau BELUM -> baca/tulis ke localStorage browser, supaya mockup tetap bisa
//     dibuka & didemokan kapan pun tanpa menunggu setup Firebase selesai.
//
// Ditulis sebagai script biasa (bukan ES module import/export) supaya halaman tetap
// bisa dibuka langsung dengan dobel-klik (file://) — module JS diblokir browser saat
// dibuka lewat file://, script biasa tidak.
//
// Dipakai lewat: window.DasariaData.getCollection(...) / addDocument(...) / updateDocument(...)

(function () {
  var db = null;

  function ensureDb() {
    if (!isConfigured) return null;
    if (db) return db;
    dasariaInitFirebase();
    db = firebase.firestore();
    return db;
  }

  function demoKey(collectionName) {
    return 'dasaria_demo_' + collectionName;
  }

  function readDemo(collectionName, seedData) {
    var raw = localStorage.getItem(demoKey(collectionName));
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* fall through to reseed */ }
    }
    localStorage.setItem(demoKey(collectionName), JSON.stringify(seedData));
    return seedData.slice();
  }

  function writeDemo(collectionName, items) {
    localStorage.setItem(demoKey(collectionName), JSON.stringify(items));
  }

  // ===== Cache ringan sessionStorage untuk countMatching() =====
  // Kenapa di sini (bukan queryPage): angka hitung (jumlah per tahap, KPI Dashboard) aman
  // di-cache -- cuma angka polos, dipanggil ULANG-ULANG di render yang sama (tiap ganti tab,
  // tiap reload halaman dalam sesi browser yang sama). queryPage() SENGAJA tidak di-cache di
  // sini -- hasilnya membawa `cursor` (snapshot Firestore mentah, tidak bisa disimpan ke
  // sessionStorage) yang dipakai tombol "Berikutnya"; kalau di-cache serampangan, klik
  // "Berikutnya" bisa salah mengembalikan halaman 1 lagi alih-alih halaman 2. sessionStorage
  // (bukan localStorage) supaya otomatis bersih begitu tab/window ditutup -- tidak menyimpan
  // data lama selamanya.
  var COUNT_CACHE_TTL_MS = 2 * 60 * 1000; // 2 menit -- cukup untuk hindari query ulang tiap ganti tab, cukup pendek supaya tidak terlalu basi
  function countCacheKey_(collectionName, whereClauses) {
    return 'dasaria_cnt_' + collectionName + '_' + JSON.stringify(whereClauses || []);
  }
  function countCacheGet_(key) {
    try {
      var raw = sessionStorage.getItem(key);
      if (!raw) return undefined;
      var parsed = JSON.parse(raw);
      if (Date.now() > parsed.expiresAt) { sessionStorage.removeItem(key); return undefined; }
      return parsed.value;
    } catch (e) { return undefined; }
  }
  function countCacheSet_(key, value) {
    try { sessionStorage.setItem(key, JSON.stringify({ value: value, expiresAt: Date.now() + COUNT_CACHE_TTL_MS })); } catch (e) { /* penuh/diblokir browser -- aman diabaikan, cuma kehilangan cache */ }
  }
  /** Buang cache hitung untuk 1 koleksi (panggil setelah tulis data ke koleksi itu, mis. ubah tahap kandidat). */
  function invalidateCountCache(collectionName) {
    try {
      var prefix = 'dasaria_cnt_' + collectionName + '_';
      Object.keys(sessionStorage).filter(function (k) { return k.indexOf(prefix) === 0; }).forEach(function (k) { sessionStorage.removeItem(k); });
    } catch (e) { /* aman diabaikan */ }
  }

  /** Ambil seluruh dokumen dalam satu koleksi. seedData dipakai hanya saat mode demo & belum ada data tersimpan. */
  async function getCollection(collectionName, seedData) {
    var _db = ensureDb();
    if (_db) {
      var snap = await _db.collection(collectionName).get();
      return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    }
    return readDemo(collectionName, seedData);
  }

  /**
   * Bungkus 1 nilai jadi format Value REST Firestore (dipakai runAggregationQueryRest_).
   * Cukup untuk kebutuhan filter equality sederhana yang dipakai countMatching().
   */
  function wrapFirestoreValue_(v) {
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (v === null || v === undefined) return { nullValue: null };
    return { stringValue: String(v) };
  }

  /**
   * Hitung dokumen lewat REST API `runAggregationQuery` langsung -- BUKAN lewat SDK
   * `.count()`, karena build compat SDK yang dimuat dari CDN di halaman ini (dites langsung,
   * dikonfirmasi lewat inspeksi prototype Query) TIDAK menyediakan method `.count` sama sekali
   * (cuma where/orderBy/limit/get/onSnapshot/dst.) -- kemungkinan `.count()` cuma ada di build
   * modular/bundler, tidak diekspor ke build compat CDN. Ini agregasi Firestore asli (dihitung
   * di server, TIDAK download dokumen) — bukan `.get()` lalu `.length` (yang biayanya sama
   * dengan baca semua dokumen, menghilangkan seluruh tujuan §Perf).
   */
  async function runAggregationQueryRest_(collectionName, whereClauses) {
    var user = firebase.auth().currentUser;
    if (!user) throw new Error('countMatching: butuh login (request.auth) sesuai firestore.rules.');
    var token = await user.getIdToken();
    var filters = (whereClauses || []).map(function (w) {
      return { fieldFilter: { field: { fieldPath: w[0] }, op: 'EQUAL', value: wrapFirestoreValue_(w[2]) } };
    });
    var structuredQuery = { from: [{ collectionId: collectionName }] };
    if (filters.length === 1) structuredQuery.where = filters[0];
    else if (filters.length > 1) structuredQuery.where = { compositeFilter: { op: 'AND', filters: filters } };
    // Saat simulasi lokal aktif, Firestore SDK biasa dialihkan ke emulator lewat useEmulator()
    // (lihat dasariaInitFirebase()) -- tapi fetch() manual di sini TIDAK ikut teralihkan otomatis
    // (bukan lewat SDK), jadi kalau URL-nya tetap hardcode ke server asli, query ini akan gagal
    // total di mode lokal (token dari Auth emulator ditolak server asli) -- dan karena
    // fetchStageCounts() route ini di-await langsung di init(), gagalnya di sini bikin SELURUH
    // render halaman Kandidat (termasuk tabelnya) ikut berhenti, bukan cuma badge hitungannya.
    var url = (typeof USE_LOCAL_EMULATOR !== 'undefined' && USE_LOCAL_EMULATOR ? 'http://127.0.0.1:8080' : 'https://firestore.googleapis.com') +
      '/v1/projects/' + firebaseConfig.projectId + '/databases/(default)/documents:runAggregationQuery';
    var resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: structuredQuery, aggregations: [{ alias: 'count', count: {} }] } })
    });
    if (!resp.ok) throw new Error('countMatching: Firestore REST error ' + resp.status + ' -- ' + (await resp.text()));
    var json = await resp.json();
    var row = Array.isArray(json) ? json.find(function (r) { return r.result; }) : json.result;
    var countStr = row && row.result && row.result.aggregateFields && row.result.aggregateFields.count && row.result.aggregateFields.count.integerValue;
    return Number(countStr || 0);
  }

  /**
   * Hitung jumlah dokumen yang cocok filter equality sederhana, TANPA download dokumen
   * (agregasi lewat REST, lihat runAggregationQueryRest_ -- dibilling jauh lebih murah
   * daripada baca dokumen penuh, aman dipakai untuk badge/KPI di koleksi besar).
   * whereClauses: [[field, '==', value], ...] (opsional, kosongkan untuk hitung semua).
   */
  async function countMatching(collectionName, whereClauses, seedData) {
    var _db = ensureDb();
    if (_db) {
      var cacheKey = countCacheKey_(collectionName, whereClauses);
      var cached = countCacheGet_(cacheKey);
      if (cached !== undefined) return cached;
      var count = await runAggregationQueryRest_(collectionName, whereClauses);
      countCacheSet_(cacheKey, count);
      return count;
    }
    var items = readDemo(collectionName, seedData || []);
    return items.filter(function (it) {
      return (whereClauses || []).every(function (w) { return it[w[0]] === w[2]; });
    }).length;
  }

  /**
   * Ambil SATU HALAMAN dokumen -- paginasi asli lewat Firestore (`.limit`/`.startAfter`),
   * hanya baca dokumen yang benar-benar ditampilkan, bukan seluruh koleksi.
   * opts:
   *   where: [[field, '==', value], ...]  (opsional)
   *   orderByField: nama field untuk urut (wajib kalau pakai rangeStart/rangeEnd)
   *   orderDir: 'asc' | 'desc' (default 'desc')
   *   limit: jumlah per halaman (default 10)
   *   startAfterCursor: cursor dari hasil queryPage() sebelumnya (null = halaman pertama)
   *   rangeStart / rangeEnd: batas nilai orderByField (dipakai untuk pencarian prefix,
   *     mis. orderByField:'nama', rangeStart:'Bud', rangeEnd:'Bud')
   * Return: { items:[...plain object], cursor: (dipakai sbg startAfterCursor halaman
   *   berikutnya, null kalau tidak ada lagi), hasMore: bool }
   */
  async function queryPage(collectionName, opts) {
    opts = opts || {};
    var pageLimit = opts.limit || 10;
    var _db = ensureDb();
    if (_db) {
      var q = _db.collection(collectionName);
      (opts.where || []).forEach(function (w) { q = q.where(w[0], w[1], w[2]); });
      if (opts.orderByField) q = q.orderBy(opts.orderByField, opts.orderDir || 'desc');
      if (opts.rangeStart !== undefined) q = q.startAt(opts.rangeStart);
      if (opts.rangeEnd !== undefined) q = q.endAt(opts.rangeEnd);
      if (opts.startAfterCursor) q = q.startAfter(opts.startAfterCursor);
      q = q.limit(pageLimit + 1); // 1 ekstra sekadar untuk tahu apakah masih ada halaman berikutnya
      var snap = await q.get();
      var docs = snap.docs;
      var hasMore = docs.length > pageLimit;
      var pageDocs = hasMore ? docs.slice(0, pageLimit) : docs;
      return {
        items: pageDocs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }),
        cursor: pageDocs.length ? pageDocs[pageDocs.length - 1] : null,
        hasMore: hasMore
      };
    }
    // Mode demo: seluruh data sudah di localStorage (lokal, tanpa biaya) -- cukup filter+sort+slice biasa.
    var items = readDemo(collectionName, opts.seedData || []);
    items = items.filter(function (it) {
      return (opts.where || []).every(function (w) { return it[w[0]] === w[2]; });
    });
    if (opts.rangeStart !== undefined && opts.orderByField) {
      items = items.filter(function (it) {
        var v = String(it[opts.orderByField] || '');
        return v >= opts.rangeStart && v <= (opts.rangeEnd !== undefined ? opts.rangeEnd : '￿');
      });
    }
    if (opts.orderByField) {
      items = items.slice().sort(function (a, b) {
        var av = a[opts.orderByField], bv = b[opts.orderByField];
        if (av === bv) return 0;
        var cmp = av > bv ? 1 : -1;
        return (opts.orderDir || 'desc') === 'asc' ? cmp : -cmp;
      });
    }
    var startIdx = opts.startAfterCursor || 0; // mode demo: cursor cukup berupa index angka
    var pageItems = items.slice(startIdx, startIdx + pageLimit);
    var nextIdx = startIdx + pageItems.length;
    return { items: pageItems, cursor: nextIdx < items.length ? nextIdx : null, hasMore: nextIdx < items.length };
  }

  /** Ambil satu dokumen berdasarkan id. Mengembalikan null kalau tidak ditemukan. */
  async function getDocument(collectionName, id, seedData) {
    var _db = ensureDb();
    if (_db) {
      var snap = await _db.collection(collectionName).doc(id).get();
      return snap.exists ? Object.assign({ id: snap.id }, snap.data()) : null;
    }
    var items = readDemo(collectionName, seedData || []);
    var found = items.find(function (it) { return it.id === id; });
    return found || null;
  }

  /**
   * Dengarkan perubahan REAL-TIME pada satu dokumen (Firestore onSnapshot) -- dipakai saat
   * panel/drawer detail sedang terbuka, supaya statusnya ikut update otomatis begitu role lain
   * (mis. CRC/ComBen/HC/kandidat) melakukan aksi di tempat lain, tanpa perlu refresh manual
   * (permintaan langsung user, 1 Sep 2026). Return fungsi unsubscribe -- WAJIB dipanggil saat
   * drawer/panel ditutup, supaya listener-nya tidak terus menyala di background selamanya.
   * Mode Demo (localStorage) tidak punya cara "berubah dari luar" yang bisa didengar -- callback
   * dipanggil sekali dengan data saat ini, unsubscribe jadi no-op.
   */
  function subscribeDocument(collectionName, id, callback) {
    var _db = ensureDb();
    if (_db) {
      return _db.collection(collectionName).doc(id).onSnapshot(function (snap) {
        callback(snap.exists ? Object.assign({ id: snap.id }, snap.data()) : null);
      }, function (err) {
        console.error('subscribeDocument(' + collectionName + '/' + id + ') error:', err);
      });
    }
    getDocument(collectionName, id, []).then(callback);
    return function () {};
  }

  /** Tambah satu dokumen baru. Mengembalikan id dokumen yang baru dibuat. */
  async function addDocument(collectionName, data) {
    var _db = ensureDb();
    if (_db) {
      var ref = await _db.collection(collectionName).add(
        Object.assign({}, data, { created_at: firebase.firestore.FieldValue.serverTimestamp() })
      );
      return ref.id;
    }
    var items = readDemo(collectionName, []);
    var id = 'demo-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    items.push(Object.assign({ id: id }, data, { created_at: new Date().toISOString() }));
    writeDemo(collectionName, items);
    return id;
  }

  /** Ubah sebagian field pada satu dokumen (berdasarkan id). */
  async function updateDocument(collectionName, id, patch) {
    var _db = ensureDb();
    if (_db) {
      await _db.collection(collectionName).doc(id).update(
        Object.assign({}, patch, { updated_at: firebase.firestore.FieldValue.serverTimestamp() })
      );
      return;
    }
    var items = readDemo(collectionName, []);
    var idx = items.findIndex(function (it) { return it.id === id; });
    if (idx !== -1) {
      items[idx] = Object.assign({}, items[idx], patch, { updated_at: new Date().toISOString() });
      writeDemo(collectionName, items);
    }
  }

  /** Hapus satu dokumen berdasarkan id. */
  async function deleteDocument(collectionName, id) {
    var _db = ensureDb();
    if (_db) {
      await _db.collection(collectionName).doc(id).delete();
      return;
    }
    var items = readDemo(collectionName, []);
    writeDemo(collectionName, items.filter(function (it) { return it.id !== id; }));
  }

  /**
   * Simulasi Lokal SAJA (30 Ags 2026) -- pengganti Generate Dokumen sungguhan (Apps Script,
   * belum dideploy) supaya alur & status Offering tetap bisa diuji penuh di emulator tanpa
   * Apps Script/OAuth Google apa pun. TIDAK PERNAH aktif di production: dijaga USE_LOCAL_EMULATOR
   * (firebase-config.js), yang sendiri cuma true kalau hostname persis "localhost" DAN
   * firebaseConfig sudah terisi -- di hris-dasaria.web.app selalu false, fungsi ini langsung
   * balas null tanpa efek apa pun.
   *
   * jenis: 'OA' | 'CS' | 'FINAL' -- sama seperti kode dipakai Apps Script/Master Template
   * (DOCGEN_JENIS_TO_KODE). Coba ambil Google Docs Template ID dari Master Template
   * (document_templates/OFFER_<jenis>, diisi lewat Dokumen Factory document.html) dulu -- kalau
   * ada, dipakai APA ADANYA (bukan salinan sungguhan, cuma link yang sama dipakai semua
   * kandidat dummy -- cukup untuk uji alur/status, bukan uji dokumen personalisasi). Kalau
   * kosong, minta user tempel link Google Doc manual lewat prompt().
   */
  async function getLocalDummyDocUrl(jenis) {
    if (typeof USE_LOCAL_EMULATOR === 'undefined' || !USE_LOCAL_EMULATOR) return null;
    try {
      var tpl = await getDocument('document_templates', 'OFFER_' + jenis, []);
      if (tpl && tpl.googleDocId) {
        return 'https://docs.google.com/document/d/' + tpl.googleDocId + '/edit';
      }
    } catch (e) { /* lanjut ke prompt manual di bawah */ }
    var pasted = window.prompt(
      'Simulasi Lokal: Apps Script belum dideploy, dokumen tidak bisa dibuat otomatis.\n\n' +
      'Tempel link Google Doc apa saja untuk dipakai sebagai dummy ' + jenis + ' (kosongkan untuk lewati):'
    );
    return pasted && pasted.trim() ? pasted.trim() : null;
  }

  window.DasariaData = {
    getCollection: getCollection,
    getDocument: getDocument,
    subscribeDocument: subscribeDocument,
    addDocument: addDocument,
    updateDocument: updateDocument,
    deleteDocument: deleteDocument,
    countMatching: countMatching,
    queryPage: queryPage,
    invalidateCountCache: invalidateCountCache,
    isConfigured: isConfigured,
    getLocalDummyDocUrl: getLocalDummyDocUrl
  };
})();
