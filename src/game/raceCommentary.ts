import type { RaceSnapshot, RacerState } from './race';

export type RaceCommentaryKind = 'position-gained' | 'position-lost';

export interface RaceCommentaryEvent {
  kind: RaceCommentaryKind;
  lineId: string;
  priority: 2;
  speaker: 'Arthur Bell' | 'Mags Whitlow';
  text: string;
  focusRacerId: string | null;
}

export function createPositionCommentary(
  previousPosition: number | null,
  snapshot: RaceSnapshot,
  playerName: string,
): RaceCommentaryEvent | null {
  if (!previousPosition || previousPosition === snapshot.position) return null;
  const playerIndex = snapshot.standings.findIndex((racer) => racer.definition.id === snapshot.player.definition.id);
  if (playerIndex < 0) return null;
  if (snapshot.position < previousPosition) {
    const passed = snapshot.standings[playerIndex + 1];
    return passed ? createGainCall(playerName, passed) : null;
  }
  const passer = snapshot.standings[playerIndex - 1];
  return passer ? createLossCall(playerName, passer) : null;
}

function createGainCall(playerName: string, rival: RacerState): RaceCommentaryEvent {
  return {
    kind: 'position-gained',
    lineId: 'mags.position-gained.clean-pass',
    priority: 2,
    speaker: 'Mags Whitlow',
    text: `${playerName} gets past ${rival.definition.shortName}. That was elbows out without making a mess.`,
    focusRacerId: rival.definition.id,
  };
}

function createLossCall(playerName: string, rival: RacerState): RaceCommentaryEvent {
  return {
    kind: 'position-lost',
    lineId: 'arthur.position-lost.reset',
    priority: 2,
    speaker: 'Arthur Bell',
    text: `${rival.definition.shortName} slips by ${playerName}. Reset the car and answer at the next braking zone.`,
    focusRacerId: rival.definition.id,
  };
}
