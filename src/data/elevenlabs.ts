import type { MusicCueId } from './audio';
import { dialogue } from './dialogue';
import { tracks } from './tracks';

export type VoiceAssetId =
  | 'arthur-prerace'
  | 'arthur-prerace-silverpine-track'
  | 'arthur-prerace-marina-track'
  | 'arthur-prerace-neon-track'
  | 'arthur-prerace-valkyrie-track'
  | 'mags-lights'
  | 'radio-team-damage'
  | 'radio-team-contact'
  | 'radio-team-tires';
export type SongAssetId = 'menu-gridline-spark' | 'prerace-five-lights-rising' | 'podium-carbon-champagne' | 'finale-apex-parade';

export interface ElevenLabsVoiceAsset {
  id: VoiceAssetId;
  speaker: 'Arthur Bell' | 'Mags Whitlow' | 'Radio';
  src: string;
  lineIds?: readonly string[];
  match: RegExp;
}

export interface ElevenLabsSongAsset {
  id: SongAssetId;
  cue: MusicCueId;
  src: string;
}

export const elevenLabsVoiceAssets: ElevenLabsVoiceAsset[] = [
  {
    id: 'arthur-prerace',
    speaker: 'Arthur Bell',
    src: '/audio/elevenlabs/arthur-prerace.mp3',
    lineIds: ['arthur.prerace.generic'],
    match: /looks magnificent today: fast entries, dangerous exits, and very honest kerbs\.$/i,
  },
  ...tracks.map((track) => {
    const text = fillTrack(dialogue.preraceByTrack[track.id as keyof typeof dialogue.preraceByTrack][0][1], track.name);
    return {
      id: `arthur-prerace-${track.id}-track` as VoiceAssetId,
      speaker: 'Arthur Bell' as const,
      src: `/audio/elevenlabs/arthur-prerace-${track.id}-track.mp3`,
      lineIds: [`arthur.prerace.${track.id}.track`],
      match: exactText(text),
    };
  }),
  {
    id: 'mags-lights',
    speaker: 'Mags Whitlow',
    src: '/audio/elevenlabs/mags-lights.mp3',
    lineIds: ['mags.lights.five-red'],
    match: /^Five red lights, then it is noise, nerves, and no excuses\.$/i,
  },
  {
    id: 'radio-team-damage',
    speaker: 'Radio',
    src: '/audio/elevenlabs/radio-team-damage.mp3',
    lineIds: ['radio.damage.climbing'],
    match: /^Damage is climbing\. Stay off the outside kerbs and bring it home\.$/i,
  },
  {
    id: 'radio-team-contact',
    speaker: 'Radio',
    src: '/audio/elevenlabs/radio-team-contact.mp3',
    lineIds: ['radio.contact.damage-check'],
    match: /^Contact confirmed\. Check the front wing and give them space\.$/i,
  },
  {
    id: 'radio-team-tires',
    speaker: 'Radio',
    src: '/audio/elevenlabs/radio-team-tires.mp3',
    lineIds: ['radio.tires.fading'],
    match: /^Tyres are fading\. Brake earlier and keep the steering smooth\.$/i,
  },
];

export const elevenLabsSongAssets: ElevenLabsSongAsset[] = [
  { id: 'menu-gridline-spark', cue: 'menu', src: '/audio/elevenlabs/menu-gridline-spark.mp3' },
  { id: 'prerace-five-lights-rising', cue: 'prerace', src: '/audio/elevenlabs/prerace-five-lights-rising.mp3' },
  { id: 'podium-carbon-champagne', cue: 'podium', src: '/audio/elevenlabs/podium-carbon-champagne.mp3' },
  { id: 'finale-apex-parade', cue: 'finale', src: '/audio/elevenlabs/finale-apex-parade.mp3' },
];

export function matchVoiceAsset(speaker: string, text: string, lineId?: string | null): ElevenLabsVoiceAsset | null {
  return (
    elevenLabsVoiceAssets.find((asset) => asset.speaker === speaker && Boolean(lineId) && Boolean(asset.lineIds?.includes(lineId!))) ??
    elevenLabsVoiceAssets.find((asset) => asset.speaker === speaker && asset.match.test(text)) ??
    null
  );
}

function fillTrack(text: string, trackName: string): string {
  return text.replaceAll('{track}', trackName);
}

function exactText(text: string): RegExp {
  return new RegExp(`^${escapeRegExp(text)}$`, 'i');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
