import type { MusicCueId } from './audio';

export type VoiceAssetId = 'arthur-prerace' | 'mags-lights' | 'radio-damage';
export type SongAssetId = 'menu-gridline-spark' | 'prerace-five-lights-rising' | 'podium-carbon-champagne' | 'finale-apex-parade';

export interface ElevenLabsVoiceAsset {
  id: VoiceAssetId;
  speaker: 'Arthur Bell' | 'Mags Whitlow' | 'Radio';
  src: string;
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
    match: /looks magnificent today: fast entries, dangerous exits, and very honest kerbs\.$/i,
  },
  {
    id: 'mags-lights',
    speaker: 'Mags Whitlow',
    src: '/audio/elevenlabs/mags-lights.mp3',
    match: /^Five red lights, then it is noise, nerves, and no excuses\.$/i,
  },
  {
    id: 'radio-damage',
    speaker: 'Radio',
    src: '/audio/elevenlabs/radio-damage.mp3',
    match: /^Damage is climbing\. Stay off the outside kerbs and bring it home\.$/i,
  },
];

export const elevenLabsSongAssets: ElevenLabsSongAsset[] = [
  { id: 'menu-gridline-spark', cue: 'menu', src: '/audio/elevenlabs/menu-gridline-spark.mp3' },
  { id: 'prerace-five-lights-rising', cue: 'prerace', src: '/audio/elevenlabs/prerace-five-lights-rising.mp3' },
  { id: 'podium-carbon-champagne', cue: 'podium', src: '/audio/elevenlabs/podium-carbon-champagne.mp3' },
  { id: 'finale-apex-parade', cue: 'finale', src: '/audio/elevenlabs/finale-apex-parade.mp3' },
];

export function matchVoiceAsset(speaker: string, text: string): ElevenLabsVoiceAsset | null {
  return elevenLabsVoiceAssets.find((asset) => asset.speaker === speaker && asset.match.test(text)) ?? null;
}
