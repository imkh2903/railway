const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');

const app = express();
const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const DB = path.join(DATA_DIR, 'db.json');
const SEED_DB = path.join(ROOT, 'data', 'db.json');
const SEED_UPLOAD = path.join(ROOT, 'data', 'uploads');
const UPLOAD = path.join(DATA_DIR, 'uploads');
const MAX_UPLOAD = Math.max(1, Number(process.env.MAX_UPLOAD_MB || 10)) * 1024 * 1024;
const SESSION_TTL = Math.max(5, Number(process.env.SESSION_TTL_HOURS || 8)) * 60 * 60 * 1000;
const IS_PROD = process.env.NODE_ENV === 'production';

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD, { recursive: true });

// Railway Volume support: when DATA_DIR is mounted and empty on first deploy,
// bootstrap the persistent data from the repository's seed database/uploads.
if (!fs.existsSync(DB)) {
  if (!fs.existsSync(SEED_DB)) throw new Error('Seed database data/db.json missing');
  fs.copyFileSync(SEED_DB, DB);
}
if (fs.existsSync(SEED_UPLOAD)) {
  for (const entry of fs.readdirSync(SEED_UPLOAD)) {
    const source = path.join(SEED_UPLOAD, entry);
    const target = path.join(UPLOAD, entry);
    if (fs.statSync(source).isFile() && !fs.existsSync(target)) {
      fs.copyFileSync(source, target);
    }
  }
}

function readDb() {
  return JSON.parse(fs.readFileSync(DB, 'utf8'));
}

function writeDb(data, { backup = true } = {}) {
  const tmp = `${DB}.tmp`;
  if (backup) {
    try { fs.copyFileSync(DB, `${DB}.bak`); } catch {}
  }
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB);
}

function ensureDbShape() {
  const d = readDb();
  d.site = d.site || {};
  d.site.contact = d.site.contact || {};
  d.site.social = d.site.social || {};
  d.events = Array.isArray(d.events) ? d.events : [];
  d.publications = Array.isArray(d.publications) ? d.publications : [];
  d.achievements = Array.isArray(d.achievements) ? d.achievements : [];
  d.members = Array.isArray(d.members) ? d.members : [];
  d.registrations = Array.isArray(d.registrations) ? d.registrations : [];
  d.users = Array.isArray(d.users) ? d.users : [];
  d.media = Array.isArray(d.media) ? d.media : [];
  d.dokumen_surat = Array.isArray(d.dokumen_surat) ? d.dokumen_surat : [];
  d.organization = Array.isArray(d.organization) ? d.organization : [];
  if (d.organization.length === 0) {
    d.organization = [
      {id:'kamabigus',group:'Pembina',title:'Kamabigus',name:'Amrizon, S.Pd., M.Pd.I',order:10,visible:true},
      {id:'pembina-utama',group:'Pembina',title:'Pembina Utama',name:'Kak Abd Malik, S.Hum',order:20,visible:true},
      {id:'pembina-putra-1',group:'Pembina',title:'Pembina Putra',name:'Kak Fajrio, M.Pd.',order:30,visible:true},
      {id:'pembina-putra-2',group:'Pembina',title:'Pembina Putra',name:'Kak Asmardi, S.E.',order:31,visible:true},
      {id:'pradana-putra',group:'Dewan Ambalan & Sangga Kerja (Penegak Putra)',title:'Ketua Ambalan / Pradana Putra',name:'Kak Wahdani Habib Yusra',order:40,visible:true},
      {id:'kerani-putra',group:'Dewan Ambalan & Sangga Kerja (Penegak Putra)',title:'Sekretaris / Kerani Putra',name:'Kak Annajmus Tsaqib',order:50,visible:true},
      {id:'bendahara-putra',group:'Dewan Ambalan & Sangga Kerja (Penegak Putra)',title:'Bendahara / Juru Uang Putra',name:'Kak Yoga Pratama',order:60,visible:true},
      {id:'giat-rutin',group:'Koordinator Bidang (Putra)',title:'Giat Rutin',name:'Kak M. Tariq Nafis Abdul Jawal',order:70,visible:true},
      {id:'humas',group:'Koordinator Bidang (Putra)',title:'Humas',name:'Kak Alwi Ridwan Nur Shaleh',order:80,visible:true},
      {id:'perlengkapan',group:'Koordinator Bidang (Putra)',title:'Perlengkapan',name:'Kak Dergo Wantri Ali',order:90,visible:true},
      {id:'dokumentasi',group:'Koordinator Bidang (Putra)',title:'Dokumentasi',name:'Kak M. Yuki Hardiansyah',order:100,visible:true}
    ];
  }
  d.analytics = d.analytics || { pageViews: 0, pages: {} };
  d.analytics.pages = d.analytics.pages || {};
  d.settings = d.settings || { maintenance: false };
  if ('stats' in d) delete d.stats; // legacy misleading counter; all counters are derived.

  // v5 publication migration:
  // Older records used publishAt without saying whether that date was intentionally scheduled.
  // A record that is already marked `published` is treated as an immediate publication.
  // This prevents a future datetime accidentally hiding an article from the public website.
  let publicationChanged = false;
  d.publications = d.publications.map(p => {
    const next = { ...p, module: 'publikasi' };
    if (!next.publishMode) {
      next.publishMode = 'immediate';
      if (next.status === 'published') next.publishAt = null;
      publicationChanged = true;
    }
    if (!['immediate', 'scheduled'].includes(next.publishMode)) {
      next.publishMode = 'immediate';
      if (next.status === 'published') next.publishAt = null;
      publicationChanged = true;
    }
    if (!next.thumbnailUrl) {
      next.thumbnailUrl = '/assets/publication-default.svg';
      publicationChanged = true;
    }
    return next;
  });
  // Keep the migration internal; do not add operational metadata to db.json.
  writeDb(d, { backup: false });
  return d;
}

