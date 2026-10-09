/* A small pre-ship check for mistakes this codebase has actually made.
   Run from the habits/ directory:  node check.js

   Every rule here earned its place by shipping:
   - $ / $$ confusion broke the completion animation for four releases
   - a stale asset version shipped new HTML against an old stylesheet
   - a missing translation key would show a raw identifier to the user
   - a character line without its recording would play silence */
const fs = require('fs');

const FILES = ['app.js', 'characters.js', 'charts.js', 'i18n.js', 'pico.js', 'sounds.js', 'sw.js'];
let failures = 0;

function fail(file, line, message) {
  console.log('  ' + file + (line ? ':' + line : '') + '  ' + message);
  failures++;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

FILES.forEach((file) => {
  const text = fs.readFileSync(file, 'utf8');

  // $ returns one element; only $$ returns an array. The lookbehind lets $$ by.
  const arrayOnSingle = /(?<!\$)\$\([^)]*\)\.(forEach|map|filter|find|slice|some|every)\b/g;
  let m;
  while ((m = arrayOnSingle.exec(text))) {
    fail(file, lineOf(text, m.index), 'usa $(...) con un método de array — ¿querías $$( ?');
  }

  // innerHTML is checked per statement, not per line: the escaping often sits
  // on a continuation line.
  const assigns = /innerHTML\s*=\s*([^;]+);/g;
  while ((m = assigns.exec(text))) {
    const statement = m[1];
    if (!statement.includes('+')) continue;                 // a plain literal
    if (/escapeHtml|iconSvg|MOOD_EMOJI|emoji|t\(/.test(statement)) continue;
    fail(file, lineOf(text, m.index), 'innerHTML concatenado sin escapeHtml a la vista');
  }

  const logs = /console\.log\(/g;
  while ((m = logs.exec(text))) {
    fail(file, lineOf(text, m.index), 'console.log olvidado');
  }
});

// Both languages must define exactly the same keys, or one of them shows a
// raw key where a sentence should be.
global.window = {};
require('./i18n.js');
const STRINGS = global.window.I18N.STRINGS;
const es = Object.keys(STRINGS.es);
const en = Object.keys(STRINGS.en);
const missingEn = es.filter((k) => !en.includes(k));
const missingEs = en.filter((k) => !es.includes(k));
if (missingEn.length) fail('i18n.js', 0, 'faltan en EN: ' + missingEn.join(', '));
if (missingEs.length) fail('i18n.js', 0, 'faltan en ES: ' + missingEs.join(', '));

// The asset version in index.html and sw.js must agree. When they drifted, an
// update served new HTML with the previously cached stylesheet.
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const versionsIn = (text) => [...new Set([...text.matchAll(/\?v=([\d.]+)/g)].map((x) => x[1]))];
const htmlVersions = versionsIn(html);
const swVersions = versionsIn(sw);
if (htmlVersions.length !== 1 || swVersions.length !== 1 || htmlVersions[0] !== swVersions[0]) {
  fail('sw.js', 0, 'versión de assets descuadrada: html [' + htmlVersions + '] vs sw [' + swVersions + ']');
}

// Every file the page loads has to be in the precache, or it is missing offline.
const loaded = [...html.matchAll(/(?:src|href)="([\w.-]+\.(?:js|css))\?/g)].map((x) => x[1]);
loaded.forEach((asset) => {
  if (!sw.includes("'./" + asset)) fail('sw.js', 0, asset + ' no está en el precache');
});

// The cast: every character speaks both languages with the same lines, every
// catalogue habit has its three lines, and every line has its recording and
// portrait.
const LINES_PER_HABIT = 3;
const GENERIC_LINES = 4;
const PRAISE_LINES = 5;
require('./characters.js');
const CAST = global.window.GLOW_CAST;
const appText = fs.readFileSync('app.js', 'utf8');
const catalogue = [...appText.matchAll(/\{ id: '(\w+)', key: 'hb\w+'/g)].map((x) => x[1]);
const presets = [...appText.matchAll(/\{ key: '(preset\w+)'/g)].map((x) => x[1]);
if (catalogue.length < 20 || presets.length < 5) fail('check.js', 0, 'no encuentro el catálogo en app.js');
const index = fs.existsSync('voices/index.json') ? JSON.parse(fs.readFileSync('voices/index.json', 'utf8')).clips : {};
CAST.CAST.forEach(({ id }) => {
  if (!fs.existsSync('avatars/' + id + '.svg')) fail('avatars', 0, 'falta el retrato de ' + id);
  ['es', 'en'].forEach((lang) => {
    const L = CAST.LINES[id] && CAST.LINES[id][lang];
    if (!L) { fail('characters.js', 0, id + ' no habla ' + lang); return; }
    ['name', 'tagline', 'intro'].forEach((k) => { if (!L[k]) fail('characters.js', 0, id + '/' + lang + ' sin ' + k); });
    catalogue.forEach((habit) => {
      const own = L.habits[habit];
      if (!Array.isArray(own) || own.length !== LINES_PER_HABIT || own.some((line) => !line)) {
        fail('characters.js', 0, id + '/' + lang + ' necesita ' + LINES_PER_HABIT + ' líneas para ' + habit);
      } else if (new Set(own).size !== own.length) {
        fail('characters.js', 0, id + '/' + lang + ' repite una línea de ' + habit);
      }
    });
    Object.keys(L.habits).forEach((habit) => {
      if (!catalogue.includes(habit)) fail('characters.js', 0, id + '/' + lang + ' habla de un hábito que no existe: ' + habit);
    });
    if (L.generic.length !== GENERIC_LINES || L.praise.length !== PRAISE_LINES) {
      fail('characters.js', 0, id + '/' + lang + ' necesita ' + GENERIC_LINES + ' genéricas y ' + PRAISE_LINES + ' felicitaciones');
    }
    L.generic.forEach((g, i) => {
      if (!g.text.includes('{habit}')) fail('characters.js', 0, id + '/' + lang + ' g' + (i + 1) + ': el texto no nombra el hábito');
      if (g.voice.includes('{habit}')) fail('characters.js', 0, id + '/' + lang + ' g' + (i + 1) + ': la voz no puede decir el nombre');
    });
    const clips = ['intro']
      .concat(...Object.keys(L.habits).map((k) => (L.habits[k] || []).map((line, i) => 'h-' + k + '-' + (i + 1))))
      .concat(L.generic.map((g, i) => 'g' + (i + 1)), L.praise.map((p, i) => 'p' + (i + 1)));
    clips.forEach((clip) => {
      const key = id + '/' + lang + '/' + clip;
      if (!fs.existsSync('voices/' + key + '.webm')) fail('voices', 0, 'falta la grabación ' + key + ' (node tools/voices/make-voices.js)');
      else if (!index[key]) fail('voices/index.json', 0, 'sin duración ni forma de onda para ' + key);
    });
  });
});
presets.forEach((key) => {
  const line = CAST.lineKeyFor(key);
  if (!line || !catalogue.includes(line)) fail('characters.js', 0, key + ' no lleva a ninguna línea');
});

console.log(failures ? failures + ' problema(s)' : 'sin problemas');
process.exit(failures ? 1 : 0);
