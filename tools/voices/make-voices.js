/* Records every line in habits/characters.js as a voice note.

   Run from the repo root:   node tools/voices/make-voices.js
   First run:                bash tools/voices/fetch.sh   (downloads ~900 MB)

   Piper (an open-source text-to-speech engine that runs offline) speaks each
   line with a stock voice from its catalogue; ffmpeg then gives each
   character its sound — a stadium-sized compressor for the footballer, a
   lower pitch for the narrator, a singing bowl for the master — and
   encodes it as Opus in WebM, which both Android and the WebView play.
   Since 2.14 they all speak dry but Bip: the echoes they had until then
   sounded like a hall and blurred the words.

   Output:  habits/voices/<character>/<lang>/<clip>.webm
            habits/voices/index.json  (duration and waveform of every clip)

   A clip is only re-recorded when its text or its sound changes, so editing
   one line costs one recording. Pass --force to redo everything, or
   --only=crack/es,zen/en/intro to limit a run to those prefixes.

   Every clip is measured again after encoding. One that misses the target
   loudness is reported as failed and deleted, so check.js holds the
   release — 2.8 shipped twelve of Abuela Rosa's at -44 to -6 LUFS. */
'use strict';

const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CACHE = path.join(__dirname, '.cache');
const PIPER = path.join(CACHE, 'piper', 'piper.exe');
const FFMPEG = path.join(CACHE, 'ffmpeg', 'bin', 'ffmpeg.exe');
const MODELS = path.join(CACHE, 'models');
const WORK = path.join(CACHE, 'work');
const OUT = path.join(ROOT, 'habits', 'voices');
const INDEX = path.join(OUT, 'index.json');

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const JOBS = 3;

/* Bump when the processing below changes in a way every clip should hear. */
const SOUND_VERSION = 5;

require(path.join(ROOT, 'habits', 'characters.js'));
const { LINES } = globalThis.GLOW_CAST;

/* ── Who speaks with which voice ────────────────────────────────────────
   Models are Piper catalogue voices, none of them cloned from anyone:
   see README.md for each one's licence. `length` is Piper's length scale
   (above 1 is slower), `noise` its expressiveness, `gap` the pause between
   sentences in seconds. */
const PROFILES = {
  crack: {
    es: { model: 'es_MX-ald-medium', length: 0.9, noise: 0.75, noiseW: 0.9, gap: 0.22 },
    en: { model: 'en_US-bryce-medium', length: 0.88, noise: 0.75, noiseW: 0.9, gap: 0.22 },
  },
  narrator: {
    es: { model: 'es_ES-davefx-medium', length: 1.1, noise: 0.6, noiseW: 0.7, gap: 0.45 },
    en: { model: 'en_US-norman-medium', length: 1.08, noise: 0.6, noiseW: 0.7, gap: 0.45 },
  },
  grandma: {
    es: { model: 'es_AR-daniela-high', length: 1.08, noise: 0.7, noiseW: 0.8, gap: 0.3 },
    en: { model: 'en_GB-cori-high', length: 1.06, noise: 0.7, noiseW: 0.8, gap: 0.3 },
  },
  bip: {
    es: { model: 'es_MX-claude-high', length: 0.98, noise: 0.35, noiseW: 0.4, gap: 0.3 },
    en: { model: 'en_US-sam-medium', length: 0.98, noise: 0.35, noiseW: 0.4, gap: 0.3 },
  },
  zen: {
    es: { model: 'es_ES-sharvard-medium', speaker: 0, length: 1.25, noise: 0.55, noiseW: 0.6, gap: 0.6 },
    en: { model: 'en_US-joe-medium', length: 1.22, noise: 0.55, noiseW: 0.6, gap: 0.6 },
  },
};

/* ── Each character's sound ──────────────────────────────────────────────
   Every chain reads the dry voice as [v] and must end in [fx]. Extra
   generated sources (a whistle, a beep, a bowl) are listed in `sources`
   and arrive as [s0], [s1]... */