const db0 = ensureDbShape();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.pbkdf2Sync(String(password), salt, 120000, 64, 'sha512').toString('hex')}`;
}
function isPasswordHash(value) {
  return typeof value === 'string' && /^[0-9a-f]{32}:[0-9a-f]{128}$/.test(value);
}
function verifyPassword(password, encoded) {
  try {
    if (!isPasswordHash(encoded)) return false;
    const [salt, expected] = encoded.split(':');
    const actual = crypto.pbkdf2Sync(String(password), salt, 120000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } catch { return false; }
}
function migratePasswords() {
  const d = readDb();
  let changed = false;
  d.users = d.users.map(u => {
    if (u.password && !isPasswordHash(u.password)) {
      changed = true;
      return { ...u, password: hashPassword(u.password) };
    }
    return u;
  });
  if (changed) writeDb(d);
}
migratePasswords();

const sessions = new Map();
const loginAttempts = new Map();

const appJson = express.json({ limit: '3mb' });
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(appJson);
app.use(express.urlencoded({ extended: true }));

const allowedUploadExt = new Set(['.jpg','.jpeg','.png','.webp','.gif','.mp4','.webm','.pdf','.doc','.docx','.xls','.xlsx','.zip']);
const upload = multer({
  dest: UPLOAD,
  limits: { fileSize: MAX_UPLOAD },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(allowedUploadExt.has(ext) ? null : new Error('Jenis file tidak diizinkan.'), allowedUploadExt.has(ext));
  }
});

const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(['.xlsx', '.csv'].includes(ext) ? null : new Error('Import anggota hanya mendukung .xlsx atau .csv.'), ['.xlsx', '.csv'].includes(ext));
  }
});

const multiFileUpload = multer({
  dest: UPLOAD,
  limits: { fileSize: MAX_UPLOAD, files: 50 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(allowedUploadExt.has(ext) ? null : new Error('Jenis file tidak diizinkan.'), allowedUploadExt.has(ext));
  }
});

const documentBulkUpload = multer({
  dest: UPLOAD,
  limits: { fileSize: MAX_UPLOAD, files: 50 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowed = new Set(['.pdf','.doc','.docx','.xls','.xlsx','.zip']);
    cb(allowed.has(ext) ? null : new Error('Upload dokumen hanya mendukung PDF, DOC/DOCX, XLS/XLSX, atau ZIP.'), allowed.has(ext));
  }
});

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (IS_PROD) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

function setCookie(res, name, value, maxAge) {
  const parts = [`${name}=${value}`, `Max-Age=${Math.max(0, Math.floor(maxAge / 1000))}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (IS_PROD) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}
