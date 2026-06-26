import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'audio', 'elevenlabs');
const dryRun = !process.argv.includes('--generate');
const allowPartial = process.argv.includes('--allow-partial');
const localEnvPaths = [
  path.join(root, '.env.local'),
  'C:/Users/joshs/Projects/elevenlabs-voice-ids.env',
  'C:/Users/joshs/Projects/.env',
];
const secretEnvKeys = new Set([
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_ARTHUR_VOICE_ID',
  'ELEVENLABS_MAGS_VOICE_ID',
  'ELEVENLABS_RADIO_VOICE_ID',
]);

const voiceLines = [
  {
    id: 'arthur-prerace',
    speaker: 'Arthur Bell',
    voiceEnv: 'ELEVENLABS_ARTHUR_VOICE_ID',
    lineIds: ['arthur.prerace.generic'],
    text: '{track} looks magnificent today: fast entries, dangerous exits, and very honest kerbs.',
  },
  {
    id: 'arthur-prerace-silverpine-track',
    speaker: 'Arthur Bell',
    voiceEnv: 'ELEVENLABS_ARTHUR_VOICE_ID',
    lineIds: ['arthur.prerace.silverpine.track'],
    text: 'Silverpine Switchback asks for patience through the trees: quick entries, late exits, and no argument with the kerbs.',
  },
  {
    id: 'arthur-prerace-marina-track',
    speaker: 'Arthur Bell',
    voiceEnv: 'ELEVENLABS_ARTHUR_VOICE_ID',
    lineIds: ['arthur.prerace.marina.track'],
    text: 'Marina Vista Circuit is narrow, polished, and unforgiving from the harbour tunnel to the sea wall stand.',
  },
  {
    id: 'arthur-prerace-neon-track',
    speaker: 'Arthur Bell',
    voiceEnv: 'ELEVENLABS_ARTHUR_VOICE_ID',
    lineIds: ['arthur.prerace.neon.track'],
    text: 'Neon Borough GP is all braking references and city rhythm, with the metro flyover waiting to punish hesitation.',
  },
  {
    id: 'arthur-prerace-valkyrie-track',
    speaker: 'Arthur Bell',
    voiceEnv: 'ELEVENLABS_ARTHUR_VOICE_ID',
    lineIds: ['arthur.prerace.valkyrie.track'],
    text: 'Valkyrie Ridge is the longest and sternest test: ridge tunnel, summit tower, and commitment over every crest.',
  },
  {
    id: 'mags-lights',
    speaker: 'Mags Whitlow',
    voiceEnv: 'ELEVENLABS_MAGS_VOICE_ID',
    lineIds: ['mags.lights.five-red'],
    text: 'Five red lights, then it is noise, nerves, and no excuses.',
  },
  {
    id: 'radio-team-damage',
    speaker: 'Radio',
    voiceEnv: 'ELEVENLABS_RADIO_VOICE_ID',
    lineIds: ['radio.damage.climbing'],
    text: 'Damage is climbing. Stay off the outside kerbs and bring it home.',
  },
  {
    id: 'radio-team-contact',
    speaker: 'Radio',
    voiceEnv: 'ELEVENLABS_RADIO_VOICE_ID',
    lineIds: ['radio.contact.damage-check'],
    text: 'Contact confirmed. Check the front wing and give them space.',
  },
  {
    id: 'radio-team-tires',
    speaker: 'Radio',
    voiceEnv: 'ELEVENLABS_RADIO_VOICE_ID',
    lineIds: ['radio.tires.fading'],
    text: 'Tyres are fading. Brake earlier and keep the steering smooth.',
  },
];

const songs = [
  {
    id: 'menu-gridline-spark',
    prompt:
      'Instrumental pop rock racing game menu loop, bright electric guitar hooks, tight drums, pulsing synth bass, celebratory but focused, no vocals.',
    music_length_ms: 18000,
  },
  {
    id: 'prerace-five-lights-rising',
    prompt:
      'Instrumental pre-race build, British motorsport tension, muted guitars, tom drums, rising synth pulses, dramatic but not dark, no vocals.',
    music_length_ms: 16000,
  },
  {
    id: 'podium-carbon-champagne',
    prompt:
      'Instrumental podium celebration, pop rock chorus feel, claps, clean guitars, triumphant synth lead, compact loop, no vocals.',
    music_length_ms: 18000,
  },
  {
    id: 'finale-apex-parade',
    prompt:
      'Instrumental championship finale music, energetic pop rock parade, big drums, bright guitars, victory synths, celebratory, no vocals.',
    music_length_ms: 22000,
  },
];