const SR = 22050;
const FX = {
  /* Close, punchy and bright, like a voice over a stadium's PA, but dry: the
     slapback echo it had until 2.13 is gone. The intro opens with a
     referee's whistle. */
  crack(clip) {
    const voice = '[v]acompressor=threshold=-22dB:ratio=3.5:attack=4:release=90:makeup=2,' +
      'equalizer=f=3200:t=q:w=1.2:g=3';
    if (clip !== 'intro') return { graph: voice + '[fx]', sources: [] };
    return {
      sources: ['sine=f=2950:d=0.55:sample_rate=' + SR],
      graph: '[s0]vibrato=f=26:d=0.6,afade=t=in:d=0.02,afade=t=out:st=0.4:d=0.15,volume=0.32[w];' +
        voice + '[vv];[w][vv]concat=n=2:v=0:a=1[fx]',
    };
  },

  /* Lower and slower, a storyteller close to the microphone: two and a half
     semitones down, a little warmth at the bottom, the top softened. Until
     2.13 he told his stories from a cellar, with a long echo and a rumble
     underneath; it muddied the words. */
  narrator() {
    const k = 0.865;
    return {
      sources: [],
      graph: '[v]asetrate=' + Math.round(SR * k) + ',aresample=' + SR + ',atempo=' + (1 / k).toFixed(4) + ',' +
        'equalizer=f=180:t=q:w=1:g=2,lowpass=f=6200[fx]',
    };
  },

  /* A touch lower and warmer, with the faint waver of an older voice, and
     dry since 2.14 (it had a small room's echo).
     ffmpeg's vibrato reads its delay line before it has written it, so its
     first few milliseconds are whatever was left in memory: usually
     silence, sometimes a full-scale click or Infinity, and the loudness
     pass then set the whole clip by that click. It now runs over 40 ms of
     added silence, cut away again before any other filter hears it. */
  grandma() {
    const k = 0.95;
    const lead = Math.round(SR * 0.04);
    return {
      sources: [],
      graph: '[v]asetrate=' + Math.round(SR * k) + ',aresample=' + SR + ',atempo=' + (1 / k).toFixed(4) + ',' +
        'asetpts=N/SR/TB,adelay=' + lead + 'S:all=1,vibrato=f=5.2:d=0.035,' +
        'atrim=start_sample=' + lead + ',asetpts=PTS-STARTPTS,' +
        'equalizer=f=260:t=q:w=1:g=2.5,lowpass=f=7800[fx]',
    };
  },

  /* Robotised: the classic zero-phase FFT trick gives the voice a steady
     machine pitch, mixed back over the original so every word stays clear,
     then a short metallic comb. Every line opens with two beeps. */
  bip() {
    return {
      sources: ['sine=f=1180:d=0.075:sample_rate=' + SR, 'sine=f=1760:d=0.09:sample_rate=' + SR],
      graph: '[v]highpass=f=160,asplit=2[a][b];' +
        "[a]afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75[r];" +
        "[r][b]amix=inputs=2:weights='0.8 0.45':normalize=0,aecho=0.8:0.6:7|13:0.3|0.2[vv];" +
        '[s0]afade=t=out:st=0.05:d=0.025,volume=0.22,apad=pad_dur=0.04[b1];' +
        '[s1]afade=t=out:st=0.06:d=0.03,volume=0.22,apad=pad_dur=0.16[b2];' +
        '[b1][b2][vv]concat=n=3:v=0:a=1[fx]',
    };
  },

  /* Slow and warm, opening on a singing bowl. The bowl is built from a
     bowl's inharmonic partials, with a pair of close tones beating against
     each other for the shimmer. Until 2.13 it rang on for four seconds and
     the voice had a long echo, which together washed the words out; now the
     bowl dies away under the first words and the voice is dry. */
  zen() {
    const f = 311;
    const partial = (freq, dur) => 'sine=f=' + freq + ':d=' + dur + ':sample_rate=' + SR;
    return {
      sources: [
        partial(f, 1.8), partial(f + 1.8, 1.8),
        partial(Math.round(f * 2.71), 1.6), partial(Math.round(f * 5.02), 1.2),
      ],
      graph: '[s0]volume=0.5[p0];[s1]volume=0.42[p1];[s2]volume=0.22[p2];[s3]volume=0.08[p3];' +
        '[p0][p1][p2][p3]amix=inputs=4:duration=longest:normalize=0,' +
        'afade=t=in:d=0.006,afade=t=out:st=0.03:d=1.7:curve=exp,volume=0.45[bowl];' +
        '[v]lowpass=f=7200,equalizer=f=210:t=q:w=1:g=2,adelay=750:all=1[vv];' +
        '[bowl][vv]amix=inputs=2:duration=longest:normalize=0[fx]',
    };
  },
};