function getSession(req) {
  const raw = (req.headers.cookie || '').match(/(?:^|;\s*)sid=([^;]+)/)?.[1];
  if (!raw) return null;
  const session = sessions.get(raw);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(raw);
    return null;
  }
  return { token: raw, ...session };
}
function auth(req, res, next) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'UNAUTHORIZED' });
  req.session = session;
  next();
}
function csrf(req, res, next) {
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  if (!req.session || req.get('x-csrf-token') !== req.session.csrf) return res.status(403).json({ error: 'CSRF' });
  next();
}
function role(...roles) {
  return (req, res, next) => roles.includes(req.session?.role) ? next() : res.status(403).json({ error: 'FORBIDDEN' });
}
function slugify(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}
function uniqueSlug(base, collection, ignoreId = null) {
  let slug = slugify(base) || `publikasi-${Date.now()}`;
  const used = new Set(collection.filter(x => String(x.id) !== String(ignoreId)).map(x => x.slug).filter(Boolean));
  const original = slug;
  let n = 2;
  while (used.has(slug)) slug = `${original}-${n++}`;
  return slug;
}
function nowIso() { return new Date().toISOString(); }
function validHttpUrl(value) {
  if (!value) return true;
  try { const u = new URL(value); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}
function validThumbnailUrl(value) {
  if (!value) return false;
  return validHttpUrl(value) || /^\/(assets|media)\//.test(String(value));
}
function isPublicPublication(x) {
  if (!x || x.module !== 'publikasi' || x.status !== 'published') return false;
  // Only an explicitly scheduled publication can be held back by publishAt.
  // Immediate publications ignore stale/future datetime values.
  if (x.publishMode === 'scheduled' && x.publishAt) {
    const t = Date.parse(x.publishAt);
    if (Number.isFinite(t) && t > Date.now()) return false;
  }
  return true;
}
function sanitizeRichHtml(html) {
  return String(html || '')
    .replace(/<\/?(script|style|iframe|object|embed|form|input|button|textarea|select)[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');
}
function publicStats(d) {
  return {
    members: d.members.length,
    activeMembers: d.members.filter(x => String(x.status || 'aktif').toLowerCase() === 'aktif').length,
    events: d.events.length,
    upcomingEvents: d.events.filter(x => x.date >= new Date().toISOString().slice(0,10)).length,
    publications: d.publications.filter(isPublicPublication).length,
    drafts: d.publications.filter(x => x.status !== 'published').length,
    scheduledPublications: d.publications.filter(x => x.status === 'published' && x.publishMode === 'scheduled' && x.publishAt && Date.parse(x.publishAt) > Date.now()).length,
    achievements: d.achievements.length,
    pendingRegistrations: d.registrations.filter(x => x.status === 'pending').length,
    registrations: d.registrations.length,
    media: d.media.length,
    documents: d.dokumen_surat.length,
    organization: d.organization.length,
    videoPublications: d.publications.filter(x => x.contentType === 'video' && isPublicPublication(x)).length,
    documentPublications: d.publications.filter(x => x.contentType === 'document' && isPublicPublication(x)).length
  };
}
function normalizePublication(input, user, old, allPublications) {
  const next = { ...(old || {}), ...(input || {}) };
  next.id = old?.id || next.id || crypto.randomUUID();
  next.module = 'publikasi';
  next.title = String(next.title || '').trim();
  if (!next.title) throw new Error('Judul publikasi wajib diisi.');
  next.slug = uniqueSlug(next.slug || next.title, allPublications, old?.id);
  next.category = String(next.category || 'Umum').trim();
  next.excerpt = String(next.excerpt || '').slice(0, 500);
  next.content = sanitizeRichHtml(next.content);
  next.contentType = ['warta','resource','download','gallery','link','video','document'].includes(next.contentType) ? next.contentType : 'warta';
  next.status = next.status === 'published' ? 'published' : 'draft';
  next.featured = next.featured === true || next.featured === 'true';
  next.mediaIds = Array.isArray(next.mediaIds) ? [...new Set(next.mediaIds.map(String))] : [];
  next.documentId = next.documentId ? String(next.documentId) : null;
  next.externalUrl = String(next.externalUrl || '').trim();
  if (!validHttpUrl(next.externalUrl)) throw new Error('External link harus berupa URL http/https yang valid.');
  next.thumbnailUrl = String(next.thumbnailUrl || '').trim() || '/assets/publication-default.svg';
  if (!validThumbnailUrl(next.thumbnailUrl) && next.thumbnailUrl !== '/assets/publication-default.svg') {
    throw new Error('Thumbnail harus berupa URL foto http/https yang valid.');
  }
  next.publishMode = next.publishMode === 'scheduled' ? 'scheduled' : 'immediate';
  next.publishAt = next.publishMode === 'scheduled' ? (next.publishAt || null) : null;
  if (next.publishAt && !Number.isFinite(Date.parse(next.publishAt))) throw new Error('Jadwal publish tidak valid.');
  if (next.publishMode === 'scheduled' && next.status === 'published' && next.publishAt && Date.parse(next.publishAt) <= Date.now()) {
    next.publishMode = 'immediate';
    next.publishAt = null;
  }
  next.author = old?.author || user?.name || 'Admin Gudep';
  next.seo = typeof next.seo === 'object' && next.seo ? next.seo : {};
  next.seo.title = String(next.seo.title || next.title).slice(0,70);
  next.seo.description = String(next.seo.description || next.excerpt).slice(0,160);
  next.seo.keywords = String(next.seo.keywords || '').slice(0,300);
  next.createdAt = old?.createdAt || nowIso();
  next.updatedAt = nowIso();
  const isScheduledFuture = next.status === 'published' && next.publishMode === 'scheduled' && next.publishAt && Date.parse(next.publishAt) > Date.now();
  next.publishedAt = next.status === 'published' && !isScheduledFuture ? (old?.publishedAt || nowIso()) : null;
  return next;
}
function validatePublicationReferences(d, p) {
  if (p.status === 'published' && !p.thumbnailUrl) {
    throw new Error('Publikasi yang diterbitkan wajib memiliki thumbnail.');
  }
  const mediaIds = new Set(d.media.map(x => String(x.id)));
  const docIds = new Set(d.dokumen_surat.map(x => String(x.id)));
  const missingMedia = p.mediaIds.filter(id => !mediaIds.has(String(id)));
  if (missingMedia.length) throw new Error('Ada media yang tidak ditemukan di Media Library.');
  if (p.documentId && !docIds.has(String(p.documentId))) throw new Error('Dokumen surat yang dipilih tidak ditemukan.');
  if (p.contentType === 'gallery' && p.mediaIds.length === 0) throw new Error('Gallery wajib memiliki minimal satu media.');
  if (['download','resource'].includes(p.contentType) && !p.documentId) throw new Error('Tipe Download/Resource wajib memilih dokumen.');
  if (p.contentType === 'link' && !p.externalUrl) throw new Error('Tipe Link wajib memiliki external link.');
  if (p.contentType === 'document' && !p.documentId) throw new Error('Tipe Dokumen wajib memilih dokumen.');
  if (p.contentType === 'video' && !p.externalUrl && p.mediaIds.length === 0) throw new Error('Tipe Video wajib memiliki URL video atau minimal satu media video.');
  if (p.contentType === 'video' && p.mediaIds.length) {
    const media = d.media.filter(m => p.mediaIds.map(String).includes(String(m.id)));
    if (media.some(m => !String(m.mimetype || '').startsWith('video/'))) throw new Error('Media untuk publikasi Video harus berupa file video.');
  }
}

app.use(express.static(path.join(ROOT, 'public')));

// ---------------- AUTH ----------------
app.get('/api/auth/status', (req, res) => {
  const d = readDb();
  const s = getSession(req);
  res.json({ setup: d.users.length === 0, authenticated: !!s, user: s ? { username: s.username, role: s.role } : null });
});
app.post('/api/auth/setup', (req, res) => {
  const d = readDb();
  if (d.users.length) return res.status(409).json({ error: 'Setup administrator sudah selesai.' });
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const name = String(req.body.name || username).trim();
  if (username.length < 3) return res.status(400).json({ error: 'Username minimal 3 karakter.' });
  if (password.length < 10) return res.status(400).json({ error: 'Password minimal 10 karakter.' });
  d.users.push({ id: crypto.randomUUID(), username, password: hashPassword(password), name, role: 'superadmin', createdAt: nowIso() });
  writeDb(d);
  res.status(201).json({ ok: true });
});
app.post('/api/auth/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const key = `${req.ip}|${username}`;
  const attempt = loginAttempts.get(key) || { count: 0, until: 0 };
  if (attempt.until > Date.now()) return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi beberapa menit.' });
  const d = readDb();
  const user = d.users.find(x => String(x.username).toLowerCase() === username.toLowerCase());
  if (!user || !verifyPassword(req.body.password || '', user.password)) {
    attempt.count += 1;
    if (attempt.count >= 5) { attempt.until = Date.now() + 10 * 60 * 1000; attempt.count = 0; }
    loginAttempts.set(key, attempt);
    return res.status(401).json({ error: 'Username atau password salah.' });
  }
  loginAttempts.delete(key);
  const token = crypto.randomBytes(32).toString('hex');
  const session = { username: user.username, name: user.name, role: user.role || 'admin', csrf: crypto.randomBytes(24).toString('hex'), expiresAt: Date.now() + SESSION_TTL };
  sessions.set(token, session);
  setCookie(res, 'sid', token, SESSION_TTL);
  res.json({ ok: true, user: { username: user.username, name: user.name, role: user.role } });
});
app.post('/api/auth/logout', auth, (req, res) => { sessions.delete(req.session.token); setCookie(res, 'sid', '', 0); res.json({ ok: true }); });
app.get('/api/admin/me', auth, (req, res) => res.json({ user: { username: req.session.username, name: req.session.name, role: req.session.role }, csrf: req.session.csrf, activeSessions: sessions.size }));

// ---------------- PUBLIC API ----------------
app.get('/api/site', (req, res) => { const d = readDb(); res.json({ site: d.site, organization: d.organization, events: Array.isArray(d.events) ? d.events : [], stats: publicStats(d) }); });
app.get('/api/events', (req, res) => res.json(readDb().events));
app.get('/api/achievements', (req, res) => res.json(readDb().achievements));
app.get('/api/organization', (req, res) => res.json(readDb().organization));
app.get('/api/publications', (req, res) => { const d = readDb(); res.json(d.publications.filter(isPublicPublication)); });
// IMPORTANT: /all must be declared before /:slug, otherwise Express interprets "all" as a slug.
app.get('/api/publications/all', auth, (req, res) => res.json(readDb().publications));
app.get('/api/publications/:slug', (req, res) => {
  const d = readDb();
  const p = d.publications.find(x => x.slug === req.params.slug && isPublicPublication(x));
  if (!p) return res.status(404).json({ error: 'NOT_FOUND', message: 'Publikasi tidak ditemukan atau belum diterbitkan.' });
  const media = d.media.filter(m => (p.mediaIds || []).map(String).includes(String(m.id)));
  const document = d.dokumen_surat.find(x => String(x.id) === String(p.documentId)) || null;
  res.json({ ...p, media, document });
});
app.post('/api/analytics/hit', (req, res) => {
  const d = readDb();
  const page = String(req.body.page || '/').slice(0, 120);
  d.analytics.pageViews = Number(d.analytics.pageViews || 0) + 1;
  d.analytics.pages[page] = Number(d.analytics.pages[page] || 0) + 1;
  writeDb(d, { backup: false });
  res.json({ ok: true });
});
app.post('/api/registrations', (req, res) => {
  const name = String(req.body.name || '').trim();
  const nis = String(req.body.nis || '').trim();
  const className = String(req.body.className || '').trim();
  const contact = String(req.body.contact || '').trim();
  if (!name || !nis || !className || !contact) return res.status(400).json({ error: 'Nama, NIS, kelas, dan kontak wajib diisi.' });
  const d = readDb();
  const x = { id: crypto.randomUUID(), name, nis, className, contact, reason: String(req.body.reason || '').trim(), status: 'pending', adminNote: '', createdAt: nowIso(), updatedAt: nowIso() };
  d.registrations.unshift(x); writeDb(d); res.status(201).json({ ok: true, id: x.id });
});

// ---------------- ADMIN READ API ----------------
app.get('/api/analytics', auth, (req, res) => {
  const d = readDb();
  const today = new Date().toISOString().slice(0,10);
  const upcoming = d.events.filter(x => x.date >= today).sort((a,b) => String(a.date).localeCompare(String(b.date))).slice(0,5);
  const published = d.publications.filter(isPublicPublication);
  const publicationTypes = Object.fromEntries(['warta','resource','download','gallery','link','video','document'].map(t => [t, d.publications.filter(x => x.contentType === t).length]));
  const memberStatuses = Object.fromEntries([...new Set(d.members.map(x => String(x.status || 'aktif').toLowerCase()))].map(t => [t, d.members.filter(x => String(x.status || 'aktif').toLowerCase() === t).length]));
  const registrationStatuses = Object.fromEntries(['pending','approved','rejected'].map(t => [t, d.registrations.filter(x => x.status === t).length]));
  const eventCategories = Object.fromEntries([...new Set(d.events.map(x => String(x.category || 'Kegiatan')))].map(t => [t, d.events.filter(x => String(x.category || 'Kegiatan') === t).length]));
  res.json({
    overview: { ...publicStats(d), publishedPublications: published.length, draftPublications: d.publications.filter(x => x.status !== 'published').length, featuredPublications: published.filter(x => x.featured).length, pageViews: d.analytics.pageViews || 0 },
    publicationTypes, memberStatuses, registrationStatuses, eventCategories,
    popularPages: Object.entries(d.analytics.pages || {}).sort((a,b) => b[1] - a[1]).slice(0,10),
    upcomingEvents: upcoming,
    recentPublications: d.publications.slice(0,8),
    dashboard: {
      contentTotal: d.publications.length,
      mediaTotal: d.media.length,
      documentTotal: d.dokumen_surat.length,
      organizationTotal: d.organization.length,
      activeMembers: d.members.filter(x => String(x.status || 'aktif').toLowerCase() === 'aktif').length,
      nonactiveMembers: d.members.filter(x => String(x.status || 'aktif').toLowerCase() !== 'aktif').length
    }
  });
});
app.get('/api/registrations', auth, (req, res) => res.json(readDb().registrations));
app.get('/api/members', auth, (req, res) => res.json(readDb().members));
app.get('/api/users', auth, role('superadmin'), (req, res) => res.json(readDb().users.map(({password, ...u}) => u)));
app.get('/api/media', auth, (req, res) => res.json(readDb().media));
app.get('/api/documents', auth, (req, res) => res.json(readDb().dokumen_surat));


// ---------------- BULK IMPORT / UPLOAD ----------------
function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}
function parseMemberWorkbook(buffer, originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  let rows = [];
  if (ext === '.csv') {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (!lines.length) return { rows: [] };
    const parseCsvLine = line => {
      const out = []; let cur = ''; let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i], next = line[i + 1];
        if (ch === '"' && quoted && next === '"') { cur += '"'; i++; continue; }
        if (ch === '"') { quoted = !quoted; continue; }
        if (ch === ',' && !quoted) { out.push(cur.trim()); cur = ''; } else cur += ch;
      }
      out.push(cur.trim()); return out;
    };
    const headers = parseCsvLine(lines[0]).map(normalizeHeader);
    rows = lines.slice(1).map((line, idx) => {
      const vals = parseCsvLine(line); const obj = { __row: idx + 2 };
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; }); return obj;
    });
  } else {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    rows = raw.map((r, idx) => {
      const obj = { __row: idx + 2 };
      Object.entries(r).forEach(([k, v]) => { obj[normalizeHeader(k)] = String(v ?? '').trim(); });
      return obj;
    });
  }
  const alias = {
    name: ['nama','name'],
    nis: ['nis','nomorinduksiswa','nomorinduk'],
    className: ['kelas','classname','class'],
    status: ['status','keaktifan']
  };
  const get = (row, key) => {
    for (const k of alias[key]) if (Object.prototype.hasOwnProperty.call(row, k)) return String(row[k] ?? '').trim();
    return '';
  };
  return {
    rows: rows.map(row => ({
      __row: row.__row,
      name: get(row,'name'),
      nis: get(row,'nis'),
      className: get(row,'className'),
      status: get(row,'status') || 'aktif'
    }))
  };
}
function validateMemberImport(rows, existingMembers) {
  const errors = [], valid = [], seenNis = new Set();
  const existingNis = new Set(existingMembers.map(x => String(x.nis || '').trim().toLowerCase()).filter(Boolean));
  rows.forEach(r => {
    const rowErrors = [];
    if (!r.name) rowErrors.push('Nama wajib diisi.');
    if (!r.nis) rowErrors.push('NIS wajib diisi.');
    if (!r.className) rowErrors.push('Kelas wajib diisi.');
    const status = String(r.status || 'aktif').toLowerCase();
    if (!['aktif','nonaktif'].includes(status)) rowErrors.push('Status harus aktif atau nonaktif.');
    const nisKey = String(r.nis || '').trim().toLowerCase();
    if (nisKey && seenNis.has(nisKey)) rowErrors.push('NIS duplikat di file.');
    if (nisKey && existingNis.has(nisKey)) rowErrors.push('NIS sudah ada di database.');
    if (rowErrors.length) errors.push({ row: r.__row, name: r.name, nis: r.nis, errors: rowErrors });
    else { seenNis.add(nisKey); valid.push({ name: r.name, nis: r.nis, className: r.className, status }); }
  });
  return { valid, errors };
}

