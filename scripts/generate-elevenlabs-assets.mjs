import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'audio', 'elevenlabs');
const dryRun = !process.argv.includes('--generate');

const voiceLines = [
  {
    id: 'arthur-prerace',
    speaker: 'Arthur Bell',
    voiceEnv: 'ELEVENLABS_ARTHUR_VOICE_ID',
    text: '{track} looks magnificent today: fast entries, dangerous exits, and very honest kerbs.',
  },
  {
    id: 'mags-lights',
    speaker: 'Mags Whitlow',
    voiceEnv: 'ELEVENLABS_MAGS_VOICE_ID',
    text: 'Five red lights, then it is noise, nerves, and no excuses.',
  },
  {
    id: 'radio-damage',
    speaker: 'Radio',
    voiceEnv: 'ELEVENLABS_ARTHUR_VOICE_ID',
    text: 'Damage is climbing. Stay off the outside kerbs and bring it home.',
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

await mkdir(outDir, { recursive: true });
const apiKey = await loadApiKey();
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
  manifest.voiceLines.push({
    ...line,
    file: `public/audio/elevenlabs/${line.id}.mp3`,
    status: dryRun ? 'planned' : voiceId ? 'generated' : 'missing_voice_id',
  });
  if (dryRun || !voiceId) continue;
  const bytes = await postAudio(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    text: line.text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: line.speaker === 'Mags Whitlow' ? 0.42 : 0.58,
      similarity_boost: 0.78,
      style: line.speaker === 'Radio' ? 0.18 : 0.35,
      use_speaker_boost: true,
    },
  });
  await writeFile(file, bytes);
}

for (const song of songs) {
  const file = path.join(outDir, `${song.id}.mp3`);
  manifest.songs.push({
    ...song,
    file: `public/audio/elevenlabs/${song.id}.mp3`,
    status: dryRun ? 'planned' : 'generated',
  });
  if (dryRun) continue;
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