/* ── The work list ─────────────────────────────────────────────────────── */
/* Every line there is, named the way characters.js names its recordings:
   intro, h-<habit>-<n>, g<n> and p<n>. */
function allClips() {
  const list = [];
  for (const id of Object.keys(LINES)) {
    for (const lang of Object.keys(LINES[id])) {
      const L = LINES[id][lang];
      const add = (clip, text) => list.push({ id, lang, clip, key: id + '/' + lang + '/' + clip, text: spoken(text) });
      add('intro', L.intro);
      for (const habit of Object.keys(L.habits)) {
        L.habits[habit].forEach((line, i) => add('h-' + habit + '-' + (i + 1), line));
      }
      L.generic.forEach((g, i) => add('g' + (i + 1), g.voice));
      L.praise.forEach((p, i) => add('p' + (i + 1), p));
    }
  }
  return list;
}

function jobs() {
  return allClips().filter((job) => !ONLY.length || ONLY.some((prefix) => job.key.startsWith(prefix)));
}

const hashOf = (job) => crypto.createHash('sha1')
  .update(JSON.stringify([job.text, PROFILES[job.id][job.lang], SOUND_VERSION, FX[job.id].toString()]))
  .digest('hex').slice(0, 10);

/* Until 2.9 each habit had one line, recorded as h-<habit>. That line is now
   h-<habit>-1 with the same words and sound, so the file is renamed rather
   than recorded again. */
function adoptSingleLineRecordings(index) {
  let adopted = 0;
  for (const job of allClips()) {
    const match = /^h-([A-Za-z]+)-1$/.exec(job.clip);
    if (!match || index.clips[job.key]) continue;
    const oldKey = job.id + '/' + job.lang + '/h-' + match[1];
    const oldFile = path.join(OUT, oldKey + '.webm');
    if (!index.clips[oldKey] || index.clips[oldKey].h !== hashOf(job) || !fs.existsSync(oldFile)) continue;
    fs.renameSync(oldFile, path.join(OUT, job.key + '.webm'));
    index.clips[job.key] = index.clips[oldKey];
    delete index.clips[oldKey];
    adopted++;
  }
  return adopted;
}

/* Recordings of lines that no longer exist would ship in the APK for nothing. */
function removeStaleRecordings(live) {
  let removed = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.webm')) {
        const key = path.relative(OUT, full).split(path.sep).join('/').replace(/\.webm$/, '');
        if (!live.has(key)) {
          fs.unlinkSync(full);
          removed++;
        }
      }
    }
  };
  if (fs.existsSync(OUT)) walk(OUT);
  return removed;
}

