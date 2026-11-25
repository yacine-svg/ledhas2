/* Ledhas · mode démonstration de l'espace de gestion.
   Tant que Supabase n'est pas branché (ou si config.js contient demo: true),
   l'admin fonctionne avec des réservations fictives gardées dans ce navigateur.
   Les demandes envoyées depuis le formulaire du site (même navigateur) arrivent
   dans la « boîte » ledhas-demo-inbox et apparaissent ici comme de vraies demandes. */
(function () {
  'use strict';
  var KEY = 'ledhas-demo-db', INBOX = 'ledhas-demo-inbox', mem = null;
  var ACTOR = 'Équipe Ledhas';

  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function day(n) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return iso(d); }
  function ago(hours) { return new Date(Date.now() - hours * 3600e3).toISOString(); }
  function uid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function newRef(taken) {
    var A = '23456789ABCDEFGHJKMNPQRSTUVWXYZ', out;
    do { out = 'LDH-'; for (var i = 0; i < 6; i++) out += A.charAt(Math.floor(Math.random() * A.length)); } while (taken && taken[out]);
    return out;
  }
  function nights(r) { var a = r.arrival.split('-'), b = r.departure.split('-'); return Math.round((Date.UTC(+b[0], b[1] - 1, +b[2]) - Date.UTC(+a[0], a[1] - 1, +a[2])) / 864e5); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  /* ---------- Données fictives (dates relatives à aujourd'hui) ---------- */
  function seed() {
    // [nom, téléphone, langue, statut, arrivée (jours), nuits, adultes, enfants, chambre, matelas, pension, activité, origine, reçue il y a (h), message]
    var P = [
      ['Amina Belkacem', '0550 00 01 01', 'ar', 'nouvelle', 3, 3, 2, 2, 'quadruple', 0, 'demi', 'quad', 'site', 2, 'Nous venons en famille avec deux enfants de 6 et 9 ans.'],
      ['Karim Ould Ali', '0661 00 02 02', 'fr', 'nouvelle', 9, 2, 2, 0, 'double', 0, 'pdj', 'soiree', 'site', 7, 'Est-ce possible d’arriver tard le soir, vers 22 h ?'],
      ['Sophie Martin', '+33 6 00 00 03 03', 'fr', 'nouvelle', 0, 2, 3, 0, 'triple', 1, 'complete', 'evasion', 'site', 15, null],
      ['John Carter', '+44 7700 900003', 'en', 'nouvelle', 24, 4, 2, 0, 'double', 0, 'demi', 'quad', 'site', 30, 'First time in the Sahara, we would love a sunset tour.'],
      ['Yasmine Haddad', '0770 00 05 05', 'fr', 'confirmee', 0, 3, 2, 1, 'triple', 0, 'demi', 'aucune', 'site', 60, null],
      ['Mourad Benali', '0555 00 06 06', 'ar', 'arrivee', -1, 3, 3, 0, 'quadruple', 1, 'complete', 'quad', 'whatsapp', 120, null],
      ['Lina Cherif', '0699 00 07 07', 'fr', 'confirmee', 2, 2, 2, 0, 'double', 0, 'pdj', 'soiree', 'site', 50, 'Anniversaire de mariage 🙂'],
      ['Groupe Sonatrach (M. Rahmani)', '0560 00 08 08', 'fr', 'confirmee', 6, 2, 8, 0, 'quadruple', 2, 'complete', 'team', 'telephone', 200, 'Team building pour 8 personnes, salle pour une réunion le matin.'],
      ['Emma Rossi', '+39 333 000 0909', 'en', 'confirmee', 13, 3, 2, 0, 'double', 0, 'demi', 'evasion', 'site', 90, null],
      ['Omar Saïdi', '0550 00 10 10', 'ar', 'terminee', -14, 3, 2, 0, 'double', 0, 'pdj', 'aucune', 'site', 500, null],
      ['Claire Dubois', '+33 7 00 00 11 11', 'fr', 'annulee', 5, 2, 2, 0, 'double', 0, 'pdj', 'aucune', 'site', 140, null],
      ['Nadir Ferhat', '0661 00 12 12', 'fr', 'confirmee', 20, 5, 4, 0, 'quadruple', 0, 'demi', 'quad', 'site', 40, null],
      ['Omar Saïdi', '0550 00 10 10', 'ar', 'nouvelle', 30, 2, 2, 0, 'double', 0, 'pdj', 'soiree', 'site', 1, 'Nous revenons pour la soirée musicale !'],
      ['Hakim Zerrouki', '0770 00 14 14', 'fr', 'terminee', -35, 2, 2, 2, 'quadruple', 0, 'demi', 'quad', 'sur_place', 900, null]
    ];
    var taken = {}, rows = [], events = [], eid = 1;
    P.forEach(function (p, i) {
      var r = {
        id: uid(), ref: newRef(taken), created_at: ago(p[13]), updated_at: ago(Math.max(0, p[13] - 1)), status: p[3], source: p[12], lang: p[2],
        name: p[0], phone: p[1], email: i % 4 === 0 ? 'client' + (i + 1) + '@exemple.com' : null,
        arrival: day(p[4]), departure: day(p[4] + p[5]), adults: p[6], children: p[7], room_type: p[8], extra_mattress: p[9], board: p[10], activity: p[11],
        message: p[14], room_label: null, price_total: null, deposit: null, admin_notes: null, confirmed_at: null, cancelled_at: null, demo_seed: true
      };
      taken[r.ref] = 1;
      r.nights = nights(r);
      if (r.status !== 'nouvelle' && r.status !== 'annulee') {
        r.price_total = r.nights * 12000 * Math.ceil((r.adults + r.extra_mattress) / 4);
        r.deposit = r.status === 'confirmee' && i % 2 ? 10000 : (r.status === 'confirmee' ? null : r.price_total);
        r.room_label = 'Chambre ' + (1 + (i * 3) % 9);
        r.confirmed_at = ago(p[13] - 2);
      }
      if (r.status === 'annulee') r.cancelled_at = ago(p[13] - 5);
      if (i === 7) r.admin_notes = 'Facture au nom de l’entreprise. Prévoir le dîner sous la khaïma le 1er soir.';
      rows.push(r);
      events.push({ id: eid++, reservation_id: r.id, at: r.created_at, actor: r.source === 'site' ? null : 'demo', actor_name: r.source === 'site' ? null : ACTOR, kind: 'created', detail: { source: r.source, status: 'nouvelle' } });
      var chain = { confirmee: ['confirmee'], arrivee: ['confirmee', 'arrivee'], terminee: ['confirmee', 'arrivee', 'terminee'], annulee: ['annulee'] }[r.status] || [];
      var from = 'nouvelle', h = p[13];
      chain.forEach(function (to, k) {
        h = Math.max(0.2, h - (k === 0 ? 2 : 24));
        events.push({ id: eid++, reservation_id: r.id, at: ago(h), actor: 'demo', actor_name: ACTOR, kind: 'status', detail: { from: from, to: to } });
        if (to === 'confirmee') events.push({ id: eid++, reservation_id: r.id, at: ago(h - 0.05), actor: 'demo', actor_name: ACTOR, kind: 'contact', detail: { channel: 'whatsapp', template: 'confirm' } });
        from = to;
      });
    });
    return { v: 1, rows: rows, events: events, eid: eid };
  }

  /* ---------- Stockage ---------- */
  function write(d) { mem = d; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* navigation privée : on garde en mémoire */ } }
  function read() {
    var d = mem;
    try { var raw = localStorage.getItem(KEY); if (raw) d = JSON.parse(raw); } catch (e) { /* ignore */ }
    if (!d || !d.rows) { d = seed(); write(d); }
    // Demandes envoyées depuis le formulaire du site
    var inbox = [];
    try { inbox = JSON.parse(localStorage.getItem(INBOX) || '[]'); localStorage.removeItem(INBOX); } catch (e) { inbox = []; }
    if (inbox.length) {
      var taken = {}; d.rows.forEach(function (r) { taken[r.ref] = 1; });
      inbox.forEach(function (p) {
        if (!p || !p.name || !p.arrival || !p.departure) return;
        var r = {
          id: uid(), ref: p.ref && !taken[p.ref] ? p.ref : newRef(taken), created_at: p.at || new Date().toISOString(), updated_at: new Date().toISOString(),
          status: 'nouvelle', source: 'site', lang: p.lang || 'fr', name: String(p.name).slice(0, 80), phone: String(p.phone || '').slice(0, 25), email: p.email || null,
          arrival: p.arrival, departure: p.departure, adults: +p.adults || 1, children: +p.children || 0, room_type: p.room_type || 'double',
          extra_mattress: +p.extra_mattress || 0, board: p.board || 'pdj', activity: p.activity || 'aucune', message: p.message || null,
          room_label: null, price_total: null, deposit: null, admin_notes: null, confirmed_at: null, cancelled_at: null
        };
        taken[r.ref] = 1; r.nights = nights(r);
        if (r.nights < 1) return;
        d.rows.push(r);
        d.events.push({ id: d.eid++, reservation_id: r.id, at: r.created_at, actor: null, actor_name: null, kind: 'created', detail: { source: 'site', status: 'nouvelle' } });
      });
      write(d);
    }
    return d;
  }
  function later(v) { return new Promise(function (res) { setTimeout(function () { res(v === undefined ? null : clone(v)); }, 140); }); }
  function fail(msg) { return new Promise(function (res, rej) { setTimeout(function () { rej(new Error(msg)); }, 140); }); }

  var EDITABLE = ['name', 'phone', 'email', 'lang', 'source', 'arrival', 'departure', 'adults', 'children', 'room_type', 'extra_mattress', 'board', 'activity', 'message', 'room_label', 'price_total', 'deposit', 'admin_notes'];

  var db = {
    me: function () { return later([{ name: ACTOR }]); },
    list: function () { var d = read(); return later(d.rows.slice().sort(function (a, b) { return a.arrival < b.arrival ? 1 : -1; })); },
    update: function (id, patch) {
      var d = read(), r = d.rows.filter(function (x) { return x.id === id; })[0], now = new Date().toISOString();
      if (!r) return fail('Réservation introuvable.');
      if (patch.status && patch.status !== r.status) {
        d.events.push({ id: d.eid++, reservation_id: id, at: now, actor: 'demo', actor_name: ACTOR, kind: 'status', detail: { from: r.status, to: patch.status } });
        if (patch.status === 'confirmee' && !r.confirmed_at) r.confirmed_at = now;
        if (patch.status === 'annulee') r.cancelled_at = now;
        r.status = patch.status;
      }
      var changed = EDITABLE.filter(function (k) { return k in patch && JSON.stringify(patch[k]) !== JSON.stringify(r[k]); });
      changed.forEach(function (k) { r[k] = patch[k]; });
      if (changed.length) d.events.push({ id: d.eid++, reservation_id: id, at: now, actor: 'demo', actor_name: ACTOR, kind: 'edit', detail: { fields: changed } });
      r.nights = nights(r); r.updated_at = now;
      write(d); return later(r);
    },
    create: function (row) {
      var d = read(), taken = {}, now = new Date().toISOString();
      d.rows.forEach(function (x) { taken[x.ref] = 1; });
      var r = Object.assign({ status: 'nouvelle', source: 'telephone', lang: 'fr', adults: 2, children: 0, extra_mattress: 0, room_type: 'double', board: 'pdj', activity: 'aucune', email: null, message: null, room_label: null, price_total: null, deposit: null, admin_notes: null }, row,
        { id: uid(), ref: newRef(taken), created_at: now, updated_at: now, confirmed_at: row.status === 'confirmee' ? now : null, cancelled_at: null });
      r.nights = nights(r);
      d.rows.push(r);
      d.events.push({ id: d.eid++, reservation_id: r.id, at: now, actor: 'demo', actor_name: ACTOR, kind: 'created', detail: { source: r.source, status: r.status } });
      write(d); return later(r);
    },
    remove: function (id) { var d = read(); d.rows = d.rows.filter(function (x) { return x.id !== id; }); d.events = d.events.filter(function (e) { return e.reservation_id !== id; }); write(d); return later(null); },
    events: function (id) { var d = read(); return later(d.events.filter(function (e) { return e.reservation_id === id; }).sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : b.id - a.id; })); },
    logContact: function (id, detail) { var d = read(); d.events.push({ id: d.eid++, reservation_id: id, at: new Date().toISOString(), actor: 'demo', actor_name: ACTOR, kind: 'contact', detail: detail }); write(d); return later(null); }
  };

  window.LEDHAS_DEMO = {
    KEY: KEY, INBOX: INBOX,
    email: 'demo@ledhas.dz', password: 'demo1234',
    db: db,
    login: function (email, pw) {
      if (String(email).trim().toLowerCase() !== 'demo@ledhas.dz' || pw !== 'demo1234') return null;
      return { access_token: 'demo', refresh_token: 'demo', expires_in: 3600 * 24 * 30, user: { id: 'demo', email: 'demo@ledhas.dz' } };
    },
    reset: function () { try { localStorage.removeItem(INBOX); } catch (e) { /* ignore */ } write(seed()); }
  };
})();
