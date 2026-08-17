const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const required = [
  'server.js',
  'package.json',
  'data/db.json',
  'public/index.html',
  'public/admin/index.html',
  'public/js/app.js',
  'public/js/admin.js',
  'public/assets/logo-gudep.webp',
  'public/assets/publication-default.svg',
  'public/assets/logo-purna-pramuka.png',
  'railway.json',
  '.env.example'
];

const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error('Missing required files:', missing);
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(path.join(root, 'data/db.json'), 'utf8'));
const arrays = ['users','members','events','publications','achievements','registrations','media','dokumen_surat','organization'];
for (const key of arrays) {
  if (!Array.isArray(db[key])) throw new Error(`db.${key} must be an array`);
}

const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
for (const route of ['/api/health', '/api/publications', '/api/publications/all', '/api/members/import', '/api/media/bulk', '/api/documents/bulk', '/api/organization']) {
  if (!server.includes(route)) throw new Error(`Required route missing: ${route}`);
}

console.log('Production static verification: PASS');
console.log(`Users: ${db.users.length}`);
console.log(`Members: ${db.members.length}`);
console.log(`Events: ${db.events.length}`);
console.log(`Publications: ${db.publications.length}`);
console.log(`Media: ${db.media.length}`);
console.log(`Documents: ${db.dokumen_surat.length}`);
console.log(`Organization: ${db.organization.length}`);