app.post('/api/members/import/preview', auth, csrf, bulkUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File Excel/CSV tidak ditemukan.' });
  try {
    const parsed = parseMemberWorkbook(req.file.buffer, req.file.originalname);
    const headersOk = parsed.rows.length || req.file.originalname.toLowerCase().endsWith('.csv');
    if (!headersOk) return res.status(400).json({ error: 'File tidak memiliki data anggota.' });
    const d = readDb(); const result = validateMemberImport(parsed.rows, d.members);
    res.json({ ok: true, filename: req.file.originalname, totalRows: parsed.rows.length, validCount: result.valid.length, errorCount: result.errors.length, errors: result.errors, preview: result.valid.slice(0, 20) });
  } catch (err) {
    res.status(400).json({ error: `Gagal membaca file: ${err.message}` });
  }
});

app.post('/api/members/import', auth, csrf, bulkUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File Excel/CSV tidak ditemukan.' });
  try {
    const parsed = parseMemberWorkbook(req.file.buffer, req.file.originalname);
    const d = readDb(); const result = validateMemberImport(parsed.rows, d.members);
    if (result.errors.length) {
      return res.status(422).json({ error: 'Import dibatalkan karena ada baris yang tidak valid atau duplikat.', totalRows: parsed.rows.length, validCount: result.valid.length, errorCount: result.errors.length, errors: result.errors });
    }
    const createdAt = nowIso();
    const items = result.valid.map(x => ({ id: crypto.randomUUID(), ...x, createdAt, updatedAt: createdAt }));
    d.members.unshift(...items); writeDb(d);
    res.status(201).json({ ok: true, imported: items.length, items });
  } catch (err) {
    res.status(400).json({ error: `Gagal mengimpor file: ${err.message}` });
  }
});

