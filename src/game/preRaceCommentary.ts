import { dialogue } from '../data/dialogue';
import type { TrackDefinition } from '../types';
import type { CampaignObjective } from './campaign';

export interface PreRaceCommentaryLine {
  lineId: string;
  speaker: 'Arthur Bell' | 'Mags Whitlow';
  text: string;
  trackId: string;
}

export function createPreRaceCommentary(track: TrackDefinition, playerName: string, objective?: CampaignObjective | null): PreRaceCommentaryLine[] {
  const bank = dialogue.preraceByTrack[track.id as keyof typeof dialogue.preraceByTrack] ?? dialogue.prerace;
  const lines: PreRaceCommentaryLine[] = [
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
  if (objective) {
    lines.push({
      lineId: `arthur.prerace.${track.id}.objective`,
      speaker: 'Arthur Bell',
      text: `Campaign target: ${objective.summary}. That is the job before the lights go out.`,
      trackId: track.id,
    });
  }
  return lines;
}

function fillTrackBrief(text: string, track: TrackDefinition, playerName: string): string {
  return text.replaceAll('{track}', track.name).replaceAll('{player}', playerName);
}