/* What the engine should actually read: no guillemets or curly quotes. */
const spoken = (text) => text.replace(/[«»“”"]/g, '').replace(/[’]/g, "'").trim();

const run = (cmd, argv, input) => new Promise((resolve, reject) => {
  const child = execFile(cmd, argv, { maxBuffer: 1 << 26 }, (err, stdout, stderr) => {
    if (err) reject(new Error(path.basename(cmd) + ' failed: ' + String(stderr).slice(-600)));
    else resolve({ stdout, stderr });
  });
  if (input !== undefined) { child.stdin.write(input); child.stdin.end(); }
});

/* The tail of every chain: trim the silence Piper leaves at both ends and
   breathe a little either side. */
const TAIL = '[fx]aformat=sample_fmts=flt,silenceremove=start_periods=1:start_threshold=-52dB,' +
  'areverse,silenceremove=start_periods=1:start_threshold=-56dB,areverse,' +
  'adelay=110:all=1,apad=pad_dur=0.22,aresample=48000[out]';

/* Every clip lands on one loudness, with its peaks under a ceiling — and is
   checked as it will be heard, after encoding. */
const LOUDNESS = -16;     // LUFS
const CEILING = -1.5;     // dBTP, for loudnorm
const PEAK_AIM = -1;      // dBTP in the encoded clip: one over it is taken down a little
const PEAK_LIMIT = 0;     // dBTP in the encoded clip: one still over it has failed
const TOLERANCE = 2.5;    // LU either side of LOUDNESS before a clip counts as broken

async function record(job) {
  const p = PROFILES[job.id][job.lang];
  const base = job.id + '-' + job.lang + '-' + job.clip;
  const raw = path.join(WORK, base + '.raw.wav');
  const shaped = path.join(WORK, base + '.fx.wav');
  const wav = path.join(WORK, base + '.wav');
  const webm = path.join(OUT, job.id, job.lang, job.clip + '.webm');
  fs.mkdirSync(path.dirname(webm), { recursive: true });

  const piperArgs = ['--model', path.join(MODELS, p.model + '.onnx'), '--output_file', raw, '--quiet',
    '--length_scale', String(p.length), '--noise_scale', String(p.noise), '--noise_w', String(p.noiseW),
    '--sentence_silence', String(p.gap)];
  if (p.speaker !== undefined) piperArgs.push('--speaker', String(p.speaker));
  await run(PIPER, piperArgs, job.text);

  // The character's sound, rendered once, so that both loudness passes
  // below hear exactly the same signal.
  const fx = FX[job.id](job.clip);
  const inputs = ['-y', '-hide_banner', '-loglevel', 'error', '-i', raw];
  fx.sources.forEach((src) => inputs.push('-f', 'lavfi', '-i', src));
  const relabel = fx.graph.replace(/\[s(\d)\]/g, (m, n) => '[' + (Number(n) + 1) + ':a]').replace('[v]', '[0:a]aformat=sample_fmts=flt,');
  await run(FFMPEG, inputs.concat(['-filter_complex', relabel + ';' + TAIL, '-map', '[out]', '-c:a', 'pcm_f32le', shaped]));

  // Two passes: measure, then normalise linearly to the measured loudness
  // (loudnorm turns dynamic instead when that would break the ceiling).
  const target = 'loudnorm=I=' + LOUDNESS + ':TP=' + CEILING + ':LRA=11';
  const measure = await run(FFMPEG, ['-hide_banner', '-loglevel', 'info', '-i', shaped,
    '-af', target + ':print_format=json', '-f', 'null', '-']);
  const open = measure.stderr.lastIndexOf('{');
  const m = JSON.parse(measure.stderr.slice(open, measure.stderr.indexOf('}', open) + 1));
  const loud = target + ':linear=true:measured_I=' + m.input_i + ':measured_TP=' + m.input_tp +
    ':measured_LRA=' + m.input_lra + ':measured_thresh=' + m.input_thresh + ':offset=' + m.target_offset;
  await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', shaped,
    '-af', loud, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);

  // Opus at this bitrate puts the peaks back up by as much as two decibels,
  // so a clip over the aim comes down by up to a decibel at a time. Far from
  // the target loudness, or still clipping, it is a broken render and fails
  // the run rather than ship.
  let gain = 0;
  let heard = await encode(wav, webm, gain);
  for (let tries = 0; heard.peak > PEAK_AIM && tries < 3; tries++) {
    gain -= Math.min(1, heard.peak - PEAK_AIM + 0.2);
    heard = await encode(wav, webm, gain);
  }
  if (!(Math.abs(heard.loudness - LOUDNESS) <= TOLERANCE) || !(heard.peak <= PEAK_LIMIT)) {
    throw new Error('came out at ' + heard.loudness + ' LUFS, peak ' + heard.peak + ' dBTP');
  }

  return { ...measureWav(wav), bytes: fs.statSync(webm).size };
}

/* Encodes, then decodes again to measure what a listener gets. The encoder
   always gets float samples: fed the 16-bit file directly, libopus once
   turned the middle of a Zen line into a +9 dBTP burst that the same
   samples as floats did not produce. */
async function encode(wav, webm, gain) {
  await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', wav,
    '-af', 'volume=' + gain.toFixed(2) + 'dB,aformat=sample_fmts=flt',
    '-c:a', 'libopus', '-b:a', '24k', '-vbr', 'on', '-compression_level', '10', '-application', 'audio',
    '-frame_duration', '20', '-map_metadata', '-1', '-fflags', '+bitexact', webm]);
  const { stderr } = await run(FFMPEG, ['-hide_banner', '-nostats', '-i', webm, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
  return {
    loudness: parseFloat((/I:\s+(-?[\d.]+) LUFS/.exec(summary) || [])[1]),
    peak: parseFloat((/Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(summary) || [])[1]),
  };
}

/* Duration, plus a 28-bar waveform for the chat bubble, one digit per bar. */
function measureWav(file) {
  const b = fs.readFileSync(file);
  let off = 12, rate = 48000, data = null;
  while (off < b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') rate = b.readUInt32LE(off + 12);
    if (id === 'data') { data = b.subarray(off + 8, off + 8 + size); break; }
    off += 8 + size + (size & 1);
  }
  const n = Math.floor(data.length / 2);
  const BARS = 28;
  const rms = [];
  let peak = 0;
  for (let i = 0; i < BARS; i++) {
    const from = Math.floor((i * n) / BARS);
    const to = Math.floor(((i + 1) * n) / BARS);
    let sum = 0;
    for (let j = from; j < to; j++) {
      const s = data.readInt16LE(j * 2) / 32768;
      sum += s * s;
      if (Math.abs(s) > peak) peak = Math.abs(s);
    }
    rms.push(Math.sqrt(sum / Math.max(1, to - from)));
  }
  const top = Math.max(...rms) || 1;
  const wave = rms.map((r) => Math.min(9, Math.round((r / top) * 9))).join('');
  return { d: Math.round((n / rate) * 100) / 100, w: wave, peak: peak };
}

async function main() {
  for (const tool of [PIPER, FFMPEG]) {
    if (!fs.existsSync(tool)) {
      console.error('Missing ' + tool + '\nRun:  bash tools/voices/fetch.sh');
      process.exit(1);
    }
  }
  fs.mkdirSync(WORK, { recursive: true });
  const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, 'utf8')) : { clips: {} };
  const adopted = adoptSingleLineRecordings(index);
  if (adopted) console.log(adopted + ' single-line recordings kept as the first of three\n');
  const list = jobs();
  let done = 0;
  let skipped = 0;
  const failures = [];
  const started = Date.now();

  const queue = list.slice();
  async function worker() {
    while (queue.length) {
      const job = queue.shift();
      const key = job.key;
      const hash = hashOf(job);
      const file = path.join(OUT, job.id, job.lang, job.clip + '.webm');
      if (!FORCE && index.clips[key] && index.clips[key].h === hash && fs.existsSync(file)) {
        skipped++;
        continue;
      }
      try {
        const r = await record(job);
        index.clips[key] = { d: r.d, w: r.w, h: hash };
        done++;
        const warn = r.d > 9 ? '   <- long' : '';
        console.log(key.padEnd(28), (r.d.toFixed(2) + 's').padStart(7), (Math.round(r.bytes / 1024) + 'KB').padStart(6), warn);
      } catch (err) {
        failures.push(key + ': ' + err.message);
        // Without its file the clip cannot ship: check.js stops the release.
        fs.rmSync(file, { force: true });
        delete index.clips[key];
      }
    }
  }
  await Promise.all(Array.from({ length: JOBS }, worker));

  // Drop entries and files for lines that no longer exist; sort for a stable diff.
  const live = new Set(allClips().map((job) => job.key));
  const clips = {};
  Object.keys(index.clips).sort().forEach((k) => {
    if (live.has(k)) clips[k] = index.clips[k];
  });
  fs.writeFileSync(INDEX, JSON.stringify({ version: 1, clips: clips }) + '\n');
  const removed = ONLY.length ? 0 : removeStaleRecordings(live);

  console.log('\n' + done + ' recorded, ' + skipped + ' unchanged, ' + removed + ' removed, ' +
    failures.length + ' failed in ' + Math.round((Date.now() - started) / 1000) + 's');
  failures.forEach((f) => console.log('  ' + f));
  process.exit(failures.length ? 1 : 0);
}

main();