app.get('/api/members/template', auth, (req, res) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Nama','NIS','Kelas','Status'],
    ['CONTOH NAMA','123456','XII IPA 1','aktif']
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Anggota');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="template-anggota-gudep.xlsx"');
  res.end(buf);
});

app.post('/api/media/bulk', auth, csrf, multiFileUpload.array('files', 50), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Tidak ada file media.' });
  const d = readDb(); const created = [];
  for (const file of req.files) {
    const x = { id: crypto.randomUUID(), filename: file.filename, originalName: file.originalname, mimetype: file.mimetype, size: file.size, createdAt: nowIso(), url: `/media/${file.filename}` };
    d.media.unshift(x); created.push(x);
  }
  writeDb(d); res.status(201).json({ ok: true, uploaded: created.length, items: created });
});

app.post('/api/documents/bulk', auth, csrf, documentBulkUpload.array('files', 50), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Tidak ada dokumen.' });
  const type = ['resource','download'].includes(req.body.type) ? req.body.type : 'resource';
  const d = readDb(); const created = [];
  for (const file of req.files) {
    const x = { id: crypto.randomUUID(), module: 'publikasi', name: path.basename(file.originalname, path.extname(file.originalname)), type, filename: file.filename, originalName: file.originalname, mimetype: file.mimetype, size: file.size, createdAt: nowIso(), url: `/media/${file.filename}` };
    d.dokumen_surat.unshift(x); created.push(x);
  }
  writeDb(d); res.status(201).json({ ok: true, uploaded: created.length, items: created });
});

