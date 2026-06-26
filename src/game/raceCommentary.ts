import type { RaceSnapshot, RacerState } from './race';
import type { RaceReadabilitySummary } from './raceReadability';

export type RaceCommentaryKind =
  | 'radio-team-contact'
  | 'radio-team-damage'
  | 'radio-team-tires'
  | 'position-gained'
  | 'position-lost'
  | 'spotter-side'
  | 'spotter-closing';

export interface RaceCommentaryEvent {
  kind: RaceCommentaryKind;
  lineId: string;
  priority: 2 | 3 | 4;
  speaker: 'Arthur Bell' | 'Mags Whitlow' | 'Radio';
  text: string;
  focusRacerId: string | null;
  radioKey: 'contact' | 'damage' | 'tires' | null;
}

export interface ActiveRaceEventInput {
  previousPosition: number | null;
  snapshot: RaceSnapshot;
  summary: RaceReadabilitySummary;
  playerName: string;
  lastRadio: string;
  lastContactRadioEvent: number;
}

export function pickActiveRaceEvent(input: ActiveRaceEventInput): RaceCommentaryEvent | null {
  const candidates = [
    createCriticalRadioEvent(input.snapshot, input.lastRadio, input.lastContactRadioEvent),
    createSpotterCommentary(input.summary),
    createPositionCommentary(input.previousPosition, input.snapshot, input.playerName),
  ].filter((event): event is RaceCommentaryEvent => Boolean(event));
  return candidates.sort((a, b) => b.priority - a.priority)[0] ?? null;
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

export function createSpotterCommentary(summary: RaceReadabilitySummary): RaceCommentaryEvent | null {
  if (summary.sideBySide) {
    return {
      kind: 'spotter-side',
      lineId: `radio.spotter-side.${summary.sideBySide.side}`,
      priority: 3,
      speaker: 'Radio',
      text: `${summary.sideBySide.shortName} alongside ${summary.sideBySide.side}. Hold your line.`,
      focusRacerId: summary.sideBySide.racerId,
      radioKey: null,
    };
  }
  const closingBehind = summary.nearestBehind?.closing && summary.nearestBehind.meters <= 36 ? summary.nearestBehind : null;
  if (closingBehind) {
    return {
      kind: 'spotter-closing',
      lineId: 'radio.spotter-closing.behind',
      priority: 3,
      speaker: 'Radio',
      text: `${closingBehind.shortName} closing fast behind. Cover the inside if you can.`,
      focusRacerId: closingBehind.racerId,
      radioKey: null,
    };
  }
  const closingAhead = summary.nearestAhead?.closing && summary.nearestAhead.meters <= 42 ? summary.nearestAhead : null;
  if (closingAhead) {
    return {
      kind: 'spotter-closing',
      lineId: 'radio.spotter-closing.ahead',
      priority: 3,
      speaker: 'Radio',
      text: `You are reeling in ${closingAhead.shortName}. Brake clean and make it count.`,
      focusRacerId: closingAhead.racerId,
      radioKey: null,
    };
  }
  return null;
}

function createCriticalRadioEvent(snapshot: RaceSnapshot, lastRadio: string, lastContactRadioEvent: number): RaceCommentaryEvent | null {
  if (snapshot.player.contactEvents > lastContactRadioEvent && snapshot.player.lastContactSeverity > 0.22) {
    return {
      kind: 'radio-team-contact',
      lineId: 'radio.contact.damage-check',
      priority: 4,
      speaker: 'Radio',
      text: 'Contact confirmed. Check the front wing and give them space.',
      focusRacerId: snapshot.player.lastContactRacerId,
      radioKey: 'contact',
    };
  }
  if (snapshot.player.damage < 0.45 && lastRadio !== 'damage') {
    return {
      kind: 'radio-team-damage',
      lineId: 'radio.damage.climbing',
      priority: 4,
      speaker: 'Radio',
      text: 'Damage is climbing. Stay off the outside kerbs and bring it home.',
      focusRacerId: null,
      radioKey: 'damage',
    };
  }
  if (snapshot.player.tires < 0.38 && lastRadio !== 'tires') {
    return {
      kind: 'radio-team-tires',
      lineId: 'radio.tires.fading',
      priority: 4,
      speaker: 'Radio',
      text: 'Tyres are fading. Brake earlier and keep the steering smooth.',
      focusRacerId: null,
      radioKey: 'tires',
    };
  }
  return null;
}

function createGainCall(playerName: string, rival: RacerState): RaceCommentaryEvent {
  return {
    kind: 'position-gained',
    lineId: 'mags.position-gained.clean-pass',
    priority: 2,
    speaker: 'Mags Whitlow',
    text: `${playerName} gets past ${rival.definition.shortName}. That was elbows out without making a mess.`,
    focusRacerId: rival.definition.id,
    radioKey: null,
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
    radioKey: null,
  };
}
