import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'public', 'audio', 'elevenlabs', 'manifest.json');
const allowedStatuses = new Set(['planned', 'generated', 'missing_voice_id']);

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const problems = [];
const warnings = [];

validateGroup('voiceLines', manifest.voiceLines ?? []);
validateGroup('songs', manifest.songs ?? []);
validateVoiceLineIds(manifest.voiceLines ?? []);

if (problems.length > 0) {
  console.error(`ElevenLabs asset verification failed with ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

function validateVoiceLineIds(entries) {
  if (!Array.isArray(entries)) return;
  const seen = new Set();
  for (const entry of entries) {
    if (!Array.isArray(entry.lineIds) || entry.lineIds.length === 0) {
      problems.push(`voiceLines.${entry.id ?? 'unknown'} must include at least one lineId`);
      continue;
    }
    for (const lineId of entry.lineIds) {
      if (typeof lineId !== 'string' || !/^[a-z]+\.[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(lineId)) {
        problems.push(`voiceLines.${entry.id} has invalid lineId ${lineId}`);
      }
      const key = `${entry.speaker}:${lineId}`;
      if (seen.has(key)) problems.push(`voiceLines.${entry.id} duplicates speaker/lineId ${key}`);
      seen.add(key);
    }
  }
}

for (const warning of warnings) console.warn(`Warning: ${warning}`);
const generated = [...(manifest.voiceLines ?? []), ...(manifest.songs ?? [])].filter((entry) => entry.status === 'generated').length;
const planned = [...(manifest.voiceLines ?? []), ...(manifest.songs ?? [])].filter((entry) => entry.status === 'planned').length;
const missingVoiceIds = (manifest.voiceLines ?? []).filter((entry) => entry.status === 'missing_voice_id').length;
console.log(
  `ElevenLabs asset verification passed: ${generated} generated, ${planned} planned, ${missingVoiceIds} missing voice ID.`,
);

function validateGroup(groupName, entries) {
  const seen = new Set();
  if (!Array.isArray(entries) || entries.length === 0) {
    problems.push(`manifest.${groupName} must be a non-empty array`);
    return;
  }

  for (const entry of entries) {
    if (!entry.id) problems.push(`${groupName} entry is missing id`);
    if (seen.has(entry.id)) problems.push(`${groupName}.${entry.id} is duplicated`);
    seen.add(entry.id);

    if (!allowedStatuses.has(entry.status)) {
      problems.push(`${groupName}.${entry.id} has unsupported status ${entry.status}`);
    }

    const expectedFile = `public/audio/elevenlabs/${entry.id}.mp3`;
    if (entry.file !== expectedFile) {
      problems.push(`${groupName}.${entry.id} file must be ${expectedFile}`);
      continue;
    }

    const absoluteFile = path.join(root, entry.file);
    const exists = existsSync(absoluteFile);
    if (entry.status === 'generated') {
      if (!exists) {
        problems.push(`${groupName}.${entry.id} is marked generated but ${entry.file} is missing`);
      } else if (statSync(absoluteFile).size <= 0) {
        problems.push(`${groupName}.${entry.id} is marked generated but ${entry.file} is empty`);
      }
    } else if (exists) {
      warnings.push(`${groupName}.${entry.id} has a local MP3 but manifest status is ${entry.status}`);
    }
  }
}