// ---------------- GENERIC CRUD ----------------

function validateOrganizationPhoto(d, item) {
  item.photoUrl = String(item.photoUrl || '').trim();
  item.photoMediaId = item.photoMediaId ? String(item.photoMediaId) : null;
  if (!item.photoUrl) { item.photoMediaId = null; return; }
  const local = /^\/media\/[A-Za-z0-9._-]+$/.test(item.photoUrl);
  if (!validThumbnailUrl(item.photoUrl) && !local) throw new Error('Foto struktur harus berupa URL http/https atau media lokal yang valid.');
  if (item.photoMediaId) {
    const media = d.media.find(m => String(m.id) === item.photoMediaId);
    if (!media) throw new Error('Media foto struktur tidak ditemukan.');
    if (!String(media.mimetype || '').startsWith('image/')) throw new Error('Media foto struktur harus berupa gambar.');
    if (String(media.url) !== item.photoUrl) throw new Error('Referensi foto struktur tidak sesuai dengan Media Library.');
  }
}

function crud(collection) {
  app.post(`/api/${collection}`, auth, csrf, (req, res) => {
    const d = readDb();
    const x = { id: crypto.randomUUID(), ...req.body, createdAt: nowIso(), updatedAt: nowIso() };
    if (collection === 'publications') {
      Object.assign(x, normalizePublication(x, req.session, null, d.publications));
      validatePublicationReferences(d, x);
    }
    if (collection === 'organization') validateOrganizationPhoto(d, x);
    d[collection].unshift(x); writeDb(d); res.status(201).json(x);
  });
  app.put(`/api/${collection}/:id`, auth, csrf, (req, res) => {
    const d = readDb(); const i = d[collection].findIndex(x => String(x.id) === String(req.params.id));
    if (i < 0) return res.status(404).json({ error: 'NOT_FOUND' });
    const old = d[collection][i];
    const next = { ...old, ...req.body, id: old.id, updatedAt: nowIso() };
    if (collection === 'publications') {
      Object.assign(next, normalizePublication(next, req.session, old, d.publications));
      validatePublicationReferences(d, next);
    }
    if (collection === 'organization') validateOrganizationPhoto(d, next);
    d[collection][i] = next; writeDb(d); res.json(next);
  });
  app.delete(`/api/${collection}/:id`, auth, csrf, (req, res) => {
    const d = readDb(); const item = d[collection].find(x => String(x.id) === String(req.params.id));
    if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
    d[collection] = d[collection].filter(x => String(x.id) !== String(req.params.id));
    writeDb(d); res.json({ ok: true });
  });
}
crud('events');
crud('publications');
crud('achievements');
crud('members');
crud('organization');

