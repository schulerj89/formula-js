import type { RaceResult } from '../types';

export interface CampaignScore {
  racerId: string;
  name: string;
  points: number;
  wins: number;
  podiums: number;
  lastFinish: number;
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