if (!dryRun) await loadLocalEnvFiles();
await mkdir(outDir, { recursive: true });
const apiKey = dryRun ? '' : await loadApiKey();
const missingVoiceLines = voiceLines.filter((line) => !process.env[line.voiceEnv] && !existsSync(path.join(outDir, `${line.id}.mp3`)));
if (!dryRun && missingVoiceLines.length > 0 && !allowPartial) {
  const missingVoiceEnvs = [...new Set(missingVoiceLines.map((line) => line.voiceEnv))].sort();
  throw new Error(
    `Missing ElevenLabs voice IDs for ${missingVoiceEnvs.join(', ')}. Set them in the environment or an ignored local env file, or rerun with --allow-partial.`,
  );
}

const manifest = {
  generatedAt: new Date().toISOString(),
  dryRun,
  sources: {
    tts: 'https://api.elevenlabs.io/v1/text-to-speech/:voice_id',
    music: 'https://api.elevenlabs.io/v1/music',
  },
  voiceLines: [],
  songs: [],
};

for (const line of voiceLines) {
  const voiceId = process.env[line.voiceEnv];
  const file = path.join(outDir, `${line.id}.mp3`);
  const generated = existsSync(file);
  const status = generated ? 'generated' : dryRun ? 'planned' : voiceId ? 'generated' : 'missing_voice_id';
  manifest.voiceLines.push({
    ...line,
    file: `public/audio/elevenlabs/${line.id}.mp3`,
    status,
  });
  if (dryRun || !voiceId || generated) continue;
  const bytes = await postAudio(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    text: line.text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: line.speaker === 'Mags Whitlow' ? 0.42 : 0.58,
      similarity_boost: line.speaker === 'Radio' ? 0.7 : 0.78,
      style: line.speaker === 'Radio' ? 0.08 : 0.35,
      use_speaker_boost: true,
    },
  });
  await writeFile(file, bytes);
}

for (const song of songs) {
  const file = path.join(outDir, `${song.id}.mp3`);
  const generated = existsSync(file);
  manifest.songs.push({
    ...song,
    file: `public/audio/elevenlabs/${song.id}.mp3`,
    status: generated || !dryRun ? 'generated' : 'planned',
  });
  if (dryRun || generated) continue;
  const bytes = await postAudio('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
    prompt: song.prompt,
    music_length_ms: song.music_length_ms,
    model_id: 'music_v1',
    force_instrumental: true,
    store_for_inpainting: false,
  });
  await writeFile(file, bytes);
}

await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${dryRun ? 'Planned' : 'Generated'} ${manifest.voiceLines.length} voice lines and ${manifest.songs.length} songs in ${path.relative(root, outDir)}`);

async function postAudio(url, body) {
  if (!apiKey) throw new Error('Missing ElevenLabs API key. Set ELEVENLABS_API_KEY or keep C:/Users/joshs/Projects/eleven-labs-api-key.txt.');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs request failed with ${response.status}: ${await response.text()}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function loadApiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const localKeyPath = 'C:/Users/joshs/Projects/eleven-labs-api-key.txt';
  if (!existsSync(localKeyPath)) return '';
  return (await readFile(localKeyPath, 'utf8')).trim();
}

async function loadLocalEnvFiles() {
  for (const envPath of localEnvPaths) {
    if (!existsSync(envPath)) continue;
    const contents = await readFile(envPath, 'utf8');
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separator = line.indexOf('=');
      if (separator <= 0) continue;
      const key = line.slice(0, separator).trim();
      if (!secretEnvKeys.has(key) || process.env[key]) continue;
      process.env[key] = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  }
}