// Registration management.
app.put('/api/registrations/:id', auth, csrf, (req, res) => {
  const d = readDb(); const i = d.registrations.findIndex(x => String(x.id) === String(req.params.id));
  if (i < 0) return res.status(404).json({ error: 'NOT_FOUND' });
  const status = ['pending','approved','rejected'].includes(req.body.status) ? req.body.status : d.registrations[i].status;
  d.registrations[i] = { ...d.registrations[i], ...req.body, status, id: d.registrations[i].id, updatedAt: nowIso() };
  writeDb(d); res.json(d.registrations[i]);
});
app.delete('/api/registrations/:id', auth, csrf, (req, res) => {
  const d = readDb(); const before = d.registrations.length;
  d.registrations = d.registrations.filter(x => String(x.id) !== String(req.params.id));
  if (d.registrations.length === before) return res.status(404).json({ error: 'NOT_FOUND' });
  writeDb(d); res.json({ ok: true });
});

// Site / organization settings.
app.put('/api/site', auth, csrf, (req, res) => {
  const d = readDb();
  const incoming = req.body || {};
  d.site = { ...d.site, ...incoming, contact: { ...d.site.contact, ...(incoming.contact || {}) }, social: { ...d.site.social, ...(incoming.social || {}) } };
  writeDb(d); res.json(d.site);
});

// Users are backend-managed; no public registration.
app.post('/api/users', auth, csrf, role('superadmin'), (req, res) => {
  const username = String(req.body.username || '').trim(); const password = String(req.body.password || '');
  if (username.length < 3) return res.status(400).json({ error: 'Username minimal 3 karakter.' });
  if (password.length < 10) return res.status(400).json({ error: 'Password minimal 10 karakter.' });
  const d = readDb(); if (d.users.some(x => x.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: 'Username sudah digunakan.' });
  const u = { id: crypto.randomUUID(), username, password: hashPassword(password), name: String(req.body.name || username).trim(), role: req.body.role === 'superadmin' ? 'superadmin' : 'admin', createdAt: nowIso() };
  d.users.push(u); writeDb(d); const {password: _p, ...safe} = u; res.status(201).json(safe);
});
app.delete('/api/users/:id', auth, csrf, role('superadmin'), (req, res) => {
  const d = readDb(); if (d.users.length <= 1) return res.status(400).json({ error: 'Minimal satu akun admin harus dipertahankan.' });
  const before = d.users.length; d.users = d.users.filter(x => String(x.id) !== String(req.params.id));
  if (d.users.length === before) return res.status(404).json({ error: 'NOT_FOUND' });
  writeDb(d); res.json({ ok: true });
});

