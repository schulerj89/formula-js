import { dialogue } from '../data/dialogue';
import type { TrackDefinition } from '../types';

export interface PreRaceCommentaryLine {
  lineId: string;
  speaker: 'Arthur Bell' | 'Mags Whitlow';
  text: string;
  trackId: string;
}

export function createPreRaceCommentary(track: TrackDefinition, playerName: string): PreRaceCommentaryLine[] {
  const bank = dialogue.preraceByTrack[track.id as keyof typeof dialogue.preraceByTrack] ?? dialogue.prerace;
  return [
    {
      lineId: `arthur.prerace.${track.id}.track`,
      speaker: 'Arthur Bell',
      text: fillTrackBrief(bank[0][1], track, playerName),
      trackId: track.id,
    },
    {
      lineId: `mags.prerace.${track.id}.rivals`,
      speaker: 'Mags Whitlow',
      text: fillTrackBrief(bank[1][1], track, playerName),
      trackId: track.id,
    },
  ];
}

function fillTrackBrief(text: string, track: TrackDefinition, playerName: string): string {
  return text.replaceAll('{track}', track.name).replaceAll('{player}', playerName);
}
