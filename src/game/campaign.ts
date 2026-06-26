import type { RaceResult, TrackDefinition } from '../types';

export interface CampaignScore {
  racerId: string;
  name: string;
  points: number;
  wins: number;
  podiums: number;
  lastFinish: number;
}

export interface CampaignObjective {
  raceIndex: number;
  raceNumber: number;
  totalRaces: number;
  trackId: string;
  trackName: string;
  targetPosition: number;
  rivalRacerId: string;
  rivalName: string;
  summary: string;
}

export interface CampaignObjectiveOutcome {
  objective: CampaignObjective;
  playerPosition: number;
  rivalPosition: number | null;
  achieved: boolean;
  summary: string;
}

const pointsByPlace = [25, 18, 15, 12, 10, 8, 6, 4];

export function createCampaignScores(racers: Array<{ id: string; name: string }>): CampaignScore[] {
  return racers.map((racer) => ({
    racerId: racer.id,
    name: racer.name,
    points: 0,
    wins: 0,
    podiums: 0,
    lastFinish: 0,
  }));
}

export function applyCampaignResults(scores: CampaignScore[], results: RaceResult[]): CampaignScore[] {
  const next = scores.map((score) => ({ ...score }));
  results.forEach((result, index) => {
    const score = next.find((item) => item.racerId === result.racerId);
    if (!score) return;
    score.points += pointsByPlace[index] ?? 0;
    score.wins += index === 0 ? 1 : 0;
    score.podiums += index < 3 ? 1 : 0;
    score.lastFinish = index + 1;
  });
  return sortCampaignScores(next);
}

export function sortCampaignScores(scores: CampaignScore[]): CampaignScore[] {
  return [...scores].sort((a, b) => b.points - a.points || b.wins - a.wins || b.podiums - a.podiums || a.lastFinish - b.lastFinish);
}

export function campaignLeader(scores: CampaignScore[]): CampaignScore | null {
  return sortCampaignScores(scores)[0] ?? null;
}

export function createCampaignObjective(
  scores: CampaignScore[],
  racers: Array<{ id: string; name: string }>,
  raceIndex: number,
  totalRaces: number,
  track: TrackDefinition,
): CampaignObjective {
  const sortedScores = sortCampaignScores(scores);
  const playerScore = sortedScores.find((score) => score.racerId === 'player');
  const fallbackRacer = racers.find((racer) => racer.id !== 'player') ?? racers[0];
  const rivalScore =
    sortedScores.find((score) => score.racerId !== 'player' && (!playerScore || score.points >= playerScore.points)) ??
    sortedScores.find((score) => score.racerId !== 'player');
  const targetPosition = raceIndex === totalRaces - 1 ? 1 : raceIndex === 0 ? 3 : 2;
  const rivalRacerId = rivalScore?.racerId ?? fallbackRacer?.id ?? 'cpu-1';
  const rivalName = rivalScore?.name ?? fallbackRacer?.name ?? 'the nearest rival';
  return {
    raceIndex,
    raceNumber: raceIndex + 1,
    totalRaces,
    trackId: track.id,
    trackName: track.name,
    targetPosition,
    rivalRacerId,
    rivalName,
    summary: `Finish P${targetPosition} or better and beat ${rivalName}`,
  };
}

export function evaluateCampaignObjective(objective: CampaignObjective, results: RaceResult[]): CampaignObjectiveOutcome {
  const playerIndex = results.findIndex((result) => result.racerId === 'player');
  const playerPosition = playerIndex >= 0 ? playerIndex + 1 : Math.max(1, results.length);
  const rivalIndex = results.findIndex((result) => result.racerId === objective.rivalRacerId);
  const rivalPosition = rivalIndex >= 0 ? rivalIndex + 1 : null;
  const beatRival = rivalPosition === null || playerPosition < rivalPosition;
  const achieved = playerPosition <= objective.targetPosition && beatRival;
  return {
    objective,
    playerPosition,
    rivalPosition,
    achieved,
    summary: achieved
      ? `Objective complete: P${playerPosition}, ahead of ${objective.rivalName}.`
      : `Objective missed: P${playerPosition}${rivalPosition ? `, ${objective.rivalName} P${rivalPosition}` : ''}.`,
  };
}