// Documents and media.
app.post('/api/documents', auth, csrf, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan.' });
  const type = ['resource','download'].includes(req.body.type) ? req.body.type : 'resource';
  const d = readDb();
  const x = { id: crypto.randomUUID(), module: 'publikasi', name: String(req.body.name || req.file.originalname), type, filename: req.file.filename, originalName: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size, createdAt: nowIso(), url: `/media/${req.file.filename}` };
  d.dokumen_surat.unshift(x); writeDb(d); res.status(201).json(x);
});
app.delete('/api/documents/:id', auth, csrf, (req, res) => {
  const d = readDb(); const x = d.dokumen_surat.find(x => String(x.id) === String(req.params.id));
  if (!x) return res.status(404).json({ error: 'NOT_FOUND' });
  if (d.publications.some(p => String(p.documentId) === String(x.id))) return res.status(409).json({ error: 'Dokumen masih digunakan oleh publikasi.' });
  try { fs.unlinkSync(path.join(UPLOAD, x.filename)); } catch {}
  d.dokumen_surat = d.dokumen_surat.filter(y => String(y.id) !== String(x.id)); writeDb(d); res.json({ ok: true });
});
app.post('/api/media', auth, csrf, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan.' });
  const d = readDb();
  const x = { id: crypto.randomUUID(), filename: req.file.filename, originalName: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size, createdAt: nowIso(), url: `/media/${req.file.filename}` };
  d.media.unshift(x); writeDb(d); res.status(201).json(x);
});
app.delete('/api/media/:id', auth, csrf, (req, res) => {
  const d = readDb(); const x = d.media.find(x => String(x.id) === String(req.params.id));
  if (!x) return res.status(404).json({ error: 'NOT_FOUND' });
  if (d.publications.some(p => (p.mediaIds || []).map(String).includes(String(x.id)))) return res.status(409).json({ error: 'Media masih digunakan oleh publikasi.' });
  if (d.organization.some(o => String(o.photoMediaId || '') === String(x.id))) return res.status(409).json({ error: 'Media masih digunakan sebagai foto struktur organisasi.' });
  try { fs.unlinkSync(path.join(UPLOAD, x.filename)); } catch {}
  d.media = d.media.filter(y => String(y.id) !== String(x.id)); writeDb(d); res.json({ ok: true });
});
app.use('/media', express.static(UPLOAD));

// ---------------- ROUTES / ERRORS ----------------
app.get('/admin', (req, res) => res.sendFile(path.join(ROOT, 'public', 'admin', 'index.html')));
app.get('/admin/login', (req, res) => res.sendFile(path.join(ROOT, 'public', 'admin', 'login.html')));
app.get('/admin/setup', (req, res) => res.sendFile(path.join(ROOT, 'public', 'admin', 'setup.html')));
app.get('/api/health', (req, res) => {
  try {
    readDb();
    fs.accessSync(DATA_DIR, fs.constants.R_OK | fs.constants.W_OK);
    fs.accessSync(UPLOAD, fs.constants.R_OK | fs.constants.W_OK);
    res.status(200).json({ ok: true, status: 'ready', time: nowIso() });
  } catch (err) {
    res.status(503).json({ ok: false, status: 'not_ready' });
  }
});
app.get('/api/health/details', auth, (req, res) => {
  const d = readDb();
  res.json({ ok: true, status: 'ready', dataDir: DATA_DIR, stats: publicStats(d), activeSessions: sessions.size, time: nowIso() });
});
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: `Upload gagal: ${err.message}` });
  if (err) return res.status(400).json({ error: err.message || 'Request gagal.' });
  next();
});
app.get('*', (req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));

const startup = readDb();
console.log('');
console.log('==============================================');
console.log('  GUDEP MAN 1 PADANG PARIAMAN');
console.log('  Admin Control Center — Production v10');
console.log('==============================================');
console.log(`  Server              : http://localhost:${PORT}`);
console.log(`  Data directory      : ${DATA_DIR}`);
console.log(`  Upload directory    : ${UPLOAD}`);
console.log(`  Akun admin tersedia : ${startup.users.length} user`);
startup.users.forEach((u, i) => console.log(`  ${i + 1}. ${u.username} (${u.role || 'admin'})`));
console.log(`  Sesi aktif          : ${sessions.size}`);
console.log(`  Anggota             : ${startup.members.length}`);
console.log(`  Agenda              : ${startup.events.length}`);
console.log(`  Publikasi terbit    : ${startup.publications.filter(isPublicPublication).length}`);
console.log(`  Draft publikasi     : ${startup.publications.filter(x => x.status !== 'published').length}`);
console.log(`  Pendaftaran pending : ${startup.registrations.filter(x => x.status === 'pending').length}`);
console.log(`  Dokumen             : ${startup.dokumen_surat.length}`);
console.log(`  Media               : ${startup.media.length}`);
console.log('==============================================');

const httpServer = app.listen(PORT, () => console.log(`  Ready: http://localhost:${PORT}`));

function shutdown(signal) {
  console.log(`  ${signal} received — shutting down gracefully...`);
  httpServer.close(() => {
    sessions.clear();
    console.log('  Server stopped cleanly.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
