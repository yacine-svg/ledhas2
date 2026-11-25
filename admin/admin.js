/* Ledhas · espace de gestion des réservations
   Sans framework ni build : Supabase (Auth + base PostgreSQL protégée par RLS)
   est appelé directement par son API REST. */
(function () {
  'use strict';

  /* ======================================================================
     Configuration & helpers
     ====================================================================== */
  var CFG = window.LEDHAS_CONFIG || {};
  var SB_URL = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
  var SB_KEY = String(CFG.supabaseAnonKey || '');
  var SITE_WA = String(CFG.whatsappNumber || '213550581196');
  var CONFIGURED = /^https:\/\/.+/.test(SB_URL) && SB_KEY.length > 20;
  var DEMO_API = window.LEDHAS_DEMO;
  var DEMO = !!DEMO_API && (!CONFIGURED || CFG.demo === true);
  var MAPS = 'https://maps.google.com/?q=29.285652,0.241852';
  var DAY = 864e5;

  var app = document.getElementById('app');
  var toastsEl = document.getElementById('toasts');

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }

  var ICONS = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
    wa: '<path d="M3 21l1.65-3.8A9 9 0 1 1 7.6 20L3 21z"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/>',
    bed: '<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    arrowIn: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowOut: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
  };
  function icon(n, cls) { return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || '') + '</svg>'; }

  /* ---------- Labels ---------- */
  var STATUS = {
    nouvelle: { label: 'À vérifier', tone: 'saff' },
    confirmee: { label: 'Confirmée', tone: 'ok' },
    arrivee: { label: 'En séjour', tone: 'blue' },
    terminee: { label: 'Terminée', tone: '' },
    annulee: { label: 'Annulée', tone: 'bad' }
  };
  var STATUS_ORDER = ['nouvelle', 'confirmee', 'arrivee', 'terminee', 'annulee'];
  var ROOM = { double: 'Chambre double', triple: 'Chambre triple', quadruple: 'Chambre quadruple' };
  var BOARD = { pdj: 'Petit-déjeuner', demi: 'Demi-pension', complete: 'Pension complète' };
  var ACT = { aucune: 'Séjour au gîte', quad: 'Sortie en quad', evasion: 'Évasion thématique', team: 'Team building', soiree: 'Soirée musicale' };
  var SOURCE = { site: 'Site web', whatsapp: 'WhatsApp', telephone: 'Téléphone', sur_place: 'Sur place', autre: 'Autre' };
  var LANG = { fr: 'Français', en: 'Anglais', ar: 'Arabe' };
  var FIELD_LABEL = { name: 'nom', phone: 'téléphone', email: 'e-mail', arrival: 'arrivée', departure: 'départ', adults: 'adultes', children: 'enfants', room_type: 'type de chambre', extra_mattress: 'matelas', board: 'pension', activity: 'activité', message: 'message', room_label: 'chambre attribuée', price_total: 'prix', deposit: 'acompte', admin_notes: 'notes', source: 'origine', lang: 'langue' };

  /* ---------- Dates & numbers ---------- */
  function parseDay(s) { var p = String(s || '').split('-'); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; }
  function isoDay(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function diffDays(a, b) { return Math.round((parseDay(b) - parseDay(a)) / DAY); }
  var fmtDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  var fmtDayY = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  var fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  var fmtMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
  var fmtMonthShort = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
  var fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
  var fmtStamp = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  function dayLabel(s) { var d = parseDay(s); if (!d) return '—'; return (d.getFullYear() === new Date().getFullYear() ? fmtDay : fmtDayY).format(d); }
  function relTime(ts) {
    var s = (Date.now() - new Date(ts).getTime()) / 1000;
    if (s < 60) return 'à l’instant';
    if (s < 3600) return 'il y a ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'il y a ' + Math.floor(s / 3600) + ' h';
    if (s < 86400 * 7) { var d = Math.floor(s / 86400); return 'il y a ' + d + ' j'; }
    return fmtStamp.format(new Date(ts));
  }
  function nightsText(n) { return n + (n > 1 ? ' nuits' : ' nuit'); }
  function money(v) { return v == null || v === '' ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(+v) + ' DA'; }
  function initials(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join(''); }
  function persons(r) { return (r.adults || 0) + (r.children || 0); }
  function peopleText(r) {
    var t = r.adults + (r.adults > 1 ? ' adultes' : ' adulte');
    if (r.children) t += ', ' + r.children + (r.children > 1 ? ' enfants' : ' enfant');
    return t;
  }
  function waNumber(phone) {
    var raw = String(phone || '').trim(), d = raw.replace(/\D/g, '');
    if (raw.charAt(0) === '+') return d;
    if (d.indexOf('00') === 0) return d.slice(2);
    if (d.charAt(0) === '0' && d.length === 10) return '213' + d.slice(1);
    if (d.length === 9 && /^[567]/.test(d)) return '213' + d;
    return d;
  }
  function waTo(r) { return r && r.demo_seed ? '' : waNumber(r.phone); } // numéros fictifs de la démo : WhatsApp demande de choisir le contact
  function phoneKey(p) { var w = waNumber(p); return w.slice(-9); }

  /* ======================================================================
     Supabase REST client
     ====================================================================== */
  var session = null;
  try { session = JSON.parse(store('ledhas-admin-session') || 'null'); } catch (e) { session = null; }
  function saveSession(s) {
    session = s ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: { id: s.user && s.user.id, email: s.user && s.user.email } } : null;
    store('ledhas-admin-session', session ? JSON.stringify(session) : null);
  }
  function errMessage(body, status) {
    var m = body && (body.msg || body.message || body.error_description || body.error || body.hint);
    if (status === 0) return 'Pas de connexion internet.';
    if (/Invalid login credentials/i.test(m || '')) return 'Adresse e-mail ou mot de passe incorrect.';
    if (/Email not confirmed/i.test(m || '')) return 'Cette adresse e-mail n’est pas encore confirmée.';
    if (status === 429) return 'Trop de tentatives. Patientez une minute.';
    return m || ('Erreur ' + status);
  }
  function rawFetch(path, opts) {
    opts = opts || {};
    var headers = { apikey: SB_KEY, 'Content-Type': 'application/json' };
    if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
    if (opts.prefer) headers.Prefer = opts.prefer;
    return fetch(SB_URL + path, { method: opts.method || 'GET', headers: headers, body: opts.body != null ? JSON.stringify(opts.body) : undefined })
      .then(function (res) {
        return res.text().then(function (txt) {
          var body = null;
          try { body = txt ? JSON.parse(txt) : null; } catch (e) { body = txt; }
          return { ok: res.ok, status: res.status, body: body };
        });
      }, function () { return { ok: false, status: 0, body: null }; });
  }
  var refreshing = null;
  function refreshSession() {
    if (!session || !session.refresh_token) return Promise.resolve(false);
    if (!refreshing) {
      refreshing = rawFetch('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } })
        .then(function (r) { refreshing = null; if (r.ok && r.body && r.body.access_token) { saveSession(r.body); return true; } if (r.status !== 0) saveSession(null); return false; });
    }
    return refreshing;
  }
  function api(path, opts) {
    opts = opts || {};
    var ready = session && session.expires_at - 60 < Date.now() / 1000 ? refreshSession() : Promise.resolve(true);
    return ready.then(function () {
      return rawFetch(path, Object.assign({}, opts, { token: session && session.access_token }));
    }).then(function (r) {
      if (r.status === 401 && session) {
        return refreshSession().then(function (ok) {
          if (!ok) { onSignedOut('Votre session a expiré. Reconnectez-vous.'); throw new Error('Session expirée'); }
          return rawFetch(path, Object.assign({}, opts, { token: session.access_token }));
        });
      }
      return r;
    }).then(function (r) {
      if (!r.ok) throw new Error(errMessage(r.body, r.status));
      return r.body;
    });
  }
  var db = {
    me: function () { return api('/rest/v1/ledhas_admins?select=name&user_id=eq.' + encodeURIComponent(session.user.id)); },
    list: function () { return api('/rest/v1/reservations?select=*&order=arrival.desc&limit=5000'); },
    update: function (id, patch) { return api('/rest/v1/reservations?id=eq.' + id, { method: 'PATCH', body: patch, prefer: 'return=representation' }).then(function (rows) { return rows && rows[0]; }); },
    create: function (row) { return api('/rest/v1/reservations', { method: 'POST', body: row, prefer: 'return=representation' }).then(function (rows) { return rows && rows[0]; }); },
    remove: function (id) { return api('/rest/v1/reservations?id=eq.' + id, { method: 'DELETE' }); },
    events: function (id) { return api('/rest/v1/reservation_events?select=*&reservation_id=eq.' + id + '&order=at.desc&limit=200'); },
    logContact: function (id, detail) { return api('/rest/v1/reservation_events', { method: 'POST', body: { reservation_id: id, actor: session.user.id, kind: 'contact', detail: detail } }); }
  };

  if (DEMO) db = DEMO_API.db;

  /* ======================================================================
     State
     ====================================================================== */
  var S = {
    view: 'loading',          // loading | config | login | denied | recovery | app
    me: null,
    list: [],
    byId: {},
    loadedAt: 0,
    route: 'dashboard',
    filter: { status: 'all', period: 'upcoming', q: '' },
    clientsQ: '',
    cal: null,
    drawer: null,             // { id | 'new', tab, events, editArmed }
    sbOpen: false,
    search: '',
    known: null
  };

  function setList(rows) {
    S.list = rows || [];
    S.byId = {};
    S.list.forEach(function (r) { S.byId[r.id] = r; });
    S.loadedAt = Date.now();
  }
  function upsertRow(r) {
    if (!r) return;
    if (S.byId[r.id]) { S.list = S.list.map(function (x) { return x.id === r.id ? r : x; }); } else { S.list.unshift(r); }
    S.byId[r.id] = r;
  }

  /* ---------- Derived data ---------- */
  function active(r) { return r.status !== 'annulee'; }
  function occupying(r) { return r.status === 'confirmee' || r.status === 'arrivee'; }
  function overlapsDay(r, iso) { return r.arrival <= iso && r.departure > iso; }
  function counts() {
    var c = { all: S.list.length };
    STATUS_ORDER.forEach(function (s) { c[s] = 0; });
    S.list.forEach(function (r) { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }
  function newCount() { return S.list.filter(function (r) { return r.status === 'nouvelle'; }).length; }

  /* ======================================================================
     Rendering helpers
     ====================================================================== */
  function pill(status) { var s = STATUS[status] || { label: status, tone: '' }; return '<span class="pill" data-tone="' + s.tone + '">' + esc(s.label) + '</span>'; }
  function langTag(l) { return '<span class="tag" title="' + esc(LANG[l] || l) + '">' + esc(String(l || 'fr').toUpperCase()) + '</span>'; }
  function empty(title, sub, ic) { return '<div class="empty">' + icon(ic || 'inbox') + '<strong>' + esc(title) + '</strong>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>'; }
  function panel(title, body, opts) {
    opts = opts || {};
    return '<section class="panel' + (opts.cls ? ' ' + opts.cls : '') + '"><div class="panel-head"><div><h3>' + esc(title) + '</h3>' + (opts.sub ? '<div class="sub">' + esc(opts.sub) + '</div>' : '') + '</div>' + (opts.action || '') + '</div>' + (opts.raw ? body : '<div class="panel-body">' + body + '</div>') + '</section>';
  }
  function stayLine(r) { return dayLabel(r.arrival) + ' → ' + dayLabel(r.departure) + ' · ' + nightsText(r.nights || diffDays(r.arrival, r.departure)); }

  function toast(msg, opts) {
    opts = opts || {};
    var el = document.createElement('div');
    el.className = 'toast' + (opts.bad ? ' bad' : '');
    el.setAttribute('role', opts.bad ? 'alert' : 'status');
    el.innerHTML = icon(opts.icon || (opts.bad ? 'info' : 'check')) + '<div><div>' + esc(msg) + '</div>' + (opts.sub ? '<small>' + esc(opts.sub) + '</small>' : '') + '</div>';
    el.addEventListener('click', function () { el.remove(); if (opts.onClick) opts.onClick(); });
    toastsEl.appendChild(el);
    setTimeout(function () { el.remove(); }, opts.long ? 9000 : 4200);
  }

  /* ======================================================================
     Screens outside the app: config, login, recovery, denied
     ====================================================================== */
  function loginSide() {
    return '<div class="login-side"><img src="/img/patio.jpg" alt=""><div class="ls-copy"><span class="eyebrow">Gîte · Massine, Timimoun</span><h2>Les réservations de Ledhas, au même endroit.</h2><p>Vérifiez les demandes reçues sur le site, confirmez-les, contactez vos clients sur WhatsApp et suivez le calendrier du gîte.</p></div></div>';
  }
  function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
  function themeBtn() { var d = isDark(); return '<button class="btn btn-ghost btn-icon btn-sm theme-btn" type="button" data-act="theme" title="' + (d ? 'Mode clair' : 'Mode sombre') + '" aria-label="' + (d ? 'Passer en mode clair' : 'Passer en mode sombre') + '">' + icon(d ? 'sun' : 'moon') + '</button>'; }
  function loginBrand() { return '<div class="login-brand"><img src="/logo/ledhas-logo-320.webp" alt=""><div><strong>Ledhas</strong><span>Espace de gestion</span></div>' + themeBtn() + '</div>'; }

  function renderConfig() {
    app.innerHTML = '<div class="login">' + loginSide() + '<div class="login-main"><div class="login-card">' + loginBrand() +
      '<h1>Encore une étape</h1><div class="notice">' + icon('info') + '<div>L’espace de gestion n’est pas encore relié à sa base de données.<ol>' +
      '<li>Créez un projet gratuit sur <b>supabase.com</b>.</li><li>Exécutez le fichier <code>supabase/schema.sql</code> dans l’éditeur SQL.</li>' +
      '<li>Collez l’URL du projet et la clé <i>anon / publishable</i> dans <code>config.js</code>, puis redéployez.</li></ol></div></div>' +
      '<a class="btn" href="/">' + icon('external') + 'Retour au site</a></div></div></div>';
  }

  function renderLogin(mode, msg) {
    mode = mode || 'login';
    var body;
    if (mode === 'reset') {
      body = '<form class="stack" id="resetForm" novalidate><div class="stack" style="--gap:.4rem"><h1>Mot de passe oublié</h1><p class="muted">Recevez un lien par e-mail pour en choisir un nouveau.</p></div>' +
        '<label class="field"><span>Adresse e-mail</span><input class="input" name="email" type="email" autocomplete="username" required></label>' +
        (msg ? '<p class="' + (msg.ok ? 'ok-text' : 'error-text') + '" role="status">' + esc(msg.text) + '</p>' : '') +
        '<button class="btn btn-primary btn-lg" type="submit">Envoyer le lien</button>' +
        '<button class="link-btn" type="button" data-act="to-login">← Retour à la connexion</button></form>';
    } else {
      body = '<form class="stack" id="loginForm" novalidate><div class="stack" style="--gap:.4rem"><h1>Connexion</h1><p class="muted">Réservé à l’équipe du gîte.</p></div>' +
        '<label class="field"><span>Adresse e-mail</span><input class="input" name="email" type="email" autocomplete="username" required></label>' +
        '<label class="field"><span>Mot de passe</span><input class="input" name="password" type="password" autocomplete="current-password" required></label>' +
        (msg ? '<p class="' + (msg.ok ? 'ok-text' : 'error-text') + '" role="alert">' + esc(msg.text) + '</p>' : '') +
        '<button class="btn btn-primary btn-lg" type="submit">' + icon('login') + 'Se connecter</button>' +
        '<button class="link-btn" type="button" data-act="to-reset">Mot de passe oublié ?</button>' +
        (DEMO ? '<button class="notice demo-note" type="button" data-act="fill-demo">' + icon('info') + '<span><b>Mode démonstration</b> : réservations fictives, gardées dans ce navigateur.<br>Compte : <code>' + DEMO_API.email + '</code> · mot de passe <code>' + DEMO_API.password + '</code><br><u>Remplir automatiquement</u></span></button>' : '') + '</form>';
    }
    app.innerHTML = '<div class="login">' + loginSide() + '<div class="login-main"><div class="login-card">' + loginBrand() + body +
      '<a class="muted" href="/" style="font-size:13px">← Retour au site</a></div></div></div>';
    var first = app.querySelector('input'); if (first) first.focus();
  }

  function renderRecovery(msg) {
    app.innerHTML = '<div class="login">' + loginSide() + '<div class="login-main"><div class="login-card">' + loginBrand() +
      '<form class="stack" id="newPassForm" novalidate><div class="stack" style="--gap:.4rem"><h1>Nouveau mot de passe</h1><p class="muted">Au moins 8 caractères.</p></div>' +
      '<label class="field"><span>Nouveau mot de passe</span><input class="input" name="password" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<label class="field"><span>Confirmer</span><input class="input" name="password2" type="password" autocomplete="new-password" minlength="8" required></label>' +
      (msg ? '<p class="error-text" role="alert">' + esc(msg) + '</p>' : '') +
      '<button class="btn btn-primary btn-lg" type="submit">Enregistrer</button></form></div></div></div>';
  }

  function renderDenied() {
    app.innerHTML = '<div class="login">' + loginSide() + '<div class="login-main"><div class="login-card">' + loginBrand() +
      '<h1>Accès refusé</h1><div class="notice">' + icon('lock') + '<div>Le compte <b>' + esc(session && session.user.email) + '</b> n’est pas autorisé à gérer les réservations. Demandez à l’administrateur de l’ajouter à la table <code>ledhas_admins</code>.</div></div>' +
      '<button class="btn" type="button" data-act="logout">' + icon('logout') + 'Se déconnecter</button></div></div></div>';
  }

  function renderLoading(text) { app.innerHTML = '<div class="loader"><div class="spinner"></div><span>' + esc(text || 'Chargement…') + '</span></div>'; }

  /* ======================================================================
     App shell
     ====================================================================== */
  var NAV = [
    { label: '', items: [{ r: 'dashboard', label: 'Tableau de bord', icon: 'grid' }] },
    { label: 'Réservations', items: [
      { r: 'reservations', label: 'Demandes & réservations', icon: 'inbox', badge: true },
      { r: 'calendar', label: 'Calendrier', icon: 'calendar' },
      { r: 'clients', label: 'Clients', icon: 'users' }
    ] }
  ];
  var TITLES = { dashboard: 'Tableau de bord', reservations: 'Demandes & réservations', calendar: 'Calendrier', clients: 'Clients' };

  function renderApp() {
    var nb = newCount();
    document.title = (nb ? '(' + nb + ') ' : '') + 'Ledhas · Gestion';
    var side = '<aside class="sidebar' + (S.sbOpen ? ' open' : '') + '" aria-label="Navigation"><div class="sb-brand"><img src="/logo/ledhas-logo-320.webp" alt=""><div><strong>Ledhas</strong><span>Gestion du gîte</span></div>' + (DEMO ? '<span class="sb-env" title="Données fictives">DÉMO</span>' : '') + '</div>';
    NAV.forEach(function (g) {
      side += '<div class="sb-group">' + (g.label ? '<div class="sb-label">' + esc(g.label) + '</div>' : '');
      g.items.forEach(function (it) {
        side += '<a class="sb-link" href="#/' + it.r + '"' + (S.route === it.r ? ' aria-current="page"' : '') + '>' + icon(it.icon) + '<span>' + esc(it.label) + '</span>' + (it.badge && nb ? '<span class="sb-badge" title="À vérifier">' + nb + '</span>' : '') + '</a>';
      });
      side += '</div>';
    });
    side += '<div class="sb-foot">' + (DEMO ? '<button class="sb-link" type="button" data-act="demo-reset">' + icon('refresh') + '<span>Réinitialiser la démo</span></button>' : '') + '<a class="sb-link" href="/" target="_blank" rel="noopener">' + icon('external') + '<span>Voir le site</span></a>' +
      '<div class="user-chip"><span class="avatar">' + esc(initials(S.me && S.me.name)) + '</span><div style="min-width:0"><div class="u-name ellipsis">' + esc(S.me && S.me.name) + '</div><div class="u-role ellipsis">' + esc(session && session.user.email) + '</div></div>' +
      '<button class="btn btn-ghost btn-icon btn-sm" type="button" data-act="logout" title="Se déconnecter" aria-label="Se déconnecter">' + icon('logout') + '</button></div></div></aside>';

    var top = '<header class="topbar"><button class="btn btn-ghost btn-icon sb-toggle" type="button" data-act="sb-open" aria-label="Menu">' + icon('menu') + '</button>' +
      '<div class="tb-title">' + esc(TITLES[S.route]) + '</div>' +
      '<div class="tb-search"><label class="input-icon">' + icon('search') + '<span class="sr-only">Rechercher</span><input class="input" id="globalSearch" type="search" placeholder="Nom, téléphone ou référence…" autocomplete="off" value="' + esc(S.search) + '"></label><div id="searchPop"></div></div>' +
      '<div class="tb-actions"><span class="sync-note" id="syncNote"></span>' + themeBtn() + '<button class="btn btn-ghost btn-icon btn-sm" type="button" data-act="refresh" title="Actualiser" aria-label="Actualiser">' + icon('refresh') + '</button>' +
      '<button class="btn btn-primary btn-sm" type="button" data-act="new">' + icon('plus') + '<span class="hide-sm">Nouvelle réservation</span></button></div></header>';

    app.innerHTML = '<div class="app">' + side + (S.sbOpen ? '<div class="overlay sb-overlay" data-act="sb-close"></div>' : '') +
      '<div class="main-col">' + top + '<main class="content" id="content">' + (S.animate = true, renderRoute()) + '</main></div></div>' + renderDrawer();
    S.animate = false;
    updateSyncNote();
    renderSearch();
  }
  function rerenderContent() {
    var c = document.getElementById('content');
    if (!c || S.view !== 'app') return renderApp();
    c.innerHTML = renderRoute();
    var badge = app.querySelector('.sb-badge'), nb = newCount();
    document.title = (nb ? '(' + nb + ') ' : '') + 'Ledhas · Gestion';
    if (badge) { if (nb) badge.textContent = nb; else badge.remove(); }
    else if (nb) { var l = app.querySelector('.sb-link[href="#/reservations"]'); if (l) l.insertAdjacentHTML('beforeend', '<span class="sb-badge" title="À vérifier">' + nb + '</span>'); }
  }
  function rerenderDrawer() {
    var old = app.querySelectorAll('.drawer, .drawer-overlay');
    var scroll = 0, b = app.querySelector('.drawer-body'); if (b) scroll = b.scrollTop;
    old.forEach(function (n) { n.remove(); });
    app.insertAdjacentHTML('beforeend', renderDrawer(true));
    var nb2 = app.querySelector('.drawer-body'); if (nb2) nb2.scrollTop = scroll;
  }
  function updateSyncNote() { var n = document.getElementById('syncNote'); if (n && S.loadedAt) n.textContent = 'À jour · ' + fmtTime.format(new Date(S.loadedAt)); }

  function renderRoute() {
    if (S.route === 'reservations') return viewReservations();
    if (S.route === 'calendar') return viewCalendar();
    if (S.route === 'clients') return viewClients();
    return viewDashboard();
  }

  /* ---------- Global search ---------- */
  function searchMatches(q) {
    q = q.toLowerCase().trim(); var qd = q.replace(/\D/g, '');
    if (q.length < 2) return [];
    return S.list.filter(function (r) {
      return r.name.toLowerCase().indexOf(q) > -1 || r.ref.toLowerCase().indexOf(q) > -1 || (qd.length >= 3 && String(r.phone).replace(/\D/g, '').indexOf(qd) > -1) || (r.email && r.email.toLowerCase().indexOf(q) > -1);
    }).sort(function (a, b) { return b.arrival < a.arrival ? -1 : 1; }).slice(0, 8);
  }
  function renderSearch() {
    var pop = document.getElementById('searchPop'); if (!pop) return;
    if (S.search.trim().length < 2) { pop.innerHTML = ''; return; }
    var m = searchMatches(S.search);
    pop.innerHTML = '<div class="popover">' + (m.length ? m.map(function (r) {
      return '<button class="pop-item" type="button" data-open="' + r.id + '">' + icon('bed') + '<span style="min-width:0">' + esc(r.name) + ' · <span class="mono">' + esc(r.ref) + '</span><small>' + esc(stayLine(r)) + ' · ' + esc(STATUS[r.status].label) + '</small></span></button>';
    }).join('') : '<div class="pop-head">Aucun résultat</div>') + '</div>';
  }

  /* ======================================================================
     Dashboard
     ====================================================================== */
  function viewDashboard() {
    var t0 = today(), tIso = isoDay(t0), t7 = isoDay(addDays(t0, 7)), tomIso = isoDay(addDays(t0, 1));
    var list = S.list;
    var pending = list.filter(function (r) { return r.status === 'nouvelle'; }).sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
    var arrToday = list.filter(function (r) { return active(r) && r.status !== 'terminee' && r.arrival === tIso; });
    var inHouse = list.filter(function (r) { return r.status === 'arrivee' || (r.status === 'confirmee' && overlapsDay(r, tIso)); });
    var next7 = list.filter(function (r) { return occupying(r) && r.arrival > tIso && r.arrival <= t7; });
    var since = new Date(Date.now() - 90 * DAY).toISOString();
    var recent = list.filter(function (r) { return r.created_at >= since && r.status !== 'nouvelle'; });
    var conf = recent.filter(function (r) { return r.status !== 'annulee'; }).length;
    var rate = recent.length ? Math.round(conf / recent.length * 100) : null;
    var hour = new Date().getHours();
    var hello = hour < 5 || hour >= 18 ? 'Bonsoir' : 'Bonjour';

    var kpis = '<div class="kpis">' +
      kpi('À vérifier', 'inbox', pending.length, '', pending.length ? 'Demandes en attente de réponse' : 'Rien en attente', 'go-status:nouvelle', pending.length > 0) +
      kpi('Arrivées aujourd’hui', 'arrowIn', arrToday.length, '', arrToday.reduce(function (a, r) { return a + persons(r); }, 0) + ' personne(s)', 'go:calendar') +
      kpi('En séjour', 'bed', inHouse.reduce(function (a, r) { return a + persons(r); }, 0), 'pers.', inHouse.length + ' réservation(s)', 'go-status:arrivee') +
      kpi('Arrivées · 7 jours', 'calendar', next7.length, '', next7.reduce(function (a, r) { return a + persons(r); }, 0) + ' personne(s) attendue(s)', 'go:calendar') +
      kpi('Taux de confirmation', 'check', rate == null ? '—' : rate, rate == null ? '' : '%', 'Demandes traitées · 90 jours', 'go-status:confirmee') +
      '</div>';

    var queue = pending.length ? '<div class="queue">' + pending.slice(0, 8).map(function (r) {
      return '<button class="q-item" type="button" data-open="' + r.id + '"><span class="stripe" data-s="nouvelle"></span><span class="q-main"><strong>' + esc(r.name) + '</strong><span>' + esc(stayLine(r)) + ' · ' + esc(peopleText(r)) + '</span></span><span class="q-side">' + langTag(r.lang) + '<span>' + esc(relTime(r.created_at)) + '</span></span></button>';
    }).join('') + '</div>' : empty('Tout est à jour', 'Les nouvelles demandes du site apparaîtront ici.', 'check');

    function moves(iso) {
      var arr = list.filter(function (r) { return active(r) && r.status !== 'terminee' && r.arrival === iso; });
      var dep = list.filter(function (r) { return (r.status === 'arrivee' || r.status === 'confirmee') && r.departure === iso; });
      return arr.map(function (r) { return moveRow(r, 'in'); }).join('') + dep.map(function (r) { return moveRow(r, 'out'); }).join('');
    }
    var mt = moves(tIso), mm = moves(tomIso);
    var movesHtml = (mt || mm) ? '<div class="queue"><div class="day-label">Aujourd’hui</div>' + (mt || '<div class="empty" style="padding:1rem">Aucun mouvement</div>') + '<div class="day-label">Demain</div>' + (mm || '<div class="empty" style="padding:1rem">Aucun mouvement</div>') + '</div>' : empty('Aucune arrivée ni départ', 'Aujourd’hui et demain.', 'calendar');

    return '<div class="app-head"><div><h1>' + hello + ', ' + esc((S.me && S.me.name) || '') + '</h1><p>' + esc(fmtLong.format(new Date())) + '</p></div>' +
      '<div class="row"><button class="btn" type="button" data-act="export-all">' + icon('download') + 'Exporter</button><button class="btn btn-primary" type="button" data-act="new">' + icon('plus') + 'Nouvelle réservation</button></div></div>' +
      kpis +
      '<div class="g-2-1">' + panel('À vérifier', queue, { raw: true, sub: 'Demandes reçues, de la plus ancienne à la plus récente', action: pending.length > 8 ? '<a class="btn btn-ghost btn-sm" href="#/reservations" data-act="go-status:nouvelle">Tout voir</a>' : '' }) +
      panel('Arrivées et départs', movesHtml, { raw: true }) + '</div>' +
      panel('Occupation · 30 prochains jours', occupancyChart(), { raw: true, sub: 'Personnes attendues chaque nuit', action: '<div class="legend"><span><i style="background:var(--clay)"></i>Confirmées</span><span><i style="background:var(--saff);opacity:.55"></i>À vérifier</span></div>' }) +
      '<div class="g-3">' + panel('Chambres demandées', hbars(groupCount('room_type', ROOM))) + panel('Pension', hbars(groupCount('board', BOARD))) + panel('Langue des clients', hbars(groupCount('lang', LANG))) + '</div>';
  }
  function kpi(label, ic, value, unit, foot, act, alert) {
    return '<button class="kpi' + (alert ? ' alert' : '') + '" type="button" data-act="' + act + '"><span class="k-label">' + icon(ic) + esc(label) + '</span><span class="k-value">' + esc(value) + (unit ? '<small>' + esc(unit) + '</small>' : '') + '</span><span class="k-foot">' + esc(foot) + '</span></button>';
  }
  function moveRow(r, dir) {
    return '<button class="q-item" type="button" data-open="' + r.id + '"><span class="stripe" data-s="' + r.status + '"></span><span class="q-main"><strong>' + icon(dir === 'in' ? 'arrowIn' : 'arrowOut') + ' ' + esc(r.name) + '</strong><span>' + (dir === 'in' ? 'Arrivée' : 'Départ') + ' · ' + esc(peopleText(r)) + ' · ' + esc(ROOM[r.room_type]) + (r.room_label ? ' · ' + esc(r.room_label) : '') + '</span></span><span class="q-side">' + pill(r.status) + '</span></button>';
  }
  function groupCount(field, labels) {
    var m = {}; S.list.forEach(function (r) { if (active(r)) m[r[field]] = (m[r[field]] || 0) + 1; });
    return Object.keys(labels).map(function (k) { return { label: labels[k], value: m[k] || 0 }; });
  }
  function hbars(items) {
    var max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat([1])), tot = items.reduce(function (a, i) { return a + i.value; }, 0);
    if (!tot) return '<p class="muted" style="font-size:13.5px">Pas encore de données.</p>';
    return '<ul class="hbars">' + items.map(function (i) {
      return '<li><div class="hb-top"><span>' + esc(i.label) + '</span><span class="hb-val">' + i.value + ' · ' + Math.round(i.value / tot * 100) + ' %</span></div><div class="hb-track"><div class="hb-fill" style="width:' + (i.value / max * 100) + '%"></div></div></li>';
    }).join('') + '</ul>';
  }
  function occupancyChart() {
    var days = 30, t0 = today(), conf = [], pend = [], labels = [];
    for (var i = 0; i < days; i++) {
      var iso = isoDay(addDays(t0, i)), c = 0, p = 0;
      S.list.forEach(function (r) { if (!overlapsDay(r, iso)) return; if (occupying(r)) c += persons(r); else if (r.status === 'nouvelle') p += persons(r); });
      conf.push(c); pend.push(p); labels.push(addDays(t0, i));
    }
    var max = Math.max.apply(null, conf.map(function (c, i) { return c + pend[i]; }).concat([4]));
    var step = max <= 8 ? 2 : max <= 20 ? 5 : max <= 50 ? 10 : 20; max = Math.ceil(max / step) * step;
    var W = 900, H = 230, L = 30, B = 26, T = 8, cw = (W - L) / days, bw = Math.max(6, cw * .62);
    var svg = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Personnes attendues par nuit sur 30 jours">';
    for (var y = 0; y <= max; y += step) {
      var yy = T + (H - T - B) * (1 - y / max);
      svg += '<line class="chart-grid" x1="' + L + '" x2="' + W + '" y1="' + yy + '" y2="' + yy + '"/><text class="chart-axis" x="' + (L - 6) + '" y="' + (yy + 3) + '" text-anchor="end">' + y + '</text>';
    }
    for (i = 0; i < days; i++) {
      var x = L + i * cw + (cw - bw) / 2, hc = (H - T - B) * conf[i] / max, hp = (H - T - B) * pend[i] / max, base = H - B, d = labels[i];
      var tip = fmtDay.format(d) + ' : ' + conf[i] + ' confirmée(s)' + (pend[i] ? ', ' + pend[i] + ' à vérifier' : '');
      svg += '<g class="bar-hover"><title>' + esc(tip) + '</title>';
      if (hc) svg += '<rect class="' + (S.animate ? 'bar' : '') + '" x="' + x.toFixed(1) + '" y="' + (base - hc).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hc.toFixed(1) + '" rx="3" fill="var(--clay)" style="animation-delay:' + (i * 14) + 'ms"/>';
      if (hp) svg += '<rect class="' + (S.animate ? 'bar' : '') + '" x="' + x.toFixed(1) + '" y="' + (base - hc - hp).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hp.toFixed(1) + '" rx="3" fill="var(--saff)" opacity=".55" style="animation-delay:' + (i * 14) + 'ms"/>';
      if (!hc && !hp) svg += '<rect x="' + x.toFixed(1) + '" y="' + (base - 2) + '" width="' + bw.toFixed(1) + '" height="2" rx="1" fill="var(--line-strong)"/>';
      svg += '</g>';
      if (i % 3 === 0 || d.getDate() === 1) svg += '<text class="chart-axis" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle"' + (d.getDay() === 5 || d.getDay() === 6 ? ' style="fill:var(--clay)"' : '') + '>' + d.getDate() + (d.getDate() === 1 || i === 0 ? ' ' + fmtMonthShort.format(d) : '') + '</text>';
    }
    return '<div class="chart-box">' + svg + '</svg></div>';
  }

  /* ======================================================================
     Reservations list
     ====================================================================== */
  function filteredList() {
    var f = S.filter, tIso = isoDay(today()), q = f.q.toLowerCase().trim(), qd = q.replace(/\D/g, '');
    var rows = S.list.filter(function (r) {
      if (f.status !== 'all' && r.status !== f.status) return false;
      if (f.period === 'upcoming' && r.departure < tIso) return false;
      if (f.period === 'past' && r.departure >= tIso) return false;
      if (q && !(r.name.toLowerCase().indexOf(q) > -1 || r.ref.toLowerCase().indexOf(q) > -1 || (qd.length >= 3 && r.phone.replace(/\D/g, '').indexOf(qd) > -1) || (r.email || '').toLowerCase().indexOf(q) > -1)) return false;
      return true;
    });
    if (f.status === 'nouvelle') rows.sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
    else if (f.period === 'upcoming') rows.sort(function (a, b) { return a.arrival < b.arrival ? -1 : a.arrival > b.arrival ? 1 : 0; });
    else rows.sort(function (a, b) { return a.arrival > b.arrival ? -1 : 1; });
    return rows;
  }
  function viewReservations() {
    var c = counts(), f = S.filter, rows = filteredList();
    var chips = '<div class="chips" role="group" aria-label="Statut">' + ['all'].concat(STATUS_ORDER).map(function (s) {
      return '<button class="chip" type="button" data-status="' + s + '" aria-pressed="' + (f.status === s) + '">' + esc(s === 'all' ? 'Toutes' : STATUS[s].label) + ' <b>' + (c[s] || 0) + '</b></button>';
    }).join('') + '</div>';
    var bar = '<div class="filterbar"><label class="input-icon">' + icon('search') + '<span class="sr-only">Filtrer</span><input class="input" id="listSearch" type="search" placeholder="Nom, téléphone, référence…" value="' + esc(f.q) + '"></label>' +
      '<div class="segmented" role="group" aria-label="Période">' + [['upcoming', 'À venir'], ['past', 'Passées'], ['all', 'Tout']].map(function (p) {
        return '<button type="button" data-period="' + p[0] + '" aria-pressed="' + (f.period === p[0]) + '">' + p[1] + '</button>';
      }).join('') + '</div></div>';
    var table = rows.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Client</th><th>Séjour</th><th>Personnes</th><th>Chambre · pension</th><th>Statut</th><th>Référence</th></tr></thead><tbody>' + rows.map(function (r) {
      return '<tr data-open="' + r.id + '" tabindex="0"' + (r.status === 'nouvelle' ? ' class="is-new"' : '') + '>' +
        '<td data-c="client"><div class="cell-main">' + esc(r.name) + ' ' + langTag(r.lang) + '</div><div class="cell-sub mono">' + esc(r.phone) + '</div></td>' +
        '<td data-c="stay"><div class="cell-main">' + esc(dayLabel(r.arrival)) + ' → ' + esc(dayLabel(r.departure)) + '</div><div class="cell-sub">' + esc(nightsText(r.nights || diffDays(r.arrival, r.departure))) + '</div></td>' +
        '<td data-c="people"><div class="cell-main">' + esc(peopleText(r)) + '</div><div class="cell-sub">' + (r.extra_mattress ? '+ ' + r.extra_mattress + ' matelas' : '') + '</div></td>' +
        '<td data-c="room"><div class="cell-main">' + esc(ROOM[r.room_type]) + (r.room_label ? ' · ' + esc(r.room_label) : '') + '</div><div class="cell-sub">' + esc(BOARD[r.board]) + (r.activity !== 'aucune' ? ' · ' + esc(ACT[r.activity]) : '') + '</div></td>' +
        '<td data-c="status">' + pill(r.status) + '</td>' +
        '<td data-c="ref"><div class="cell-main mono">' + esc(r.ref) + '</div><div class="cell-sub">' + esc(SOURCE[r.source] || r.source) + ' · ' + esc(relTime(r.created_at)) + '</div></td></tr>';
    }).join('') + '</tbody></table></div><div class="list-foot">' + rows.length + ' réservation' + (rows.length > 1 ? 's' : '') + '</div>'
      : empty(S.list.length ? 'Aucune réservation ne correspond' : 'Aucune réservation pour l’instant', S.list.length ? 'Essayez un autre filtre.' : 'Les demandes envoyées depuis le site arriveront ici.');
    return '<div class="app-head"><div><h1>Demandes & réservations</h1><p>Vérifiez, confirmez et suivez chaque séjour.</p></div><div class="row"><button class="btn" type="button" data-act="export">' + icon('download') + 'Exporter (CSV)</button><button class="btn btn-primary" type="button" data-act="new">' + icon('plus') + 'Nouvelle</button></div></div>' +
      '<section class="panel">' + chips + bar + table + '</section>';
  }

  /* ======================================================================
     Calendar
     ====================================================================== */
  function viewCalendar() {
    if (!S.cal) { var t = today(); S.cal = new Date(t.getFullYear(), t.getMonth(), 1); }
    var m0 = S.cal, start = addDays(m0, -((m0.getDay() + 6) % 7)), tIso = isoDay(today());
    var shown = S.list.filter(active);
    var cells = '', agenda = '';
    var dim = new Date(m0.getFullYear(), m0.getMonth() + 1, 0).getDate(), total = Math.ceil((((m0.getDay() + 6) % 7) + dim) / 7) * 7;
    for (var i = 0; i < total; i++) {
      var d = addDays(start, i), iso = isoDay(d), out = d.getMonth() !== m0.getMonth();
      var evs = shown.filter(function (r) { return overlapsDay(r, iso) || r.departure === iso; })
        .sort(function (a, b) { return a.arrival < b.arrival ? -1 : 1; });
      var ppl = evs.filter(function (r) { return overlapsDay(r, iso) && r.status !== 'nouvelle'; }).reduce(function (a, r) { return a + persons(r); }, 0);
      var lim = S.calDay === iso ? 99 : 4;
      var items = evs.slice(0, lim).map(function (r) {
        var mark = r.arrival === iso ? '▶' : r.departure === iso ? '◀' : '';
        return '<button class="cal-ev" type="button" data-open="' + r.id + '" data-s="' + r.status + '" title="' + esc(r.name + ' · ' + stayLine(r) + ' · ' + STATUS[r.status].label) + '">' + (mark ? '<i>' + mark + '</i>' : '') + '<span>' + esc(r.name) + '</span></button>';
      }).join('');
      if (evs.length > lim) items += '<button class="cal-more" type="button" data-day="' + iso + '">+ ' + (evs.length - lim) + ' autre(s)</button>';
      cells += '<div class="cal-day' + (out ? ' out' : '') + (iso === tIso ? ' today' : '') + '"><div class="cal-top"><span class="cal-num">' + d.getDate() + '</span>' + (ppl ? '<span class="cal-count" title="Personnes sur place">' + ppl + ' pers.</span>' : '') + '</div>' + items + '</div>';
      if (!out) {
        var moves = evs.filter(function (r) { return r.arrival === iso || r.departure === iso; });
        if (moves.length) {
          agenda += '<div class="day-label">' + esc(fmtLong.format(d)) + (ppl ? ' · ' + ppl + ' pers.' : '') + '</div>' + moves.map(function (r) { return moveRow(r, r.arrival === iso ? 'in' : 'out'); }).join('');
        }
      }
    }
    var dows = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(function (x) { return '<div class="cal-dow">' + x + '</div>'; }).join('');
    return '<div class="app-head"><div class="cal-head"><button class="btn btn-icon" type="button" data-act="cal-prev" aria-label="Mois précédent">' + icon('left') + '</button><h2>' + esc(fmtMonth.format(m0)) + '</h2><button class="btn btn-icon" type="button" data-act="cal-next" aria-label="Mois suivant">' + icon('right') + '</button><button class="btn btn-sm" type="button" data-act="cal-today">Aujourd’hui</button></div>' +
      '<div class="legend"><span><i style="background:var(--ok-soft);border:1px solid var(--ok)"></i>Confirmée</span><span><i style="background:var(--saff-soft);border:1px solid var(--saff)"></i>À vérifier</span><span><i style="background:var(--blue-soft);border:1px solid var(--blue)"></i>En séjour</span><span>▶ arrivée · ◀ départ</span></div></div>' +
      '<section class="panel"><div class="cal">' + dows + cells + '</div><div class="agenda queue">' + (agenda || empty('Aucune arrivée ni départ ce mois-ci', '', 'calendar')) + '</div></section>';
  }

  /* ======================================================================
     Clients (regroupés par numéro de téléphone)
     ====================================================================== */
  function viewClients() {
    var map = {};
    S.list.slice().sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; }).forEach(function (r) {
      var k = phoneKey(r.phone) || r.phone;
      var c = map[k] || (map[k] = { name: r.name, phone: r.phone, email: r.email, lang: r.lang, stays: 0, nights: 0, last: null, lastRes: null, cancelled: 0 });
      c.name = r.name; c.phone = r.phone; c.email = r.email || c.email; c.lang = r.lang;
      if (r.status === 'annulee') c.cancelled++; else { c.stays++; c.nights += r.nights || 0; }
      if (!c.last || r.arrival > c.last) { c.last = r.arrival; c.lastRes = r; }
    });
    var q = S.clientsQ.toLowerCase().trim(), qd = q.replace(/\D/g, '');
    var rows = Object.keys(map).map(function (k) { return map[k]; }).filter(function (c) {
      return !q || c.name.toLowerCase().indexOf(q) > -1 || (qd.length >= 3 && c.phone.replace(/\D/g, '').indexOf(qd) > -1);
    }).sort(function (a, b) { return a.last > b.last ? -1 : 1; });
    var table = rows.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Client</th><th>Séjours</th><th>Dernier séjour</th><th>Contact</th></tr></thead><tbody>' + rows.map(function (c) {
      return '<tr data-open="' + c.lastRes.id + '" tabindex="0"><td data-c="client"><div class="cell-main">' + esc(c.name) + ' ' + langTag(c.lang) + (c.stays > 1 ? ' <span class="pill plain" data-tone="clay">' + icon('star') + ' Fidèle</span>' : '') + '</div><div class="cell-sub mono">' + esc(c.phone) + (c.email ? ' · ' + esc(c.email) : '') + '</div></td>' +
        '<td data-c="people"><div class="cell-main">' + c.stays + ' séjour' + (c.stays > 1 ? 's' : '') + '</div><div class="cell-sub">' + c.nights + ' nuit' + (c.nights > 1 ? 's' : '') + (c.cancelled ? ' · ' + c.cancelled + ' annulé(s)' : '') + '</div></td>' +
        '<td data-c="stay"><div class="cell-main">' + esc(dayLabel(c.last)) + '</div><div class="cell-sub">' + esc(STATUS[c.lastRes.status].label) + '</div></td>' +
        '<td data-c="status"><a class="btn btn-wa btn-sm" href="https://wa.me/' + waTo(c.lastRes) + '" target="_blank" rel="noopener" data-stop>' + icon('wa') + 'WhatsApp</a></td></tr>';
    }).join('') + '</tbody></table></div><div class="list-foot">' + rows.length + ' client' + (rows.length > 1 ? 's' : '') + '</div>' : empty(S.list.length ? 'Aucun client ne correspond' : 'Pas encore de clients', '', 'users');
    return '<div class="app-head"><div><h1>Clients</h1><p>Regroupés par numéro de téléphone, avec leur historique de séjours.</p></div><button class="btn" type="button" data-act="export-clients">' + icon('download') + 'Exporter (CSV)</button></div>' +
      '<section class="panel"><div class="filterbar"><label class="input-icon">' + icon('search') + '<span class="sr-only">Rechercher un client</span><input class="input" id="clientSearch" type="search" placeholder="Nom ou téléphone…" value="' + esc(S.clientsQ) + '"></label></div>' + table + '</section>';
  }

  /* ======================================================================
     Drawer: details, edit, history, new reservation
     ====================================================================== */
  var T = {
    fr: {
      room: ROOM, board: BOARD,
      hello: 'Bonjour {name},',
      confirm: '{hello}\nNous avons le plaisir de confirmer votre réservation au gîte Ledhas :\n• Du {arr} au {dep} ({nights})\n• {room}{mattress}\n• {people}\n• {board}\nRéférence : {ref}\n\nLocalisation : {maps}\nÀ très bientôt à Massine !',
      info: '{hello}\nMerci pour votre demande de séjour au gîte Ledhas du {arr} au {dep} (réf. {ref}).\nPourriez-vous nous préciser ',
      remind: '{hello}\nNous vous attendons le {arr} au gîte Ledhas, à Massine (Timimoun).\nLocalisation : {maps}\nN’hésitez pas à nous écrire pour l’heure d’arrivée. Bon voyage !',
      full: '{hello}\nMerci pour votre demande (réf. {ref}). Nous sommes désolés, le gîte est complet du {arr} au {dep}.\nSouhaitez-vous que nous vous proposions d’autres dates ?',
      free: '{hello}\n',
      nights1: '1 nuit', nightsN: '{n} nuits', adults: ['1 adulte', '{n} adultes'], children: ['1 enfant', '{n} enfants'], mattress: [' + 1 matelas supplémentaire', ' + {n} matelas supplémentaires'], subject: 'Votre séjour au gîte Ledhas ({ref})'
    },
    en: {
      room: { double: 'Double room', triple: 'Triple room', quadruple: 'Quadruple room' }, board: { pdj: 'Breakfast included', demi: 'Half board', complete: 'Full board' },
      hello: 'Hello {name},',
      confirm: '{hello}\nWe are happy to confirm your booking at Ledhas guesthouse:\n• From {arr} to {dep} ({nights})\n• {room}{mattress}\n• {people}\n• {board}\nReference: {ref}\n\nLocation: {maps}\nSee you soon in Massine!',
      info: '{hello}\nThank you for your request to stay at Ledhas guesthouse from {arr} to {dep} (ref. {ref}).\nCould you please tell us ',
      remind: '{hello}\nWe look forward to welcoming you on {arr} at Ledhas guesthouse in Massine (Timimoun).\nLocation: {maps}\nFeel free to message us with your arrival time. Safe travels!',
      full: '{hello}\nThank you for your request (ref. {ref}). Unfortunately the guesthouse is fully booked from {arr} to {dep}.\nWould you like us to suggest other dates?',
      free: '{hello}\n',
      nights1: '1 night', nightsN: '{n} nights', adults: ['1 adult', '{n} adults'], children: ['1 child', '{n} children'], mattress: [' + 1 extra mattress', ' + {n} extra mattresses'], subject: 'Your stay at Ledhas guesthouse ({ref})'
    },
    ar: {
      room: { double: 'غرفة ثنائية', triple: 'غرفة ثلاثية', quadruple: 'غرفة رباعية' }, board: { pdj: 'فطور الصباح مشمول', demi: 'نصف إقامة', complete: 'إقامة كاملة' },
      hello: 'مرحبًا {name}،',
      confirm: '{hello}\nيسعدنا تأكيد حجزكم في نُزُل لدهاس:\n• من {arr} إلى {dep} ({nights})\n• {room}{mattress}\n• {people}\n• {board}\nرقم الحجز: {ref}\n\nالموقع: {maps}\nنراكم قريبًا في ماسين!',
      info: '{hello}\nشكرًا على طلب الإقامة في نُزُل لدهاس من {arr} إلى {dep} (رقم {ref}).\nهل يمكنكم أن توضحوا لنا ',
      remind: '{hello}\nننتظركم يوم {arr} في نُزُل لدهاس بماسين (تيميمون).\nالموقع: {maps}\nلا تترددوا في مراسلتنا لإخبارنا بساعة الوصول. رحلة سعيدة!',
      full: '{hello}\nشكرًا على طلبكم (رقم {ref}). نعتذر، النُزُل محجوز بالكامل من {arr} إلى {dep}.\nهل تريدون أن نقترح عليكم تواريخ أخرى؟',
      free: '{hello}\n',
      nights1: 'ليلة واحدة', nightsN: '{n} ليالٍ', nights2: 'ليلتان', adults: ['بالغ واحد', '{n} بالغين', 'بالغان'], children: ['طفل واحد', '{n} أطفال', 'طفلان'], mattress: [' + فراش إضافي', ' + {n} أفرشة إضافية', ' + فراشان إضافيان'], subject: 'إقامتكم في نُزُل لدهاس ({ref})'
    }
  };
  var TEMPLATES = [
    { k: 'confirm', label: 'Confirmation du séjour', sub: 'Dates, chambre, pension, référence et localisation' },
    { k: 'info', label: 'Demander une précision', sub: 'Message à compléter avant l’envoi' },
    { k: 'remind', label: 'Rappel avant l’arrivée', sub: 'Avec le lien Google Maps du gîte' },
    { k: 'full', label: 'Pas de disponibilité', sub: 'Propose d’autres dates' },
    { k: 'free', label: 'Message libre', sub: 'Juste la salutation' }
  ];
  function guestDate(s, lang) {
    var d = parseDay(s); if (!d) return s;
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : lang === 'en' ? 'en-GB' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  }
  function buildTemplate(r, k) {
    var L = T[r.lang] || T.fr, n = r.nights || diffDays(r.arrival, r.departure);
    function pl(a, k) { return (k === 1 ? a[0] : k === 2 && a[2] ? a[2] : a[1]).replace('{n}', k); }
    var people = pl(L.adults, r.adults) + (r.children ? (r.lang === 'ar' ? ' و' : ', ') + pl(L.children, r.children) : '');
    var vars = {
      name: r.name.split(/\s+/)[0], arr: guestDate(r.arrival, r.lang), dep: guestDate(r.departure, r.lang), ref: r.ref, maps: MAPS,
      nights: n === 1 ? L.nights1 : n === 2 && L.nights2 ? L.nights2 : L.nightsN.replace('{n}', n), room: L.room[r.room_type], board: L.board[r.board], people: people,
      mattress: r.extra_mattress ? pl(L.mattress, r.extra_mattress) : ''
    };
    var txt = L[k].replace('{hello}', L.hello);
    return txt.replace(/\{(\w+)\}/g, function (m, v) { return vars[v] != null ? vars[v] : m; });
  }

  function statusActions(r) {
    var b = [];
    if (r.status === 'nouvelle') { b.push(['confirmee', 'Confirmer la réservation', 'btn-ok', 'check']); b.push(['annulee', 'Refuser / annuler', 'btn-danger', 'x']); }
    if (r.status === 'confirmee') { b.push(['arrivee', 'Client arrivé', 'btn-primary', 'arrowIn']); b.push(['nouvelle', 'Remettre à vérifier', '', 'clock']); b.push(['annulee', 'Annuler', 'btn-danger', 'x']); }
    if (r.status === 'arrivee') { b.push(['terminee', 'Séjour terminé', 'btn-primary', 'arrowOut']); b.push(['confirmee', 'Pas encore arrivé', '', 'clock']); }
    if (r.status === 'terminee') { b.push(['arrivee', 'Rouvrir le séjour', '', 'refresh']); }
    if (r.status === 'annulee') { b.push(['nouvelle', 'Rouvrir la demande', '', 'refresh']); }
    return b.map(function (x) { return '<button class="btn ' + x[2] + '" type="button" data-setstatus="' + x[0] + '">' + icon(x[3]) + esc(x[1]) + '</button>'; }).join('');
  }

  function renderDrawer(withOverlay) {
    var d = S.drawer; if (!d) return '';
    var enter = d.fresh ? ' enter' : ''; d.fresh = false;
    var out = '<div class="overlay drawer-overlay' + enter + '" data-act="close-drawer"></div><aside class="drawer' + enter + '" role="dialog" aria-modal="true" aria-labelledby="drawerTitle">';
    if (d.id === 'new') return out + drawerForm(null) + '</aside>';
    var r = S.byId[d.id];
    if (!r) return out + '<div class="drawer-head"><div class="dh-top"><button class="btn btn-ghost btn-icon" type="button" data-act="close-drawer" aria-label="Fermer">' + icon('x') + '</button></div></div><div class="drawer-body">' + empty('Réservation introuvable', 'Elle a peut-être été supprimée.') + '</div></aside>';
    var n = r.nights || diffDays(r.arrival, r.departure);
    out += '<div class="drawer-head"><div class="dh-top"><span class="mono">' + esc(r.ref) + '</span>' + pill(r.status) + '<button class="btn btn-ghost btn-icon" type="button" data-act="close-drawer" aria-label="Fermer">' + icon('x') + '</button></div>' +
      '<h2 id="drawerTitle">' + esc(r.name) + '</h2><div class="dh-meta"><span>' + esc(SOURCE[r.source] || r.source) + ' · reçue ' + esc(relTime(r.created_at)) + '</span><span>Langue : ' + esc(LANG[r.lang] || r.lang) + '</span></div>' +
      '<div class="tabs" role="tablist">' + [['details', 'Détails'], ['edit', 'Modifier'], ['history', 'Historique']].map(function (t) {
        return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (d.tab === t[0]) + '">' + t[1] + '</button>';
      }).join('') + '</div></div><div class="drawer-body">';
    if (d.tab === 'edit') out += drawerForm(r);
    else if (d.tab === 'history') out += drawerHistory(r);
    else {
      var due = r.price_total != null ? Math.max(0, (+r.price_total) - (+r.deposit || 0)) : null;
      out += '<div class="action-bar">' + statusActions(r) + '</div>' +
        '<div class="card"><div class="card-title">Contact</div><div class="contact-line"><span class="mono">' + esc(r.phone) + '</span><button class="btn btn-ghost btn-icon btn-sm" type="button" data-copy="' + esc(r.phone) + '" title="Copier" aria-label="Copier le numéro">' + icon('copy') + '</button>' + (r.email ? '<span class="muted">·</span><span>' + esc(r.email) + '</span>' : '') + '</div>' +
        '<div class="row"><div class="menu"><button class="btn btn-wa" type="button" data-act="wa-menu" aria-expanded="' + !!d.waMenu + '">' + icon('wa') + 'WhatsApp' + icon('chevron') + '</button>' +
        (d.waMenu ? '<div class="menu-list">' + TEMPLATES.map(function (t) { return '<button type="button" data-wa="' + t.k + '">' + esc(t.label) + '<small>' + esc(t.sub) + '</small></button>'; }).join('') + '</div>' : '') + '</div>' +
        '<a class="btn" href="' + (r.demo_seed ? '#' : 'tel:' + esc(String(r.phone).replace(/[^\d+]/g, ''))) + '" data-contact="call"' + (r.demo_seed ? ' data-demo-call' : '') + '>' + icon('phone') + 'Appeler</a>' +
        (r.email ? '<a class="btn" href="mailto:' + esc(r.email) + '?subject=' + encodeURIComponent((T[r.lang] || T.fr).subject.replace('{ref}', r.ref)) + '&body=' + encodeURIComponent(buildTemplate(r, 'confirm')) + '" data-contact="email">' + icon('mail') + 'E-mail</a>' : '') + '</div></div>' +
        '<div class="card"><div class="card-title">Séjour</div><div class="stay-strip"><div class="d"><span>Arrivée</span><b>' + esc(dayLabel(r.arrival)) + '</b></div><span class="n">' + esc(nightsText(n)) + '</span><div class="d"><span>Départ</span><b>' + esc(dayLabel(r.departure)) + '</b></div></div>' +
        '<dl class="dl"><div><dt>Adultes</dt><dd>' + r.adults + '</dd></div><div><dt>Enfants</dt><dd>' + r.children + '</dd></div><div><dt>Matelas sup.</dt><dd>' + (r.extra_mattress || 'Non') + '</dd></div>' +
        '<div><dt>Chambre</dt><dd>' + esc(ROOM[r.room_type]) + '</dd></div><div><dt>Pension</dt><dd>' + esc(BOARD[r.board]) + '</dd></div><div><dt>Activité</dt><dd>' + esc(ACT[r.activity]) + '</dd></div>' +
        '<div><dt>Chambre attribuée</dt><dd>' + esc(r.room_label || '—') + '</dd></div></dl>' +
        (r.message ? '<div class="stack" style="--gap:.35rem"><span class="muted" style="font-size:12px">Message du client</span><div class="quote">' + esc(r.message) + '</div></div>' : '') + '</div>' +
        '<div class="card"><div class="card-title">Paiement <button class="btn btn-ghost btn-sm" type="button" data-tab="edit">' + icon('edit') + 'Modifier</button></div><div class="money-row"><div><span>Prix total</span><b>' + money(r.price_total) + '</b></div><div><span>Acompte reçu</span><b class="paid">' + money(r.deposit) + '</b></div><div><span>Reste à payer</span><b class="due">' + money(due) + '</b></div></div></div>' +
        '<div class="card"><div class="card-title">Notes internes <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:500">visibles seulement par l’équipe</span></div><textarea class="textarea" id="notesBox" placeholder="Ex. arrivée vers 18 h, allergie, transfert depuis l’aéroport…">' + esc(r.admin_notes || '') + '</textarea><div class="row" style="justify-content:flex-end"><button class="btn btn-sm" type="button" data-act="save-notes">Enregistrer la note</button></div></div>';
    }
    return out + '</div></aside>';
  }

  function opt(map, val) { return Object.keys(map).map(function (k) { return '<option value="' + k + '"' + (k === val ? ' selected' : '') + '>' + esc(map[k]) + '</option>'; }).join(''); }
  function drawerForm(r) {
    var isNew = !r, d = S.drawer, t = isoDay(today());
    r = r || { name: '', phone: '', email: '', arrival: t, departure: isoDay(addDays(today(), 1)), adults: 2, children: 0, room_type: 'double', extra_mattress: 0, board: 'pdj', activity: 'aucune', source: 'telephone', lang: 'fr', status: 'confirmee', message: '' };
    var head = isNew ? '<div class="drawer-head"><div class="dh-top"><span class="mono">Nouvelle réservation</span><button class="btn btn-ghost btn-icon" type="button" data-act="close-drawer" aria-label="Fermer">' + icon('x') + '</button></div><h2 id="drawerTitle">Ajouter une réservation</h2><div class="dh-meta"><span>Pour une réservation prise par téléphone, sur WhatsApp ou sur place.</span></div></div><div class="drawer-body">' : '';
    var f = '<form class="stack" id="resForm" novalidate data-mode="' + (isNew ? 'new' : 'edit') + '">' +
      '<div class="card"><div class="card-title">Client</div><div class="form-grid">' +
      '<label class="field full"><span>Nom complet</span><input class="input" name="name" required minlength="2" maxlength="80" value="' + esc(r.name) + '"></label>' +
      '<label class="field"><span>Téléphone</span><input class="input" name="phone" type="tel" required value="' + esc(r.phone) + '" placeholder="0550 00 00 00"></label>' +
      '<label class="field"><span>E-mail <small>(facultatif)</small></span><input class="input" name="email" type="email" value="' + esc(r.email || '') + '"></label>' +
      '<label class="field"><span>Langue du client</span><select class="select" name="lang">' + opt(LANG, r.lang) + '</select></label>' +
      '<label class="field"><span>Origine</span><select class="select" name="source">' + opt(SOURCE, r.source) + '</select></label></div></div>' +
      '<div class="card"><div class="card-title">Séjour</div><div class="form-grid">' +
      '<label class="field"><span>Arrivée</span><input class="input" name="arrival" type="date" required value="' + esc(r.arrival) + '"></label>' +
      '<label class="field"><span>Départ</span><input class="input" name="departure" type="date" required value="' + esc(r.departure) + '"></label>' +
      '<label class="field"><span>Adultes</span><input class="input" name="adults" type="number" min="1" max="40" required value="' + r.adults + '"></label>' +
      '<label class="field"><span>Enfants</span><input class="input" name="children" type="number" min="0" max="20" value="' + r.children + '"></label>' +
      '<label class="field"><span>Type de chambre</span><select class="select" name="room_type">' + opt(ROOM, r.room_type) + '</select></label>' +
      '<label class="field"><span>Matelas supplémentaire</span><select class="select" name="extra_mattress">' + opt({ 0: 'Non', 1: '1 matelas', 2: '2 matelas' }, String(r.extra_mattress)) + '</select></label>' +
      '<label class="field"><span>Pension</span><select class="select" name="board">' + opt(BOARD, r.board) + '</select></label>' +
      '<label class="field"><span>Activité</span><select class="select" name="activity">' + opt(ACT, r.activity) + '</select></label>' +
      '<label class="field"><span>Chambre attribuée <small>(facultatif)</small></span><input class="input" name="room_label" maxlength="40" value="' + esc(r.room_label || '') + '" placeholder="Ex. Chambre 3"></label>' +
      (isNew ? '<label class="field"><span>Statut</span><select class="select" name="status">' + opt({ confirmee: 'Confirmée', nouvelle: 'À vérifier' }, r.status) + '</select></label>' : '') +
      '<label class="field full"><span>Message / demande du client</span><textarea class="textarea" name="message" maxlength="1000">' + esc(r.message || '') + '</textarea></label></div></div>' +
      '<div class="card"><div class="card-title">Paiement</div><div class="form-grid">' +
      '<label class="field"><span>Prix total (DA)</span><input class="input" name="price_total" type="number" min="0" step="100" inputmode="numeric" value="' + (r.price_total != null ? +r.price_total : '') + '"></label>' +
      '<label class="field"><span>Acompte reçu (DA)</span><input class="input" name="deposit" type="number" min="0" step="100" inputmode="numeric" value="' + (r.deposit != null ? +r.deposit : '') + '"></label></div></div>' +
      '<p class="error-text" id="formErr" role="alert" hidden></p>' +
      '<div class="form-actions"><div class="row">' + (isNew ? '' : '<button class="btn btn-danger' + (d && d.delArmed ? ' armed' : '') + '" type="button" data-act="delete">' + icon('trash') + (d && d.delArmed ? 'Confirmer la suppression' : 'Supprimer') + '</button>') + '</div>' +
      '<div class="row"><button class="btn" type="button" data-act="' + (isNew ? 'close-drawer' : 'cancel-edit') + '">Annuler</button><button class="btn btn-primary" type="submit">' + icon('check') + (isNew ? 'Ajouter' : 'Enregistrer') + '</button></div></div></form>';
    return head + f + (isNew ? '</div>' : '');
  }

  function drawerHistory(r) {
    var d = S.drawer;
    if (!d.events) return '<div class="loader" style="min-height:160px"><div class="spinner"></div></div>';
    if (!d.events.length) return empty('Aucun historique', '', 'clock');
    var TPL = {}; TEMPLATES.forEach(function (t) { TPL[t.k] = t.label; });
    return '<ul class="timeline">' + d.events.map(function (e) {
      var main = '', ic = 'clock', det = e.detail || {};
      if (e.kind === 'created') { main = 'Demande créée (' + (SOURCE[det.source] || det.source || '') + ')'; ic = 'plus'; }
      else if (e.kind === 'status') { main = 'Statut : ' + (STATUS[det.from] ? STATUS[det.from].label : det.from) + ' → <b>' + esc(STATUS[det.to] ? STATUS[det.to].label : det.to) + '</b>'; ic = 'check'; }
      else if (e.kind === 'edit') { main = 'Modifié : ' + esc((det.fields || []).map(function (f) { return FIELD_LABEL[f] || f; }).join(', ')); ic = 'edit'; }
      else if (e.kind === 'contact') { main = det.channel === 'whatsapp' ? 'Message WhatsApp ouvert · ' + esc(TPL[det.template] || det.template || '') : det.channel === 'call' ? 'Appel téléphonique' : det.channel === 'email' ? 'E-mail ouvert' : 'Contact'; ic = det.channel === 'whatsapp' ? 'wa' : det.channel === 'call' ? 'phone' : 'mail'; }
      else { main = esc(e.kind); }
      return '<li><span class="dot" data-k="' + esc(e.kind) + '">' + icon(ic) + '</span><div><div class="t-main">' + (e.kind === 'status' ? main : main) + '</div><div class="t-sub">' + esc(fmtStamp.format(new Date(e.at))) + ' · ' + esc(e.actor_name || (e.actor ? 'Équipe' : 'Site web')) + '</div></div></li>';
    }).join('') + '</ul>';
  }

  function openDrawer(id, tab) {
    S.drawer = { id: id, tab: tab || 'details', events: null, waMenu: false, delArmed: false, fresh: !S.drawer };
    S.sbOpen = false;
    if (S.search) { S.search = ''; renderSearch(); var gs = document.getElementById('globalSearch'); if (gs) gs.value = ''; }
    rerenderDrawer();
    var close = app.querySelector('.drawer [data-act="close-drawer"]'); if (close) close.focus();
  }
  function closeDrawer() { S.drawer = null; app.querySelectorAll('.drawer, .drawer-overlay').forEach(function (n) { n.remove(); }); }
  function loadEvents() {
    var d = S.drawer; if (!d || d.id === 'new') return;
    var id = d.id;
    db.events(id).then(function (ev) { if (S.drawer && S.drawer.id === id) { S.drawer.events = ev || []; if (S.drawer.tab === 'history') rerenderDrawer(); } })
      .catch(function (e) { if (S.drawer && S.drawer.id === id) { S.drawer.events = []; toast('Historique indisponible', { bad: true, sub: e.message }); rerenderDrawer(); } });
  }

  /* ---------- Saving ---------- */
  function readForm(form) {
    var g = function (n) { var el = form.elements[n]; return el ? el.value.trim() : ''; };
    var num = function (n) { var v = g(n); return v === '' ? null : Number(v); };
    var row = {
      name: g('name'), phone: g('phone'), email: g('email') || null, lang: g('lang'), source: g('source'),
      arrival: g('arrival'), departure: g('departure'), adults: num('adults'), children: num('children') || 0,
      room_type: g('room_type'), extra_mattress: Number(g('extra_mattress')) || 0, board: g('board'), activity: g('activity'),
      room_label: g('room_label') || null, message: g('message') || null, price_total: num('price_total'), deposit: num('deposit')
    };
    if (form.elements.status) row.status = g('status');
    var err = '';
    if (row.name.length < 2) err = 'Indiquez le nom du client.';
    else if (String(row.phone).replace(/\D/g, '').length < 6) err = 'Indiquez un numéro de téléphone valide.';
    else if (row.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) err = 'L’adresse e-mail n’est pas valide.';
    else if (!row.arrival || !row.departure || row.departure <= row.arrival) err = 'La date de départ doit être après la date d’arrivée.';
    else if (diffDays(row.arrival, row.departure) > 60) err = 'Un séjour ne peut pas dépasser 60 nuits.';
    else if (!row.adults || row.adults < 1) err = 'Il faut au moins un adulte.';
    else if (row.price_total != null && row.deposit != null && row.deposit > row.price_total) err = 'L’acompte dépasse le prix total.';
    return { row: row, err: err };
  }
  function busy(btn, on) { if (!btn) return; btn.disabled = on; if (on) { btn.dataset.html = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span>' + btn.textContent; } else if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }

  function setStatus(r, status, btn) {
    busy(btn, true);
    db.update(r.id, { status: status }).then(function (row) {
      upsertRow(row); if (S.drawer) S.drawer.events = null; loadEvents();
      rerenderContent(); rerenderDrawer();
      toast(STATUS[status].label + ' · ' + row.name, { sub: status === 'confirmee' ? 'Pensez à envoyer la confirmation sur WhatsApp.' : '' });
      if (status === 'confirmee') { S.drawer.waMenu = true; rerenderDrawer(); }
    }).catch(function (e) { busy(btn, false); toast('Impossible de changer le statut', { bad: true, sub: e.message }); });
  }

  /* ---------- CSV ---------- */
  function csv(name, rows) {
    var body = rows.map(function (r) { return r.map(function (v) { v = v == null ? '' : String(v); return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';'); }).join('\r\n');
    var blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportReservations(list) {
    csv('reservations-ledhas-' + isoDay(new Date()) + '.csv', [['Référence', 'Statut', 'Reçue le', 'Origine', 'Nom', 'Téléphone', 'E-mail', 'Langue', 'Arrivée', 'Départ', 'Nuits', 'Adultes', 'Enfants', 'Chambre', 'Matelas sup.', 'Pension', 'Activité', 'Chambre attribuée', 'Prix total (DA)', 'Acompte (DA)', 'Message', 'Notes internes']].concat(list.map(function (r) {
      return [r.ref, STATUS[r.status].label, r.created_at.slice(0, 10), SOURCE[r.source], r.name, r.phone, r.email, LANG[r.lang], r.arrival, r.departure, r.nights, r.adults, r.children, ROOM[r.room_type], r.extra_mattress, BOARD[r.board], ACT[r.activity], r.room_label, r.price_total, r.deposit, r.message, r.admin_notes];
    })));
  }

  /* ======================================================================
     Data loading & auto-refresh
     ====================================================================== */
  var pollTimer = null;
  function load(silent) {
    return db.list().then(function (rows) {
      var before = S.known;
      setList(rows);
      var fresh = before ? S.list.filter(function (r) { return !before[r.id] && r.status === 'nouvelle'; }) : [];
      S.known = {}; S.list.forEach(function (r) { S.known[r.id] = 1; });
      if (S.view === 'app') {
        var active = document.activeElement, keepId = active && active.id, pos = active && active.selectionStart;
        rerenderContent(); if (S.drawer && !silent) rerenderDrawer();
        if (keepId) { var el = document.getElementById(keepId); if (el && el !== active) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} } }
        updateSyncNote();
      }
      fresh.forEach(function (r) {
        toast('Nouvelle demande : ' + r.name, { icon: 'inbox', sub: stayLine(r) + ' · ' + peopleText(r), long: true, onClick: function () { openDrawer(r.id); } });
      });
    }).catch(function (e) { if (!silent) toast('Chargement impossible', { bad: true, sub: e.message }); });
  }
  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(function () { if (document.visibilityState === 'visible' && S.view === 'app') load(true); }, 60000);
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && S.view === 'app' && Date.now() - S.loadedAt > 30000) load(true); });

  /* ======================================================================
     Boot, auth flows, routing
     ====================================================================== */
  function onSignedOut(msg) {
    clearInterval(pollTimer); saveSession(null); S.me = null; S.drawer = null; S.known = null; setList([]);
    S.view = 'login'; renderLogin('login', msg ? { text: msg } : null);
  }
  function enterApp() {
    S.view = 'loading'; renderLoading('Vérification de l’accès…');
    return db.me().then(function (rows) {
      if (!rows || !rows.length) { S.view = 'denied'; renderDenied(); return; }
      S.me = rows[0];
      return db.list().then(function (list) {
        setList(list); S.known = {}; S.list.forEach(function (r) { S.known[r.id] = 1; });
        S.view = 'app'; readRoute(); renderApp(); startPolling();
      });
    }).catch(function (e) {
      if (!session) return;
      S.view = 'login'; renderLogin('login', { text: e.message });
    });
  }
  function readRoute() {
    var h = location.hash.replace(/^#\/?/, '').split('?')[0];
    S.route = TITLES[h] ? h : 'dashboard';
  }
  window.addEventListener('hashchange', function () {
    if (S.view !== 'app') return;
    var prev = S.route; readRoute(); S.sbOpen = false;
    if (prev !== S.route) { renderApp(); window.scrollTo(0, 0); }
  });

  function boot() {
    if (DEMO) {
      if (session && session.access_token === 'demo') enterApp(); else { if (session) saveSession(null); S.view = 'login'; renderLogin(); }
      window.addEventListener('storage', function (e) { if (S.view === 'app' && (e.key === DEMO_API.INBOX || e.key === DEMO_API.KEY)) load(true); });
      return;
    }
    if (!CONFIGURED) { S.view = 'config'; renderConfig(); return; }
    if (session && session.access_token === 'demo') saveSession(null);
    // Lien « mot de passe oublié » : #access_token=…&type=recovery
    var hp = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (hp.get('access_token') && hp.get('type') === 'recovery') {
      saveSession({ access_token: hp.get('access_token'), refresh_token: hp.get('refresh_token'), expires_in: +hp.get('expires_in') || 3600, user: {} });
      history.replaceState(null, '', location.pathname);
      S.view = 'recovery'; renderRecovery(); return;
    }
    if (hp.get('error_description')) { history.replaceState(null, '', location.pathname); S.view = 'login'; renderLogin('login', { text: hp.get('error_description').replace(/\+/g, ' ') }); return; }
    if (session && session.access_token && session.user && session.user.id) enterApp();
    else { S.view = 'login'; renderLogin(); }
  }

  /* ======================================================================
     Events (delegation)
     ====================================================================== */
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form.id === 'loginForm') {
      e.preventDefault();
      var email = form.elements.email.value.trim(), pw = form.elements.password.value, btn = form.querySelector('[type=submit]');
      if (!email || !pw) { renderLogin('login', { text: 'Saisissez votre adresse e-mail et votre mot de passe.' }); return; }
      if (DEMO) {
        var ds = DEMO_API.login(email, pw);
        if (!ds) { renderLogin('login', { text: 'En mode démo, utilisez ' + DEMO_API.email + ' / ' + DEMO_API.password + '.' }); var dm = app.querySelector('[name=email]'); if (dm) dm.value = email; return; }
        saveSession(ds); enterApp(); return;
      }
      busy(btn, true);
      rawFetch('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email, password: pw } }).then(function (r) {
        if (!r.ok || !r.body || !r.body.access_token) { renderLogin('login', { text: errMessage(r.body, r.status) }); var em = app.querySelector('[name=email]'); if (em) em.value = email; return; }
        saveSession(r.body); enterApp();
      });
    } else if (form.id === 'resetForm') {
      e.preventDefault();
      var em2 = form.elements.email.value.trim(); if (!em2) return;
      if (DEMO) { renderLogin('reset', { text: 'Pas disponible en mode démo. Le compte de démonstration est ' + DEMO_API.email + ' / ' + DEMO_API.password + '.' }); return; }
      busy(form.querySelector('[type=submit]'), true);
      rawFetch('/auth/v1/recover?redirect_to=' + encodeURIComponent(location.origin + location.pathname), { method: 'POST', body: { email: em2 } }).then(function (r) {
        renderLogin('reset', r.ok ? { ok: true, text: 'Si ce compte existe, un e-mail vient de lui être envoyé.' } : { text: errMessage(r.body, r.status) });
      });
    } else if (form.id === 'newPassForm') {
      e.preventDefault();
      var p1 = form.elements.password.value, p2 = form.elements.password2.value;
      if (p1.length < 8) { renderRecovery('Le mot de passe doit contenir au moins 8 caractères.'); return; }
      if (p1 !== p2) { renderRecovery('Les deux mots de passe ne correspondent pas.'); return; }
      busy(form.querySelector('[type=submit]'), true);
      rawFetch('/auth/v1/user', { method: 'PUT', token: session.access_token, body: { password: p1 } }).then(function (r) {
        if (!r.ok) { renderRecovery(errMessage(r.body, r.status)); return; }
        saveSession(null); S.view = 'login'; renderLogin('login', { ok: true, text: 'Mot de passe modifié. Connectez-vous.' });
      });
    } else if (form.id === 'resForm') {
      e.preventDefault();
      var res = readForm(form), errEl = document.getElementById('formErr'), sb = form.querySelector('[type=submit]');
      if (res.err) { errEl.textContent = res.err; errEl.hidden = false; return; }
      errEl.hidden = true; busy(sb, true);
      var isNew = form.dataset.mode === 'new';
      var p = isNew ? db.create(res.row) : db.update(S.drawer.id, res.row);
      p.then(function (row) {
        upsertRow(row); rerenderContent();
        S.drawer = { id: row.id, tab: 'details', events: null };
        rerenderDrawer(); loadEvents();
        toast(isNew ? 'Réservation ajoutée · ' + row.ref : 'Modifications enregistrées');
      }).catch(function (err) { busy(sb, false); errEl.textContent = err.message; errEl.hidden = false; });
    }
  });

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act],[data-open],[data-status],[data-period],[data-tab],[data-setstatus],[data-wa],[data-copy],[data-contact],[data-day]');
    if (!t) { if (S.drawer && S.drawer.waMenu && !e.target.closest('.menu')) { S.drawer.waMenu = false; rerenderDrawer(); } return; }
    if (t.hasAttribute('data-stop') ) return;
    var act = t.getAttribute('data-act');

    if (t.hasAttribute('data-open') && !e.target.closest('[data-stop]')) { openDrawer(t.getAttribute('data-open')); return; }
    if (t.hasAttribute('data-status')) { S.filter.status = t.getAttribute('data-status'); if (S.filter.status === 'nouvelle') S.filter.period = 'all'; rerenderContent(); return; }
    if (t.hasAttribute('data-period')) { S.filter.period = t.getAttribute('data-period'); rerenderContent(); return; }
    if (t.hasAttribute('data-tab')) {
      S.drawer.tab = t.getAttribute('data-tab'); S.drawer.delArmed = false; S.drawer.waMenu = false;
      if (S.drawer.tab === 'history' && !S.drawer.events) loadEvents();
      rerenderDrawer(); return;
    }
    if (t.hasAttribute('data-day')) { S.calDay = t.getAttribute('data-day'); rerenderContent(); return; }
    var r = S.drawer && S.byId[S.drawer.id];
    if (t.hasAttribute('data-setstatus') && r) { setStatus(r, t.getAttribute('data-setstatus'), t); return; }
    if (t.hasAttribute('data-wa') && r) {
      var k = t.getAttribute('data-wa');
      window.open('https://wa.me/' + waTo(r) + '?text=' + encodeURIComponent(buildTemplate(r, k)), '_blank', 'noopener');
      S.drawer.waMenu = false; rerenderDrawer();
      db.logContact(r.id, { channel: 'whatsapp', template: k }).then(function () { if (S.drawer && S.drawer.id === r.id) { S.drawer.events = null; loadEvents(); } }).catch(function () {});
      return;
    }
    if (t.hasAttribute('data-demo-call')) { e.preventDefault(); toast('Numéro fictif (démo)', { sub: 'Sur une vraie réservation, ce bouton lance l’appel.' }); }
    if (t.hasAttribute('data-contact') && r) { db.logContact(r.id, { channel: t.getAttribute('data-contact') }).then(function () { if (S.drawer && S.drawer.id === r.id) { S.drawer.events = null; loadEvents(); } }).catch(function () {}); return; }
    if (t.hasAttribute('data-copy')) {
      var txt = t.getAttribute('data-copy');
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast('Numéro copié'); }, function () { toast(txt, { sub: 'Copiez le numéro manuellement' }); });
      return;
    }

    switch (act) {
      case 'theme':
        var nd = !isDark();
        document.documentElement.setAttribute('data-theme', nd ? 'dark' : 'light'); store('ledhas-admin-theme', nd ? 'dark' : 'light');
        var mc = document.querySelector('meta[name=theme-color]'); if (mc) mc.setAttribute('content', nd ? '#130E0B' : '#172038');
        app.querySelectorAll('.theme-btn').forEach(function (b) { b.outerHTML = themeBtn(); });
        break;
      case 'to-reset': renderLogin('reset'); break;
      case 'fill-demo': var fe = app.querySelector('[name=email]'), fp = app.querySelector('[name=password]'); if (fe) fe.value = DEMO_API.email; if (fp) fp.value = DEMO_API.password; break;
      case 'demo-reset': DEMO_API.reset(); S.drawer = null; S.known = null; load(false).then(function () { renderApp(); toast('Démo réinitialisée', { sub: 'Les réservations fictives de départ sont revenues.' }); }); break;
      case 'to-login': renderLogin('login'); break;
      case 'logout':
        var tok = session && session.access_token;
        if (tok && !DEMO) rawFetch('/auth/v1/logout', { method: 'POST', token: tok });
        onSignedOut(); break;
      case 'sb-open': S.sbOpen = true; renderApp(); break;
      case 'sb-close': S.sbOpen = false; renderApp(); break;
      case 'refresh': load(false).then(function () { toast('Liste actualisée'); }); break;
      case 'new': S.drawer = { id: 'new', fresh: !S.drawer }; rerenderDrawer(); var nf = app.querySelector('#resForm [name=name]'); if (nf) nf.focus(); break;
      case 'close-drawer': closeDrawer(); break;
      case 'cancel-edit': S.drawer.tab = 'details'; S.drawer.delArmed = false; rerenderDrawer(); break;
      case 'wa-menu': S.drawer.waMenu = !S.drawer.waMenu; rerenderDrawer(); break;
      case 'save-notes':
        if (!r) break;
        busy(t, true);
        db.update(r.id, { admin_notes: (document.getElementById('notesBox').value || '').trim() || null }).then(function (row) { upsertRow(row); S.drawer.events = null; rerenderDrawer(); toast('Note enregistrée'); })
          .catch(function (err) { busy(t, false); toast('Note non enregistrée', { bad: true, sub: err.message }); });
        break;
      case 'delete':
        if (!r) break;
        if (!S.drawer.delArmed) { S.drawer.delArmed = true; rerenderDrawer(); break; }
        busy(t, true);
        db.remove(r.id).then(function () {
          S.list = S.list.filter(function (x) { return x.id !== r.id; }); delete S.byId[r.id];
          closeDrawer(); rerenderContent(); toast('Réservation supprimée · ' + r.ref);
        }).catch(function (err) { busy(t, false); toast('Suppression impossible', { bad: true, sub: err.message }); });
        break;
      case 'export': exportReservations(filteredList()); break;
      case 'export-all': exportReservations(S.list); break;
      case 'export-clients':
        var seen = {}, rows = [['Nom', 'Téléphone', 'E-mail', 'Langue', 'Dernière arrivée']];
        S.list.slice().sort(function (a, b) { return a.arrival > b.arrival ? -1 : 1; }).forEach(function (x) { var kk = phoneKey(x.phone); if (seen[kk]) return; seen[kk] = 1; rows.push([x.name, x.phone, x.email, LANG[x.lang], x.arrival]); });
        csv('clients-ledhas-' + isoDay(new Date()) + '.csv', rows); break;
      case 'cal-prev': S.cal = new Date(S.cal.getFullYear(), S.cal.getMonth() - 1, 1); rerenderContent(); break;
      case 'cal-next': S.cal = new Date(S.cal.getFullYear(), S.cal.getMonth() + 1, 1); rerenderContent(); break;
      case 'cal-today': S.cal = null; rerenderContent(); break;
      default:
        if (act && act.indexOf('go-status:') === 0) { S.filter = { status: act.split(':')[1], period: act.split(':')[1] === 'nouvelle' ? 'all' : 'upcoming', q: '' }; if (S.route === 'reservations') rerenderContent(); else location.hash = '#/reservations'; }
        else if (act && act.indexOf('go:') === 0) { location.hash = '#/' + act.split(':')[1]; }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (S.drawer && S.drawer.waMenu) { S.drawer.waMenu = false; rerenderDrawer(); } else if (S.drawer) closeDrawer(); else if (S.sbOpen) { S.sbOpen = false; renderApp(); } }
    if (e.key === 'Enter' && e.target.matches && e.target.matches('tr[data-open]')) openDrawer(e.target.getAttribute('data-open'));
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { var gs = document.getElementById('globalSearch'); if (gs) { e.preventDefault(); gs.focus(); } }
  });
  document.addEventListener('input', function (e) {
    var id = e.target.id;
    if (id === 'listSearch') { S.filter.q = e.target.value; var pos = e.target.selectionStart; rerenderContent(); var el = document.getElementById('listSearch'); el.focus(); el.setSelectionRange(pos, pos); }
    else if (id === 'clientSearch') { S.clientsQ = e.target.value; var p2 = e.target.selectionStart; rerenderContent(); var el2 = document.getElementById('clientSearch'); el2.focus(); el2.setSelectionRange(p2, p2); }
    else if (id === 'globalSearch') { S.search = e.target.value; renderSearch(); }
  });
  document.addEventListener('focusout', function (e) { if (e.target.id === 'globalSearch') setTimeout(function () { if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#searchPop')) return; S.search = ''; renderSearch(); }, 180); });

  boot();
})();
