import type { CampaignObjectiveOutcome, CampaignScore } from './campaign';
import type { RaceResult } from '../types';

export type PodiumCommentaryKind = 'race-winner' | 'player-result' | 'campaign-objective' | 'campaign-standings' | 'finale-champion' | 'finale-top-three';

export interface PodiumCommentaryEvent {
  kind: PodiumCommentaryKind;
  lineId: string;
  speaker: 'Arthur Bell' | 'Mags Whitlow';
  text: string;
  focusRacerId: string | null;
}

export function createRacePodiumCommentary(
  results: RaceResult[],
  playerName: string,
  campaignScores: CampaignScore[] = [],
  objectiveOutcome?: CampaignObjectiveOutcome | null,
): PodiumCommentaryEvent[] {
  const [winner, second, third] = results;
  const playerIndex = results.findIndex((result) => result.name === playerName);
  const events: PodiumCommentaryEvent[] = [];
  if (winner) {
    events.push({
      kind: 'race-winner',
      lineId: 'arthur.podium.winner',
      speaker: 'Arthur Bell',
      text: `${winner.name} wins it. ${second?.name ?? 'Second place'} and ${third?.name ?? 'third'} complete the podium after a proper fight.`,
      focusRacerId: winner.racerId,
    });
  }
  if (playerIndex >= 0) {
    const position = playerIndex + 1;
    events.push({
      kind: 'player-result',
      lineId: position === 1 ? 'mags.podium.player-win' : position <= 3 ? 'mags.podium.player-podium' : 'mags.podium.player-finish',
      speaker: 'Mags Whitlow',
      text:
        position === 1
          ? `${playerName} gets the top step and the dance. Try to look surprised.`
          : position <= 3
            ? `${playerName} is on the podium in P${position}. Sensible champagne, reckless grin.`
            : `${playerName} finishes P${position}. Not the balcony, but plenty for the engineers to chew on.`,
      focusRacerId: results[playerIndex].racerId,
    });
  }
  if (objectiveOutcome) {
    events.push({
      kind: 'campaign-objective',
      lineId: objectiveOutcome.achieved ? 'mags.podium.objective-complete' : 'arthur.podium.objective-missed',
      speaker: objectiveOutcome.achieved ? 'Mags Whitlow' : 'Arthur Bell',
      text: objectiveOutcome.achieved
        ? `${objectiveOutcome.summary} Campaign pressure handled, for now.`
        : `${objectiveOutcome.summary} The championship has made its notes.`,
      focusRacerId: 'player',
    });
  }
  const standingsLine = createStandingsLine(campaignScores);
  if (standingsLine) events.push(standingsLine);
  return events;
}

export function createFinaleCommentary(scores: CampaignScore[], playerName: string, raceCount: number): PodiumCommentaryEvent[] {
  const [champion, second, third] = scores;
  const playerIndex = scores.findIndex((score) => score.name === playerName);
  const events: PodiumCommentaryEvent[] = [];
  if (champion) {
    events.push({
      kind: 'finale-champion',
      lineId: 'arthur.finale.champion',
      speaker: 'Arthur Bell',
      text: `${champion.name} is champion after ${raceCount} races: ${champion.points} points, ${champion.wins} wins, and no room left for argument.`,
      focusRacerId: champion.racerId,
    });
  }
  if (champion && second && third) {
    events.push({
      kind: 'finale-top-three',
      lineId: 'mags.finale.top-three',
      speaker: 'Mags Whitlow',
      text: `Final top three: ${champion.name}, ${second.name}, then ${third.name}. That is a podium with receipts.`,
      focusRacerId: champion.racerId,
    });
  }
  if (playerIndex > 0) {
    const score = scores[playerIndex];
    events.push({
      kind: 'campaign-standings',
      lineId: 'arthur.finale.player-standing',
      speaker: 'Arthur Bell',
      text: `${playerName} finishes the campaign P${playerIndex + 1} on ${score.points} points. A full season written in braking zones.`,
      focusRacerId: score.racerId,
    });
  }
  return events;
}

function createStandingsLine(scores: CampaignScore[]): PodiumCommentaryEvent | null {
  const [leader, runnerUp] = scores;
  if (!leader) return null;
  const gap = runnerUp ? Math.max(0, leader.points - runnerUp.points) : leader.points;
  return {
    kind: 'campaign-standings',
    lineId: 'arthur.podium.campaign-lead',
    speaker: 'Arthur Bell',
    text: runnerUp
      ? `In the standings, ${leader.name} leads ${runnerUp.name} by ${gap} points. The campaign is tightening by the lap.`
      : `${leader.name} leads the campaign on ${leader.points} points.`,
    focusRacerId: leader.racerId,
  };
}
