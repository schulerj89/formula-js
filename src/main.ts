import './styles.css';
import * as THREE from 'three';
import { musicThemes } from './data/audio';
import { formulaAssetManifest } from './data/assets';
import { bodyPaintOptions, findPaint, helmetPaintOptions } from './data/customization';
import { dialogue } from './data/dialogue';
import { cpuRacers, playerTemplate } from './data/racers';
import { tracks } from './data/tracks';
import { RaceAudio } from './game/audio';
import {
  applyCampaignResults,
  campaignLeader,
  createCampaignObjective,
  createCampaignScores,
  evaluateCampaignObjective,
  type CampaignObjective,
  type CampaignObjectiveOutcome,
  type CampaignScore,
} from './game/campaign';
import { createFormulaAssetManager } from './game/formulaAssets';
import { animateDriverIdle, summarizeDriverRig } from './game/models';
import { createFinaleCommentary, createRacePodiumCommentary, type PodiumCommentaryEvent, type PodiumCommentaryKind } from './game/podiumCommentary';
import { createPreRaceCommentary } from './game/preRaceCommentary';
import { createRace, createResults, type RaceControl, type RaceSnapshot } from './game/race';
import { pickActiveRaceEvent, type RaceCommentaryKind, type RadioWarningKey } from './game/raceCommentary';
import { createTrackMapLayout, summarizeRaceReadability, type TrackMapLayout } from './game/raceReadability';
import { createReplayRecorder, findReplayFrame, type RaceReplay, type ReplayHighlightEvent, type ReplayRecorder } from './game/replay';
import { buildRaceScene, createPodiumCeremony, type PodiumCeremonyStats, type SceneBuild, type SceneDetailLevel } from './game/scene';
import type { GameMode, GameSettings, GameState, RacerDefinition, RaceResult, TrackDefinition } from './types';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');
const root: HTMLDivElement = app;

const settings: GameSettings = {
  playerName: localStorage.getItem('gridline.playerName') || 'Rookie',
  controlMode: (localStorage.getItem('gridline.controlMode') as GameSettings['controlMode']) || 'holdToGo',
  performanceMode: (localStorage.getItem('gridline.performanceMode') as GameSettings['performanceMode']) || 'balanced',
  mute: localStorage.getItem('gridline.mute') === 'true',
  realisticTires: localStorage.getItem('gridline.realisticTires') !== 'false',
  realisticDamage: localStorage.getItem('gridline.realisticDamage') !== 'false',
  leaderboard: localStorage.getItem('gridline.leaderboard') !== 'false',
  bodyPaint: localStorage.getItem('gridline.bodyPaint') || bodyPaintOptions[0].id,
  helmetPaint: localStorage.getItem('gridline.helmetPaint') || helmetPaintOptions[0].id,
};

let gameState: GameState = 'menu';
let mode: GameMode = 'campaign';
let selectedTrack = tracks[0];
let sceneBuild: SceneBuild | null = null;
let race: ReturnType<typeof createRace> | null = null;
let latestSnapshot: RaceSnapshot | null = null;
let results: RaceResult[] = [];
let campaignScores: CampaignScore[] = [];
let captionTimer = 0;
let captionIndex = 0;
let lastCaptionSpeaker: string | null = null;
let lastCaptionText: string | null = null;
let lightTimer = 0;
let lightsOn = 0;
let lastLightBeep = 0;
let lastRadio = '';
const deliveredRadioKeys: RadioWarningKey[] = [];
let lastContactRadioEvent = 0;
let raceCommentaryElapsed = 0;
let lastCommentaryPosition: number | null = null;
let lastRaceCommentaryAt = -999;
let raceCommentaryCallouts = 0;
let spotterCallouts = 0;
let raceCommentarySuppressedByCooldown = 0;
let raceCommentarySuppressedByDedupe = 0;
let lastRaceEventSignature: string | null = null;
let lastRaceCommentaryKind: RaceCommentaryKind | null = null;
let lastRaceCommentaryLineId: string | null = null;
let lastRaceCommentaryPriority: number | null = null;
let lastRaceCommentarySpeaker: string | null = null;
let lastRaceCommentaryFocusRacerId: string | null = null;
let preRaceCommentaryTrackId: string | null = null;
let preRaceCommentaryLineIds: string[] = [];
let campaignTrackIndex = 0;
let currentCampaignObjective: CampaignObjective | null = null;
let lastCampaignObjectiveOutcome: CampaignObjectiveOutcome | null = null;
let uiBound = false;
let replayRecorder: ReplayRecorder | null = null;
let lastReplay: RaceReplay | null = null;
let replayElapsed = 0;
let replayWrappedElapsed = 0;
let replayEventIndex = 0;
let replayNextCaptionAt = 0;
let replayFocusRacerId = 'player';
let lastReplayEvent: ReplayHighlightEvent | null = null;
let podiumGroup: THREE.Group | null = null;
let podiumStats: PodiumCeremonyStats | null = null;
let podiumFocusId: string | null = null;
let podiumTopThreeIds: string[] = [];
let podiumStagedCarCount = 0;
let podiumParkedCarCount = 0;
let podiumCommentaryEvents: PodiumCommentaryEvent[] = [];
let podiumCommentaryIndex = 0;
let lastPodiumCommentaryKind: PodiumCommentaryKind | null = null;
let lastPodiumCommentaryLineId: string | null = null;
let lastPodiumCommentarySpeaker: string | null = null;
let lastPodiumCommentaryFocusRacerId: string | null = null;
let menuFlyoverIndex = 0;
let menuFlyoverTimer = 0;
let menuPreviewTrack = selectedTrack;
let trackMapLayout: TrackMapLayout | null = null;
let trackMapDotCount = 0;
let nearestAheadMeters: number | null = null;
let nearestBehindMeters: number | null = null;
let readoutClosingAhead = false;
let readoutClosingBehind = false;
let readoutSideBySide: string | null = null;
let nextBrakeMeters: number | null = null;
let brakeUrgency: 'clear' | 'soon' | 'now' = 'clear';
let captionQueue: Array<{ speaker: string; text: string; duration: number }> = [];
let captionQueueDelivered = 0;
let captionQueueSpeakers: string[] = [];
let cachedDebugMetrics: ReturnType<typeof buildDebugMetrics> | null = null;
let debugMetricTimer = 0;
let debugMetricRefreshes = 0;
let hudDomWrites = 0;
let leaderboardRenderCount = 0;
let trackMapDomWrites = 0;
let lastDamageScale = '';
let lastTireScale = '';
let lastLeaderboardHtml = '';
let leaderboardExpanded = false;
let sceneBuildCount = 0;
let firstFrameRendered = false;
let generatedAssetWarmupScheduled = false;
let generatedAssetWarmupStarted = false;
let generatedAssetWarmupCompleted = false;
let generatedAssetWarmupPending = false;
let generatedAssetWarmupMethod: 'idle' | 'timeout' | null = null;
let generatedAssetWarmupBlockedState: GameState | null = null;
let generatedAssetWarmupDeferrals = 0;
let generatedAssetWarmupScheduledAt = 0;
let generatedAssetWarmupStartedAt = 0;
const frameTimes: number[] = [];
let frameTimeWindow = 0;
const roadParkingBase = 17;
const preraceSequenceSeconds = 6.2;

const control: RaceControl = { throttle: false, brake: false, steer: 0 };
const keys = new Set<string>();

root.innerHTML = `
  <div class="game-shell">
    <canvas class="game-canvas" aria-label="Gridline Apex race view"></canvas>

    <section class="screen active" data-screen="menu" data-menu-stage="title">
      <div class="menu-top">
        <p class="kicker">Mobile formula racing</p>
        <h1 class="brand-title" data-title-treatment="motorsport-wordmark" aria-label="Gridline Apex">
          <span class="brand-line brand-line-grid">Gridline</span>
          <span class="brand-line brand-line-apex">Apex</span>
        </h1>
        <div class="flyover-label" aria-live="polite">
          <span>Flyover</span>
          <strong id="menuFlyoverTrack"></strong>
        </div>
        <div class="menu-actions">
          <button class="primary" data-action="campaign">Campaign</button>
          <button class="secondary" data-action="timeAttack">Time Attack</button>
        </div>
        <div class="menu-utility">
          <button class="secondary" data-action="settings">Settings</button>
          <button class="secondary" data-action="replay">Replay</button>
          <button class="secondary" data-action="garage">Garage</button>
        </div>
        <div class="menu-links">
          <button class="text-link" data-action="tutorial">Tutorial</button>
          <a class="text-link" href="asset-inspector.html">Asset Inspector</a>
        </div>
      </div>
      <div class="panel setup-panel" id="setupPanel" hidden>
        <h2>Race Setup</h2>
        <div class="setup-grid">
          <label class="field"><span>Name</span><input id="playerName" maxlength="18" /></label>
          <label class="field"><span>Track</span><select id="trackSelect"></select></label>
          <div class="garage-row">
            <span>Body</span>
            <div class="swatches" id="bodyPaintSwatches"></div>
          </div>
          <div class="garage-row">
            <span>Helmet</span>
            <div class="swatches" id="helmetPaintSwatches"></div>
          </div>
          <button class="primary" data-action="race">Race</button>
        </div>
        <div class="track-strip" id="trackStrip"></div>
      </div>
    </section>

    <section class="screen" data-screen="settings">
      <div class="panel">
        <h2>Settings</h2>
        <div class="settings-grid">
          <label class="field"><span>Controls</span><select id="controlMode"><option value="holdToGo">Hold to go, release to brake</option><option value="splitPedals">Brake and go buttons</option></select></label>
          <label class="field"><span>Performance</span><select id="performanceMode"><option value="battery">Battery</option><option value="balanced">Balanced</option><option value="highDetail">High detail</option></select></label>
          <label class="check-row"><input id="mute" type="checkbox" /> Mute sounds and music</label>
          <label class="check-row"><input id="realisticTires" type="checkbox" /> Realistic tire wear</label>
          <label class="check-row"><input id="realisticDamage" type="checkbox" /> Realistic damage</label>
          <label class="check-row"><input id="leaderboardToggle" type="checkbox" /> Show leaderboard panel</label>
          <button class="primary" data-action="back">Done</button>
        </div>
      </div>
    </section>

    <section class="screen" data-screen="tutorial">
      <div class="panel">
        <h2>Tutorial</h2>
        <div class="tutorial-list">
          <p><strong>Launch</strong> Hold Go when the lights build, then steer gently into the first corner.</p>
          <p><strong>Brake</strong> Release Go to brake in hold mode, or use Brake with split pedals.</p>
          <p><strong>Tyres</strong> Smooth steering saves tyre health and keeps exits faster.</p>
          <p><strong>Damage</strong> Stay off the grass and avoid heavy kerb strikes when damage is enabled.</p>
        </div>
        <button class="primary" data-action="back">Done</button>
      </div>
    </section>

    <section class="screen" data-screen="podium">
      <div class="panel">
        <h2 id="podiumTitle">Podium</h2>
        <div id="podiumResults"></div>
        <div id="campaignStandings" class="standings"></div>
        <div class="race-actions">
          <button class="primary" id="nextRaceButton" data-action="nextRace">Next Race</button>
          <button class="secondary" data-action="playReplay">Replay</button>
          <button class="secondary" data-action="menu">Menu</button>
        </div>
      </div>
    </section>

    <section class="screen" data-screen="replay">
      <div class="panel">
        <h2>Race Replay</h2>
        <p id="replayText">No full replay saved yet. Run a race to create the highlight camera.</p>
        <button class="primary" data-action="playReplay">Play Replay</button>
        <button class="primary" data-action="menu">Menu</button>
      </div>
    </section>

    <div class="hud">
      <div class="hud-main">
        <div class="stat"><b>Place</b><span id="place">1/8</span></div>
        <div class="stat"><b>Lap</b><span id="lap">1/3</span></div>
        <div class="stat"><b>Speed</b><span id="speed">0</span></div>
        <div class="bars">
          <div class="bar damage"><span id="damageBar"></span></div>
          <div class="bar"><span id="tireBar"></span></div>
        </div>
      </div>
      <div class="race-readout" id="raceReadout" aria-label="Race position map">
        <svg class="track-map" viewBox="0 0 128 128" role="img" aria-label="Track map">
          <polyline id="trackMapRoute" points="" />
          <g id="trackMapDots"></g>
        </svg>
        <div class="gap-strip">
          <span id="gapAhead">Up --</span>
          <span id="gapBehind">Back --</span>
          <span id="raceHint">Brake --</span>
        </div>
        <button class="leaderboard-toggle" id="leaderboardButton" data-action="toggleLeaderboard" type="button" aria-pressed="false">POS</button>
      </div>
      <aside class="leaderboard" id="leaderboard"><ol></ol></aside>
    </div>

    <div class="caption" id="caption"></div>

    <div class="start-lights" id="startLights" aria-label="Race start lights">
      <div class="start-light" data-light="1"></div>
      <div class="start-light" data-light="2"></div>
      <div class="start-light" data-light="3"></div>
      <div class="start-light" data-light="4"></div>
      <div class="start-light" data-light="5"></div>
    </div>

    <div class="campaign-objective" id="campaignObjective" hidden>
      <span>Campaign Objective</span>
      <strong id="campaignObjectiveText"></strong>
      <small id="campaignObjectiveMeta"></small>
    </div>

    <div class="controls" id="controls">
      <div class="control-cluster"><button class="steer" data-control="left" aria-label="Steer left">&lt;</button><button class="steer" data-control="right" aria-label="Steer right">&gt;</button></div>
      <button class="pedal brake" data-control="brake">Brake</button>
      <button class="pedal" data-control="go">Go</button>
    </div>

    <pre class="debug" id="debug"></pre>
  </div>
`;

const canvas = root.querySelector<HTMLCanvasElement>('.game-canvas')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(targetPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
const clock = new THREE.Clock();
const audio = new RaceAudio(settings);
const formulaAssets = createFormulaAssetManager();

const playerNameInput = root.querySelector<HTMLInputElement>('#playerName')!;
const trackSelect = root.querySelector<HTMLSelectElement>('#trackSelect')!;
const trackStrip = root.querySelector<HTMLDivElement>('#trackStrip')!;
const menuScreen = root.querySelector<HTMLElement>('[data-screen="menu"]')!;
const brandTitle = root.querySelector<HTMLElement>('.brand-title')!;
const menuFlyoverTrack = root.querySelector<HTMLElement>('#menuFlyoverTrack')!;
const setupPanel = root.querySelector<HTMLDivElement>('#setupPanel')!;
const bodyPaintSwatches = root.querySelector<HTMLDivElement>('#bodyPaintSwatches')!;
const helmetPaintSwatches = root.querySelector<HTMLDivElement>('#helmetPaintSwatches')!;
const caption = root.querySelector<HTMLDivElement>('#caption')!;
const startLights = root.querySelector<HTMLDivElement>('#startLights')!;
const campaignObjective = root.querySelector<HTMLDivElement>('#campaignObjective')!;
const campaignObjectiveText = root.querySelector<HTMLElement>('#campaignObjectiveText')!;
const campaignObjectiveMeta = root.querySelector<HTMLElement>('#campaignObjectiveMeta')!;
const controls = root.querySelector<HTMLDivElement>('#controls')!;
const goPedal = root.querySelector<HTMLButtonElement>('[data-control="go"]')!;
const brakePedal = root.querySelector<HTMLButtonElement>('[data-control="brake"]')!;
const hud = root.querySelector<HTMLDivElement>('.hud')!;
const leaderboard = root.querySelector<HTMLElement>('#leaderboard')!;
const debug = root.querySelector<HTMLElement>('#debug')!;
const trackMapRoute = root.querySelector<SVGPolylineElement>('#trackMapRoute')!;
const trackMapDots = root.querySelector<SVGGElement>('#trackMapDots')!;
const gapAhead = root.querySelector<HTMLElement>('#gapAhead')!;
const gapBehind = root.querySelector<HTMLElement>('#gapBehind')!;
const raceHint = root.querySelector<HTMLElement>('#raceHint')!;
const placeValue = root.querySelector<HTMLElement>('#place')!;
const lapValue = root.querySelector<HTMLElement>('#lap')!;
const speedValue = root.querySelector<HTMLElement>('#speed')!;
const damageBar = root.querySelector<HTMLElement>('#damageBar')!;
const tireBar = root.querySelector<HTMLElement>('#tireBar')!;
const leaderboardList = leaderboard.querySelector<HTMLOListElement>('ol')!;
const leaderboardButton = root.querySelector<HTMLButtonElement>('#leaderboardButton')!;
const trackMapDotElements = new Map<string, SVGCircleElement>();

initUi();
loadMenuScene();

window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => {
  keys.add(event.key.toLowerCase());
  if (event.key.toLowerCase() === 'l') {
    settings.leaderboard = !settings.leaderboard;
    saveSettings();
  }
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));

renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  update(dt);
  renderer.render(scene, camera);
  if (!firstFrameRendered) {
    firstFrameRendered = true;
    scheduleGeneratedAssetWarmup();
  }
});

function initUi(): void {
  playerNameInput.value = settings.playerName;
  trackSelect.innerHTML = tracks.map((track) => `<option value="${track.id}">${track.name}</option>`).join('');
  trackSelect.value = selectedTrack.id;
  bodyPaintSwatches.innerHTML = renderSwatches('bodyPaint', bodyPaintOptions, settings.bodyPaint);
  helmetPaintSwatches.innerHTML = renderSwatches('helmetPaint', helmetPaintOptions, settings.helmetPaint);
  trackStrip.innerHTML = tracks
    .map(
      (track) => `
      <button class="track-card ${track.id === selectedTrack.id ? 'selected' : ''}" data-track="${track.id}">
        <span><strong>${track.name}</strong><small>${track.country} / ${track.lengthKm.toFixed(1)} km / ${track.laps} laps</small></span>
        <span>${'S'.repeat(track.difficulty)}</span>
      </button>`,
    )
    .join('');

  root.querySelector<HTMLSelectElement>('#controlMode')!.value = settings.controlMode;
  root.querySelector<HTMLSelectElement>('#performanceMode')!.value = settings.performanceMode;
  root.querySelector<HTMLInputElement>('#mute')!.checked = settings.mute;
  root.querySelector<HTMLInputElement>('#realisticTires')!.checked = settings.realisticTires;
  root.querySelector<HTMLInputElement>('#realisticDamage')!.checked = settings.realisticDamage;
  root.querySelector<HTMLInputElement>('#leaderboardToggle')!.checked = settings.leaderboard;
  updateControlLayout();

  if (uiBound) return;
  uiBound = true;

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const action = target.dataset.action;
    const trackId = target.closest<HTMLElement>('[data-track]')?.dataset.track;
    if (trackId) {
      selectedTrack = tracks.find((track) => track.id === trackId) ?? selectedTrack;
      trackSelect.value = selectedTrack.id;
      initUi();
      loadMenuScene();
      return;
    }
    const paintTarget = target.closest<HTMLElement>('[data-paint-target]')?.dataset.paintTarget;
    const paintId = target.closest<HTMLElement>('[data-paint-id]')?.dataset.paintId;
    if (paintTarget && paintId) {
      if (paintTarget === 'bodyPaint') settings.bodyPaint = paintId;
      if (paintTarget === 'helmetPaint') settings.helmetPaint = paintId;
      saveSettings();
      initUi();
      loadMenuScene();
      return;
    }
    if (!action) return;
    audio.resume();
    if (action === 'campaign') {
      mode = 'campaign';
      campaignTrackIndex = 0;
      selectedTrack = tracks[0];
      campaignScores = createCampaignScores(buildRacers());
      showSetup();
    } else if (action === 'timeAttack') {
      mode = 'timeAttack';
      showSetup();
    } else if (action === 'garage') {
      showSetup();
    } else if (action === 'settings') {
      showScreen('settings');
    } else if (action === 'toggleLeaderboard') {
      toggleLeaderboardPanel();
    } else if (action === 'tutorial') {
      gameState = 'tutorial';
      showScreen('tutorial');
      queueDialogue(dialogue.tutorial, 3.8);
    } else if (action === 'back' || action === 'menu') {
      returnToTitleMenu();
    } else if (action === 'race') {
      startPreRace();
    } else if (action === 'nextRace') {
      if (mode === 'campaign' && campaignTrackIndex < tracks.length - 1) {
        campaignTrackIndex += 1;
        selectedTrack = tracks[campaignTrackIndex];
        startPreRace();
      } else if (mode === 'campaign') {
        showCampaignFinale();
      } else {
        returnToTitleMenu();
      }
    } else if (action === 'replay') {
      showReplayScreen();
    } else if (action === 'playReplay') {
      startReplayPlayback();
    }
  });

  playerNameInput.addEventListener('change', () => {
    settings.playerName = playerNameInput.value.trim() || 'Rookie';
    saveSettings();
  });
  trackSelect.addEventListener('change', () => {
    selectedTrack = tracks.find((track) => track.id === trackSelect.value) ?? selectedTrack;
    initUi();
    loadMenuScene();
  });

  for (const id of ['controlMode', 'performanceMode', 'mute', 'realisticTires', 'realisticDamage', 'leaderboardToggle']) {
    root.querySelector(`#${id}`)?.addEventListener('change', syncSettingsFromUi);
  }

  bindHold('[data-control="go"]', () => {
    control.throttle = true;
    if (settings.controlMode === 'holdToGo') control.brake = false;
  }, () => {
    control.throttle = false;
    if (settings.controlMode === 'holdToGo') control.brake = true;
  });
  bindHold('[data-control="brake"]', () => {
    control.brake = true;
  }, () => {
    control.brake = false;
  });
  bindHold('[data-control="left"]', () => {
    control.steer = -1;
  }, () => {
    if (control.steer < 0) control.steer = 0;
  });
  bindHold('[data-control="right"]', () => {
    control.steer = 1;
  }, () => {
    if (control.steer > 0) control.steer = 0;
  });
}

function update(dt: number): void {
  recordFrameTime(dt);
  if (gameState === 'menu') {
    updateMenuCamera(dt, true);
    audio.playMusic(musicThemes.menu, dt);
  } else if (gameState === 'prerace') {
    audio.playMusic(musicThemes.prerace, dt);
    lightTimer -= dt;
    updateStartLights();
    if (lightTimer <= 0) startRace();
    updateMenuCamera(dt * 0.7, false);
  } else if (gameState === 'race') {
    const activeControl = currentControl();
    raceCommentaryElapsed += dt;
    latestSnapshot = race?.update(dt, activeControl) ?? null;
    if (latestSnapshot) {
      updateCars(latestSnapshot);
      updateRaceCamera(latestSnapshot);
      updateHud(latestSnapshot);
      updateRaceAnnouncements(latestSnapshot);
      replayRecorder?.record(dt, latestSnapshot);
      audio.updateRaceFeedback(latestSnapshot, activeControl, dt);
      if (latestSnapshot.complete) finishRace(latestSnapshot);
    }
  } else if (gameState === 'podium') {
    audio.playMusic(musicThemes.podium, dt);
    updatePodiumCamera(dt, false);
    updatePodiumCommentary();
  } else if (gameState === 'replay') {
    updateReplayPlayback(dt);
  } else if (gameState === 'finale') {
    audio.playMusic(musicThemes.finale, dt);
    updatePodiumCamera(dt, true);
    updatePodiumCommentary();
  }

  captionTimer -= dt;
  if (captionTimer <= 0) {
    if (!showNextQueuedCaption() && gameState === 'race') rotateCaption();
  }
  exposeDebug(dt);
}

function returnToTitleMenu(): void {
  gameState = 'menu';
  audio.stopEngine();
  audio.stopSpeech();
  clearCaptionQueue(true);
  hideCaption();
  setSetupPanelOpen(false);
  showScreen('menu');
  loadMenuScene();
}

function showSetup(): void {
  selectedTrack = mode === 'campaign' ? tracks[campaignTrackIndex] : selectedTrack;
  trackSelect.value = selectedTrack.id;
  initUi();
  gameState = 'setup';
  setSetupPanelOpen(true);
  showScreen('menu');
}

function setSetupPanelOpen(open: boolean): void {
  setupPanel.hidden = !open;
  menuScreen.dataset.menuStage = open ? 'setup' : 'title';
}

function startPreRace(): void {
  invalidateDebugMetrics();
  settings.playerName = playerNameInput.value.trim() || 'Rookie';
  saveSettings();
  const racers = buildRacers();
  if (mode === 'campaign' && campaignTrackIndex === 0) campaignScores = createCampaignScores(racers);
  currentCampaignObjective =
    mode === 'campaign' ? createCampaignObjective(campaignScores.length ? campaignScores : createCampaignScores(racers), racers, campaignTrackIndex, tracks.length, selectedTrack) : null;
  lastCampaignObjectiveOutcome = null;
  renderCampaignObjective();
  gameState = 'prerace';
  lastReplay = null;
  lightsOn = 0;
  lastLightBeep = 0;
  lastContactRadioEvent = 0;
  lastRadio = '';
  deliveredRadioKeys.length = 0;
  raceCommentaryElapsed = 0;
  lastCommentaryPosition = null;
  lastRaceCommentaryAt = -999;
  raceCommentaryCallouts = 0;
  spotterCallouts = 0;
  raceCommentarySuppressedByCooldown = 0;
  raceCommentarySuppressedByDedupe = 0;
  lastRaceEventSignature = null;
  lastRaceCommentaryKind = null;
  lastRaceCommentaryLineId = null;
  lastRaceCommentaryPriority = null;
  lastRaceCommentarySpeaker = null;
  lastRaceCommentaryFocusRacerId = null;
  const preRaceCommentary = createPreRaceCommentary(selectedTrack, settings.playerName, currentCampaignObjective);
  preRaceCommentaryTrackId = selectedTrack.id;
  preRaceCommentaryLineIds = preRaceCommentary.map((line) => line.lineId);
  updateStartLights();
  startLights.classList.add('active');
  showScreen(null);
  hud.classList.remove('active');
  controls.classList.remove('active');
  sceneBuild = buildTrackedRaceScene(selectedTrack, racers);
  renderTrackMapRoute();
  race = createRace(mode, selectedTrack, racers, settings);
  replayRecorder = createReplayRecorder(selectedTrack.id, selectedTrack.name, settings.playerName);
  latestSnapshot = race.snapshot();
  lastCommentaryPosition = latestSnapshot.position;
  replayRecorder.record(0, latestSnapshot);
  lightTimer = preraceSequenceSeconds;
  queueDialogue([...preRaceCommentary.map((line) => [line.speaker, line.text] as const), dialogue.lights[0]], 2.1);
}

function startRace(): void {
  invalidateDebugMetrics();
  gameState = 'race';
  leaderboardExpanded = settings.leaderboard && !isMobileViewport();
  lightsOn = 0;
  startLights.classList.remove('active');
  campaignObjective.hidden = true;
  resetFrameStats();
  audio.stopMusic();
  hud.classList.add('active');
  controls.classList.add('active');
  updateControlLayout();
  control.brake = false;
  control.throttle = false;
  control.steer = 0;
  clearCaptionQueue(false);
  showCaption('Mags Whitlow', fill(dialogue.lights[1][1]), 4.4, 'mags.lights.five-red');
}

function updateStartLights(): void {
  const elapsed = 3.4 - lightTimer;
  lightsOn = Math.min(5, Math.max(0, Math.floor(elapsed / 0.48) + 1));
  if (lightTimer <= 0.35) lightsOn = 5;
  if (lightsOn > lastLightBeep) {
    audio.beep(1);
    lastLightBeep = lightsOn;
  }
  startLights.querySelectorAll<HTMLElement>('.start-light').forEach((light, index) => {
    light.classList.toggle('on', index < lightsOn);
  });
}

function finishRace(snapshot: RaceSnapshot): void {
  results = createResults(snapshot);
  lastReplay = replayRecorder?.finalize(results) ?? lastReplay;
  replayRecorder = null;
  lastCampaignObjectiveOutcome = mode === 'campaign' && currentCampaignObjective ? evaluateCampaignObjective(currentCampaignObjective, results) : null;
  campaignObjective.hidden = true;
  if (mode === 'campaign') {
    campaignScores = applyCampaignResults(campaignScores.length ? campaignScores : createCampaignScores(buildRacers()), results);
  }
  gameState = 'podium';
  stagePodiumCeremony(results.slice(0, 3).map((result) => result.racerId), false);
  audio.stopEngine();
  controls.classList.remove('active');
  hud.classList.remove('active');
  showScreen('podium');
  renderPodium();
  startPodiumCommentary(createRacePodiumCommentary(results, settings.playerName, campaignScores, lastCampaignObjectiveOutcome));
  invalidateDebugMetrics();
}

function renderCampaignObjective(): void {
  if (!currentCampaignObjective || gameState === 'race') {
    campaignObjective.hidden = true;
    return;
  }
  campaignObjective.hidden = false;
  campaignObjectiveText.textContent = currentCampaignObjective.summary;
  campaignObjectiveMeta.textContent = `Race ${currentCampaignObjective.raceNumber}/${currentCampaignObjective.totalRaces} / ${currentCampaignObjective.trackName}`;
}

function buildRacers(): RacerDefinition[] {
  const bodyPaint = findPaint(bodyPaintOptions, settings.bodyPaint, bodyPaintOptions[0]);
  const helmetPaint = findPaint(helmetPaintOptions, settings.helmetPaint, helmetPaintOptions[0]);
  return [{ ...playerTemplate, name: settings.playerName, color: bodyPaint.value, helmet: helmetPaint.value }, ...cpuRacers];
}

function buildTrackedRaceScene(track: TrackDefinition, racers: RacerDefinition[]): SceneBuild {
  sceneBuildCount += 1;
  invalidateDebugMetrics();
  return buildRaceScene(scene, track, racers, createSceneCar, sceneDetailLevel());
}

function loadMenuScene(): void {
  podiumGroup = null;
  podiumStats = null;
  podiumFocusId = null;
  clearPodiumCommentary();
  currentCampaignObjective = null;
  campaignObjective.hidden = true;
  menuPreviewTrack = selectedTrack;
  menuFlyoverIndex = tracks.findIndex((track) => track.id === selectedTrack.id);
  menuFlyoverTimer = 7;
  syncMenuFlyoverLabel();
  sceneBuild = buildTrackedRaceScene(menuPreviewTrack, buildRacers());
  clearTrackMap();
  race = null;
  latestSnapshot = null;
  hud.classList.remove('active');
  controls.classList.remove('active');
  retryGeneratedAssetWarmupIfPending();
}

function scheduleGeneratedAssetWarmup(): void {
  if (generatedAssetWarmupScheduled) return;
  generatedAssetWarmupScheduled = true;
  generatedAssetWarmupScheduledAt = performance.now();
  invalidateDebugMetrics();
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  };
  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(() => startGeneratedAssetWarmup('idle'), { timeout: 1800 });
  } else {
    window.setTimeout(() => startGeneratedAssetWarmup('timeout'), 900);
  }
}

function startGeneratedAssetWarmup(method: 'idle' | 'timeout'): void {
  if (generatedAssetWarmupStarted) return;
  if (!canStartGeneratedAssetWarmup()) {
    generatedAssetWarmupPending = true;
    generatedAssetWarmupMethod = method;
    generatedAssetWarmupBlockedState = gameState;
    generatedAssetWarmupDeferrals += 1;
    invalidateDebugMetrics();
    return;
  }
  generatedAssetWarmupPending = false;
  generatedAssetWarmupBlockedState = null;
  generatedAssetWarmupStarted = true;
  generatedAssetWarmupMethod = method;
  generatedAssetWarmupStartedAt = performance.now();
  invalidateDebugMetrics();
  void formulaAssets.warmup().then(() => {
    generatedAssetWarmupCompleted = true;
    invalidateDebugMetrics();
    if (gameState === 'menu' || gameState === 'setup') loadMenuScene();
  });
}

function retryGeneratedAssetWarmupIfPending(): void {
  if (!generatedAssetWarmupPending || generatedAssetWarmupStarted || !canStartGeneratedAssetWarmup()) return;
  startGeneratedAssetWarmup(generatedAssetWarmupMethod ?? 'timeout');
}

function canStartGeneratedAssetWarmup(): boolean {
  return gameState === 'menu' || gameState === 'setup';
}

function updateMenuCamera(dt: number, cycleTracks: boolean): void {
  if (!sceneBuild) return;
  captionTimer -= dt;
  if (cycleTracks) {
    menuFlyoverTimer -= dt;
    if (menuFlyoverTimer <= 0) {
      menuFlyoverIndex = (menuFlyoverIndex + 1) % tracks.length;
      menuPreviewTrack = tracks[menuFlyoverIndex];
      sceneBuild = buildTrackedRaceScene(menuPreviewTrack, buildRacers());
      menuFlyoverTimer = 7;
      syncMenuFlyoverLabel();
    }
  }
  const t = (performance.now() * 0.000035) % 1;
  const pose = sceneBuild.path.poseAt(t, 76);
  const look = sceneBuild.path.poseAt(t + 0.025, 0).position;
  camera.position.lerp(new THREE.Vector3(pose.position.x, 68, pose.position.z), 0.04);
  camera.lookAt(look.x, 0, look.z);
}

function updateRaceCamera(snapshot: RaceSnapshot): void {
  if (!sceneBuild) return;
  const pose = sceneBuild.path.poseAt(snapshot.player.progress, snapshot.player.lateral);
  const back = pose.tangent.clone().multiplyScalar(-13);
  const target = pose.position.clone().add(back).add(new THREE.Vector3(0, 7.4, 0));
  camera.position.lerp(target, 0.12);
  camera.lookAt(pose.position.x, 1.5, pose.position.z);
}

function updatePodiumCamera(dt: number, finale: boolean): void {
  if (!sceneBuild) return;
  const fallbackId = finale ? campaignLeader(campaignScores)?.racerId ?? results[0]?.racerId : results[0]?.racerId;
  const targetId = podiumFocusId ?? fallbackId;
  if (!targetId) return;
  const winner = sceneBuild.cars.get(targetId);
  if (!winner) return;
  const elapsed = performance.now() * 0.001;
  const radius = finale ? 18 : 12;
  const target = winner?.position ?? new THREE.Vector3();
  camera.position.set(target.x + Math.cos(elapsed * 0.45) * radius, finale ? 10 : 7, target.z + Math.sin(elapsed * 0.45) * radius);
  camera.lookAt(target.x, 1.5, target.z);
  for (const car of sceneBuild.cars.values()) animateDriverIdle(car, elapsed, car === winner, finale);
  void dt;
}

function updateCars(snapshot: RaceSnapshot): void {
  if (!sceneBuild) return;
  const elapsed = performance.now() * 0.001;
  for (const state of snapshot.racers) {
    const car = sceneBuild.cars.get(state.definition.id);
    if (!car) continue;
    const pose = sceneBuild.path.poseAt(state.progress, state.lateral);
    car.position.copy(pose.position);
    car.position.y = 0.2;
    car.rotation.y = pose.yaw - state.lateral * 0.015;
    animateDriverIdle(car, elapsed);
    const wheelSpin = state.speed * elapsed * 0.6;
    cachedCarWheels(car).forEach((wheel) => {
      wheel.rotation.x = wheelSpin;
    });
  }
}

function cachedCarWheels(car: THREE.Group): THREE.Object3D[] {
  const cached = car.userData.wheels;
  if (Array.isArray(cached)) return cached as THREE.Object3D[];
  const wheels = car.children.filter((child) => child.name === 'separate-wheel');
  car.userData.wheels = wheels;
  return wheels;
}

function updateHud(snapshot: RaceSnapshot): void {
  const totalLaps = mode === 'timeAttack' ? 1 : selectedTrack.laps;
  const visibleLap = snapshot.player.finished ? totalLaps : Math.min(totalLaps, snapshot.player.lap + 1);
  setTextIfChanged(placeValue, `${snapshot.position}/8`);
  setTextIfChanged(lapValue, `${visibleLap}/${totalLaps}`);
  setTextIfChanged(speedValue, `${Math.round(snapshot.player.speed * 3.6)}`);
  setScaleIfChanged(damageBar, 'damage', snapshot.player.damage);
  setScaleIfChanged(tireBar, 'tires', snapshot.player.tires);
  updateTrackMap(snapshot);
  const showLeaderboard = settings.leaderboard && (!isMobileViewport() || leaderboardExpanded);
  leaderboard.classList.toggle('active', showLeaderboard);
  leaderboardButton.classList.toggle('available', settings.leaderboard);
  leaderboardButton.setAttribute('aria-label', showLeaderboard ? 'Hide leaderboard' : 'Show leaderboard');
  leaderboardButton.setAttribute('aria-expanded', `${showLeaderboard}`);
  const leaderboardHtml = snapshot.standings
    .map((racer) => `<li class="${racer.definition.id === playerTemplate.id ? 'player' : ''}">${racer.definition.shortName} / L${visibleRacerLap(racer)}</li>`)
    .join('');
  if (leaderboardHtml !== lastLeaderboardHtml) {
    leaderboardList.innerHTML = leaderboardHtml;
    lastLeaderboardHtml = leaderboardHtml;
    leaderboardRenderCount += 1;
    hudDomWrites += 1;
  }
}

function toggleLeaderboardPanel(): void {
  if (!settings.leaderboard) return;
  leaderboardExpanded = !leaderboardExpanded;
  invalidateDebugMetrics();
}

function setTextIfChanged(element: HTMLElement, value: string): void {
  if (element.textContent === value) return;
  element.textContent = value;
  hudDomWrites += 1;
}

function setScaleIfChanged(element: HTMLElement, kind: 'damage' | 'tires', value: number): void {
  const scale = `${Math.max(0, Math.min(1, value)).toFixed(3)}`;
  if (kind === 'damage') {
    if (scale === lastDamageScale) return;
    lastDamageScale = scale;
  } else {
    if (scale === lastTireScale) return;
    lastTireScale = scale;
  }
  element.style.transform = `scaleX(${scale})`;
  hudDomWrites += 1;
}

function setSvgAttrIfChanged(element: SVGElement, name: string, value: string): void {
  if (element.getAttribute(name) === value) return;
  element.setAttribute(name, value);
  trackMapDomWrites += 1;
}

function renderTrackMapRoute(): void {
  trackMapLayout = createTrackMapLayout(selectedTrack);
  trackMapRoute.setAttribute('points', trackMapLayout.routePoints);
  trackMapDotElements.clear();
  trackMapDots.textContent = '';
  trackMapDotCount = 0;
  nearestAheadMeters = null;
  nearestBehindMeters = null;
  readoutClosingAhead = false;
  readoutClosingBehind = false;
  readoutSideBySide = null;
  nextBrakeMeters = null;
  brakeUrgency = 'clear';
  gapAhead.textContent = 'Up --';
  gapBehind.textContent = 'Back --';
  raceHint.textContent = 'Brake --';
  raceHint.className = '';
}

function clearTrackMap(): void {
  trackMapLayout = null;
  trackMapRoute.setAttribute('points', '');
  trackMapDotElements.clear();
  trackMapDots.textContent = '';
  trackMapDotCount = 0;
  nearestAheadMeters = null;
  nearestBehindMeters = null;
  readoutClosingAhead = false;
  readoutClosingBehind = false;
  readoutSideBySide = null;
  nextBrakeMeters = null;
  brakeUrgency = 'clear';
}

function updateTrackMap(snapshot: RaceSnapshot): void {
  if (!sceneBuild || !trackMapLayout) renderTrackMapRoute();
  if (!sceneBuild || !trackMapLayout) return;
  for (const racer of snapshot.racers) {
    let dot = trackMapDotElements.get(racer.definition.id);
    if (!dot) {
      dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.dataset.racerId = racer.definition.id;
      dot.setAttribute('r', racer.definition.id === 'player' ? '4.8' : '3.2');
      dot.setAttribute('class', `track-dot ${racer.definition.id === 'player' ? 'player' : ''}`);
      trackMapDots.append(dot);
      trackMapDotElements.set(racer.definition.id, dot);
      trackMapDomWrites += 3;
    }
    const pose = sceneBuild.path.poseAt(racer.progress, 0);
    const point = trackMapLayout.project(pose.position.x, pose.position.z);
    setSvgAttrIfChanged(dot, 'cx', point.x.toFixed(1));
    setSvgAttrIfChanged(dot, 'cy', point.y.toFixed(1));
  }
  trackMapDotCount = trackMapDotElements.size;
  const summary = summarizeRaceReadability(snapshot, selectedTrack);
  nearestAheadMeters = summary.nearestAhead?.meters ?? null;
  nearestBehindMeters = summary.nearestBehind?.meters ?? null;
  readoutClosingAhead = Boolean(summary.nearestAhead?.closing);
  readoutClosingBehind = Boolean(summary.nearestBehind?.closing);
  readoutSideBySide = summary.sideBySide ? `${summary.sideBySide.shortName} ${summary.sideBySide.side}` : null;
  nextBrakeMeters = summary.nextBrakeMeters;
  brakeUrgency = summary.brakeUrgency;
  setTextIfChanged(
    gapAhead,
    summary.nearestAhead ? `Up ${summary.nearestAhead.shortName} ${formatMeters(summary.nearestAhead.meters)}${summary.nearestAhead.closing ? ' +' : ''}` : 'Up clear',
  );
  setTextIfChanged(
    gapBehind,
    summary.nearestBehind
      ? `Back ${summary.nearestBehind.shortName} ${formatMeters(summary.nearestBehind.meters)}${summary.nearestBehind.closing ? ' +' : ''}`
      : 'Back clear',
  );
  setTextIfChanged(
    raceHint,
    summary.sideBySide
      ? `Side ${summary.sideBySide.shortName} ${summary.sideBySide.side}`
      : summary.nextBrakeMeters !== null
        ? `${summary.brakeUrgency === 'now' ? 'Brake now' : 'Brake'} ${formatMeters(summary.nextBrakeMeters)}`
        : 'Brake clear',
  );
  const hintClass = summary.sideBySide ? 'danger' : summary.brakeUrgency;
  if (raceHint.className !== hintClass) {
    raceHint.className = hintClass;
    hudDomWrites += 1;
  }
}

function updateRaceAnnouncements(snapshot: RaceSnapshot, force = false): void {
  const previousPosition = lastCommentaryPosition;
  lastCommentaryPosition = snapshot.position;
  const summary = summarizeRaceReadability(snapshot, selectedTrack);
  const event = pickActiveRaceEvent({
    previousPosition,
    snapshot,
    summary,
    playerName: settings.playerName,
    lastRadio,
    lastContactRadioEvent,
    deliveredRadioKeys,
  });
  if (!event) return;
  const eventSignature = `${event.lineId}:${event.focusRacerId ?? 'none'}`;
  if (!force && event.priority < 4 && eventSignature === lastRaceEventSignature && raceCommentaryElapsed - lastRaceCommentaryAt < 7.5) {
    raceCommentarySuppressedByDedupe += 1;
    return;
  }
  if (!force && event.priority < 4 && (raceCommentaryElapsed < 3.5 || raceCommentaryElapsed - lastRaceCommentaryAt < 4.4)) {
    raceCommentarySuppressedByCooldown += 1;
    return;
  }
  raceCommentaryCallouts += 1;
  if (event.kind === 'spotter-side' || event.kind === 'spotter-closing') spotterCallouts += 1;
  lastRaceCommentaryAt = raceCommentaryElapsed;
  lastRaceEventSignature = eventSignature;
  lastRaceCommentaryKind = event.kind;
  lastRaceCommentaryLineId = event.lineId;
  lastRaceCommentaryPriority = event.priority;
  lastRaceCommentarySpeaker = event.speaker;
  lastRaceCommentaryFocusRacerId = event.focusRacerId;
  if (event.radioKey === 'contact') lastContactRadioEvent = snapshot.player.contactEvents;
  if (event.radioKey) {
    lastRadio = event.radioKey;
    if (!deliveredRadioKeys.includes(event.radioKey)) deliveredRadioKeys.push(event.radioKey);
  }
  replayRecorder?.markIncident({
    sourceKind: event.kind,
    lineId: event.lineId,
    speaker: event.speaker,
    text: event.text,
    focusRacerId: event.focusRacerId,
    radioKey: event.radioKey,
  });
  showCaption(event.speaker, event.text, 5.5, event.lineId);
}

function rotateCaption(): void {
  const bank = gameState === 'race' ? dialogue.race : dialogue.title;
  const line = bank[captionIndex % bank.length];
  captionIndex += 1;
  showCaption(line[0], fill(line[1]));
}

function queueDialogue(lines: Array<readonly string[]>, duration = 3.4): void {
  clearCaptionQueue(true);
  captionQueue = lines.map(([speaker, text]) => ({ speaker: speaker ?? 'Arthur Bell', text: fill(text ?? ''), duration }));
  showNextQueuedCaption();
}

function showNextQueuedCaption(): boolean {
  const next = captionQueue.shift();
  if (!next) return false;
  captionQueueDelivered += 1;
  showCaption(next.speaker, next.text, next.duration);
  return true;
}

function clearCaptionQueue(resetMetrics: boolean): void {
  captionQueue = [];
  if (resetMetrics) {
    captionQueueDelivered = 0;
    captionQueueSpeakers = [];
  }
}

function hideCaption(): void {
  caption.textContent = '';
  caption.classList.remove('active');
  lastCaptionSpeaker = null;
  lastCaptionText = null;
  captionTimer = 0;
}

function showCaption(name: string, text: string, duration = 5.5, lineId?: string | null): void {
  caption.textContent = '';
  const speaker = document.createElement('strong');
  speaker.textContent = name;
  caption.append(speaker, ` ${text}`);
  caption.classList.add('active');
  lastCaptionSpeaker = name;
  lastCaptionText = text;
  if (!captionQueueSpeakers.includes(name)) captionQueueSpeakers.push(name);
  captionTimer = duration;
  audio.speak(name, text, lineId);
}

function syncMenuFlyoverLabel(): void {
  menuFlyoverTrack.textContent = menuPreviewTrack.name;
  menuFlyoverTrack.dataset.trackId = menuPreviewTrack.id;
  invalidateDebugMetrics();
}

function renderPodium(): void {
  const podium = root.querySelector<HTMLDivElement>('#podiumResults')!;
  root.querySelector<HTMLHeadingElement>('#podiumTitle')!.textContent = mode === 'campaign' ? `${selectedTrack.name} Podium` : 'Podium';
  podium.innerHTML = results
    .slice(0, 3)
    .map((result, index) => `<p><strong>${index + 1}. ${result.name}</strong> / ${formatTime(result.totalTime)} / Best ${formatTime(result.bestLap)}</p>`)
    .join('');
  renderCampaignStandings();
  const nextButton = root.querySelector<HTMLButtonElement>('#nextRaceButton')!;
  nextButton.textContent = mode === 'campaign' && campaignTrackIndex < tracks.length - 1 ? 'Next Race' : mode === 'campaign' ? 'Finale' : 'Done';
}

function renderCampaignStandings(): void {
  const standings = root.querySelector<HTMLDivElement>('#campaignStandings')!;
  if (mode !== 'campaign' || campaignScores.length === 0) {
    standings.innerHTML = '';
    return;
  }
  standings.innerHTML = `
    <h3>Campaign Standings</h3>
    <ol>${campaignScores
      .slice(0, 5)
      .map((score) => `<li>${score.name} / ${score.points} pts / ${score.wins} wins</li>`)
      .join('')}</ol>
  `;
}

function startPodiumCommentary(events: PodiumCommentaryEvent[]): void {
  podiumCommentaryEvents = events.length ? events : [{ kind: 'race-winner', lineId: 'arthur.podium.generic', speaker: 'Arthur Bell', text: fill(dialogue.podium[0][1]), focusRacerId: podiumFocusId }];
  podiumCommentaryIndex = 0;
  showNextPodiumCommentary();
}

function updatePodiumCommentary(): void {
  if (captionTimer <= 0) showNextPodiumCommentary();
}

function showNextPodiumCommentary(): void {
  const event = podiumCommentaryEvents[podiumCommentaryIndex];
  if (!event) return;
  podiumCommentaryIndex += 1;
  lastPodiumCommentaryKind = event.kind;
  lastPodiumCommentaryLineId = event.lineId;
  lastPodiumCommentarySpeaker = event.speaker;
  lastPodiumCommentaryFocusRacerId = event.focusRacerId;
  showCaption(event.speaker, event.text, 5.5, event.lineId);
}

function clearPodiumCommentary(): void {
  podiumCommentaryEvents = [];
  podiumCommentaryIndex = 0;
  lastPodiumCommentaryKind = null;
  lastPodiumCommentaryLineId = null;
  lastPodiumCommentarySpeaker = null;
  lastPodiumCommentaryFocusRacerId = null;
}

function showCampaignFinale(): void {
  invalidateDebugMetrics();
  gameState = 'finale';
  stagePodiumCeremony(campaignScores.slice(0, 3).map((score) => score.racerId), true);
  showScreen('podium');
  root.querySelector<HTMLHeadingElement>('#podiumTitle')!.textContent = 'Campaign Champions';
  root.querySelector<HTMLDivElement>('#podiumResults')!.innerHTML = campaignScores
    .slice(0, 3)
    .map((score, index) => `<p><strong>${index + 1}. ${score.name}</strong> / ${score.points} pts / ${score.wins} wins</p>`)
    .join('');
  renderCampaignStandings();
  root.querySelector<HTMLButtonElement>('#nextRaceButton')!.textContent = 'Done';
  startPodiumCommentary(createFinaleCommentary(campaignScores, settings.playerName, tracks.length));
}

function forcePodiumForSmoke(finaleMode = false): void {
  const racers = buildRacers();
  if (!sceneBuild) sceneBuild = buildTrackedRaceScene(selectedTrack, racers);
  hud.classList.remove('active');
  controls.classList.remove('active');
  leaderboard.classList.remove('active');
  leaderboardExpanded = false;
  control.throttle = false;
  control.brake = false;
  control.steer = 0;
  results = racers.slice(0, 3).map((racer, index) => ({
    racerId: racer.id,
    name: racer.name,
    totalTime: 84 + index * 1.7,
    bestLap: 27 + index * 0.4,
    damage: 0.92 - index * 0.05,
    tires: 0.74 - index * 0.04,
  }));
  campaignScores = campaignScores.length ? campaignScores : createCampaignScores(racers);
  if (finaleMode) {
    campaignScores = campaignScores.map((score, index) => ({
      ...score,
      points: 96 - index * 8,
      wins: index === 0 ? 3 : index === 1 ? 1 : 0,
      podiums: Math.max(0, 4 - index),
      lastFinish: index + 1,
    }));
    gameState = 'finale';
    showCampaignFinale();
  } else {
    gameState = 'podium';
    stagePodiumCeremony(results.map((result) => result.racerId), false);
    showScreen('podium');
    renderPodium();
    startPodiumCommentary(createRacePodiumCommentary(results, settings.playerName, campaignScores));
  }
}

function finishCampaignRaceForSmoke(): void {
  if (gameState !== 'race' || !latestSnapshot) return;
  const totalLaps = mode === 'timeAttack' ? 1 : selectedTrack.laps;
  const playerFirst = [...latestSnapshot.racers].sort((a, b) => {
    if (a.definition.id === playerTemplate.id) return -1;
    if (b.definition.id === playerTemplate.id) return 1;
    return b.definition.skill - a.definition.skill;
  });
  playerFirst.forEach((racer, index) => {
    const finishTime = 82 + campaignTrackIndex * 5 + index * 1.55;
    racer.distance = totalLaps;
    racer.progress = 0;
    racer.lap = totalLaps;
    racer.speed = 0;
    racer.finished = true;
    racer.finishTime = finishTime;
    racer.totalTime = finishTime;
    racer.bestLap = finishTime / totalLaps;
    racer.currentLapTime = 0;
    racer.damage = Math.max(0.72, 0.96 - index * 0.025);
    racer.tires = Math.max(0.62, 0.86 - index * 0.026);
  });
  finishRace({
    racers: latestSnapshot.racers,
    player: latestSnapshot.player,
    standings: playerFirst,
    position: playerFirst.findIndex((racer) => racer.definition.id === playerTemplate.id) + 1,
    complete: true,
  });
}

function forceContactForSmoke(): void {
  if (!latestSnapshot || gameState !== 'race') return;
  const rival = latestSnapshot.racers.find((racer) => racer.definition.id !== playerTemplate.id && !racer.finished);
  if (!rival) return;
  const player = latestSnapshot.player;
  player.distance = Math.max(player.distance, 0.18);
  player.progress = (0.985 + player.distance) % 1;
  player.lateral = 0;
  player.speed = Math.max(player.speed, 48);
  player.contactCooldown = 0;
  rival.distance = player.distance + 0.007;
  rival.progress = (0.985 - 0.006 + rival.distance) % 1;
  rival.lateral = 0.55;
  rival.speed = Math.max(34, player.speed - 14);
  rival.contactCooldown = 0;
}

function forcePositionGainForSmoke(): void {
  if (!latestSnapshot || gameState !== 'race') return;
  const playerIndex = latestSnapshot.standings.findIndex((racer) => racer.definition.id === playerTemplate.id);
  const passedRival = playerIndex > 0 ? latestSnapshot.standings[playerIndex - 1] : latestSnapshot.standings[playerIndex + 1];
  if (!passedRival) return;
  lastCommentaryPosition = Math.min(latestSnapshot.standings.length, latestSnapshot.position + 1);
  const player = latestSnapshot.player;
  player.distance = Math.max(player.distance, passedRival.distance + 0.004);
  player.progress = (0.985 + player.distance) % 1;
  player.speed = Math.max(player.speed, passedRival.speed + 2);
  const standings = [...latestSnapshot.racers].sort((a, b) => b.distance - a.distance);
  updateRaceAnnouncements({
    ...latestSnapshot,
    standings,
    position: standings.findIndex((racer) => racer.definition.id === playerTemplate.id) + 1,
  }, true);
}

function forceSideThreatForSmoke(): void {
  if (!latestSnapshot || gameState !== 'race') return;
  const rival = latestSnapshot.racers.find((racer) => racer.definition.id !== playerTemplate.id && !racer.finished);
  if (!rival) return;
  const player = latestSnapshot.player;
  player.distance = Math.max(player.distance, 0.2);
  player.progress = (0.985 + player.distance) % 1;
  player.lateral = -0.2;
  player.speed = Math.max(player.speed, 52);
  rival.distance = player.distance + 0.004;
  rival.progress = (0.985 - 0.006 + rival.distance) % 1;
  rival.lateral = 1.35;
  rival.speed = Math.max(rival.speed, player.speed + 3);
  const standings = [...latestSnapshot.racers].sort((a, b) => b.distance - a.distance);
  updateRaceAnnouncements({
    ...latestSnapshot,
    standings,
    position: standings.findIndex((racer) => racer.definition.id === playerTemplate.id) + 1,
  }, true);
}

function forceAnnouncementConflictForSmoke(): void {
  if (!latestSnapshot || gameState !== 'race') return;
  const rival = latestSnapshot.racers.find((racer) => racer.definition.id !== playerTemplate.id && !racer.finished);
  if (!rival) return;
  const player = latestSnapshot.player;
  lastCommentaryPosition = Math.min(latestSnapshot.standings.length, latestSnapshot.position + 1);
  player.distance = Math.max(player.distance, 0.24);
  player.progress = (0.985 + player.distance) % 1;
  player.lateral = -0.1;
  player.speed = Math.max(player.speed, 54);
  player.contactEvents += 1;
  player.lastContactSeverity = 0.62;
  player.maxContactSeverity = Math.max(player.maxContactSeverity, 0.62);
  player.lastContactRacerId = rival.definition.id;
  rival.distance = player.distance + 0.004;
  rival.progress = (0.985 - 0.006 + rival.distance) % 1;
  rival.lateral = 1.2;
  rival.speed = Math.max(rival.speed, player.speed + 3);
  const standings = [...latestSnapshot.racers].sort((a, b) => b.distance - a.distance);
  updateRaceAnnouncements({
    ...latestSnapshot,
    standings,
    position: standings.findIndex((racer) => racer.definition.id === playerTemplate.id) + 1,
  }, true);
}

function stagePodiumCeremony(racerIds: string[], finaleMode: boolean): void {
  if (!sceneBuild) return;
  if (podiumGroup) {
    scene.remove(podiumGroup);
    disposeObject(podiumGroup);
  }
  const ceremony = createPodiumCeremony(sceneBuild.path, selectedTrack, finaleMode);
  podiumGroup = ceremony.group;
  podiumStats = ceremony.stats;
  podiumFocusId = racerIds[0] ?? null;
  podiumTopThreeIds = racerIds.slice(0, 3);
  podiumStagedCarCount = 0;
  podiumParkedCarCount = 0;
  scene.add(ceremony.group);
  const podiumIds = new Set(podiumTopThreeIds);
  for (const [racerId, car] of sceneBuild.cars) {
    car.visible = podiumIds.has(racerId);
    car.scale.setScalar(0.86);
    if (!car.visible) {
      podiumParkedCarCount += 1;
      const parkPose = sceneBuild.path.poseAt(0.065 + podiumParkedCarCount * 0.006, roadSideParkOffset(podiumParkedCarCount));
      car.position.copy(parkPose.position);
      car.position.y = 0.2;
      car.rotation.y = parkPose.yaw;
    }
  }
  ceremony.slots.forEach((slot) => {
    const racerId = racerIds[slot.rank - 1];
    const car = racerId ? sceneBuild?.cars.get(racerId) : null;
    if (!car) return;
    podiumStagedCarCount += 1;
    car.visible = true;
    car.position.copy(slot.position);
    car.rotation.y = slot.yaw;
    car.scale.setScalar(slot.rank === 1 && finaleMode ? 1.04 : 0.92);
  });
}

function roadSideParkOffset(index: number): number {
  return roadParkingBase + (index % 4) * 1.4;
}

function disposeObject(object: THREE.Object3D): void {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  object.traverse((item) => {
    const mesh = item as THREE.Mesh;
    if ('geometry' in mesh && mesh.geometry && !mesh.geometry.userData.sharedResource && !disposedGeometries.has(mesh.geometry)) {
      disposedGeometries.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) {
      material.forEach((entry) => {
        if (disposedMaterials.has(entry)) return;
        disposedMaterials.add(entry);
        entry.dispose();
      });
    } else if (material && !disposedMaterials.has(material)) {
      disposedMaterials.add(material);
      material.dispose();
    }
  });
}

function showReplayScreen(): void {
  gameState = 'replay';
  showScreen('replay');
  root.querySelector<HTMLParagraphElement>('#replayText')!.textContent = lastReplay
    ? `${lastReplay.trackName} replay: ${lastReplay.frames.length} frames, ${lastReplay.events.length} announcer calls, about ${Math.ceil(lastReplay.estimatedBytes / 1024)} KB.`
    : 'No full replay saved yet. Run a race to create the highlight camera.';
  queueDialogue(dialogue.replay, 3.6);
  if (lastReplay) startReplayPlayback();
}

function startReplayPlayback(): void {
  if (!lastReplay) {
    showReplayScreen();
    return;
  }
  const track = tracks.find((item) => item.id === lastReplay?.trackId) ?? selectedTrack;
  selectedTrack = track;
  sceneBuild = buildTrackedRaceScene(track, buildRacers());
  replayElapsed = 0;
  replayWrappedElapsed = 0;
  replayEventIndex = 0;
  replayNextCaptionAt = 0;
  replayFocusRacerId = 'player';
  lastReplayEvent = null;
  gameState = 'replay';
  showScreen(null);
  hud.classList.remove('active');
  controls.classList.remove('active');
  queueDialogue(dialogue.replay, 3.6);
}

function updateReplayPlayback(dt: number): void {
  if (!lastReplay || !sceneBuild) {
    updateMenuCamera(dt * 1.2, false);
    return;
  }
  replayElapsed += dt;
  updateReplayEvents(lastReplay);
  const frame = findReplayFrame(lastReplay, replayElapsed);
  if (!frame) return;
  for (const racer of frame.racers) {
    const car = sceneBuild.cars.get(racer.id);
    if (!car) continue;
    const pose = sceneBuild.path.poseAt(racer.progress, racer.lateral);
    car.position.copy(pose.position);
    car.position.y = 0.2;
    car.rotation.y = pose.yaw - racer.lateral * 0.015;
    animateDriverIdle(car, performance.now() * 0.001);
  }
  const focus = frame.racers.find((racer) => racer.id === replayFocusRacerId) ?? frame.racers[0];
  const pose = sceneBuild.path.poseAt(focus.progress, focus.lateral);
  const side = pose.normal.clone().multiplyScalar(16 * Math.sin(replayElapsed * 0.6));
  const back = pose.tangent.clone().multiplyScalar(-18);
  camera.position.lerp(pose.position.clone().add(side).add(back).add(new THREE.Vector3(0, 9, 0)), 0.08);
  camera.lookAt(pose.position.x, 1.5, pose.position.z);
}

function updateReplayEvents(replay: RaceReplay): void {
  const wrapped = replay.duration > 0 ? replayElapsed % replay.duration : 0;
  if (wrapped < replayWrappedElapsed) {
    replayEventIndex = 0;
    replayNextCaptionAt = 0;
  }
  replayWrappedElapsed = wrapped;
  const event = replay.events[replayEventIndex];
  if (!event || event.time > wrapped || wrapped < replayNextCaptionAt) return;
  replayEventIndex += 1;
  replayNextCaptionAt = wrapped + Math.min(4.4, Math.max(1.1, replay.duration / Math.max(2, replay.events.length)));
  replayFocusRacerId = event.focusRacerId ?? replayFocusRacerId;
  lastReplayEvent = event;
  showCaption(event.speaker, event.text, 5.5, event.lineId);
}

function currentControl(): RaceControl {
  const keyboardThrottle = keys.has('arrowup') || keys.has('w') || keys.has(' ');
  const keyboardBrake = keys.has('arrowdown') || keys.has('s');
  const keyboardSteer = keys.has('arrowleft') || keys.has('a') ? -1 : keys.has('arrowright') || keys.has('d') ? 1 : 0;
  return {
    throttle: control.throttle || keyboardThrottle,
    brake: control.brake || keyboardBrake,
    steer: keyboardSteer || control.steer,
  };
}

function bindHold(selector: string, onDown: () => void, onUp: () => void): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) return;
  element.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    element.setPointerCapture(event.pointerId);
    onDown();
  });
  element.addEventListener('pointerup', (event) => {
    event.preventDefault();
    onUp();
  });
  element.addEventListener('pointercancel', onUp);
  element.addEventListener('lostpointercapture', onUp);
}

function syncSettingsFromUi(): void {
  settings.controlMode = root.querySelector<HTMLSelectElement>('#controlMode')!.value as GameSettings['controlMode'];
  settings.performanceMode = root.querySelector<HTMLSelectElement>('#performanceMode')!.value as GameSettings['performanceMode'];
  settings.mute = root.querySelector<HTMLInputElement>('#mute')!.checked;
  settings.realisticTires = root.querySelector<HTMLInputElement>('#realisticTires')!.checked;
  settings.realisticDamage = root.querySelector<HTMLInputElement>('#realisticDamage')!.checked;
  settings.leaderboard = root.querySelector<HTMLInputElement>('#leaderboardToggle')!.checked;
  renderer.setPixelRatio(targetPixelRatio());
  updateControlLayout();
  saveSettings();
}

function updateControlLayout(): void {
  controls.dataset.mode = settings.controlMode;
  const holdMode = settings.controlMode === 'holdToGo';
  brakePedal.hidden = holdMode;
  goPedal.textContent = holdMode ? 'Hold Go' : 'Go';
  goPedal.setAttribute('aria-label', holdMode ? 'Hold go, release to brake' : 'Go');
  brakePedal.setAttribute('aria-label', 'Brake');
}

function saveSettings(): void {
  localStorage.setItem('gridline.playerName', settings.playerName);
  localStorage.setItem('gridline.controlMode', settings.controlMode);
  localStorage.setItem('gridline.performanceMode', settings.performanceMode);
  localStorage.setItem('gridline.mute', `${settings.mute}`);
  localStorage.setItem('gridline.realisticTires', `${settings.realisticTires}`);
  localStorage.setItem('gridline.realisticDamage', `${settings.realisticDamage}`);
  localStorage.setItem('gridline.leaderboard', `${settings.leaderboard}`);
  localStorage.setItem('gridline.bodyPaint', settings.bodyPaint);
  localStorage.setItem('gridline.helmetPaint', settings.helmetPaint);
}

function showScreen(screen: GameState | 'settings' | null): void {
  root.querySelectorAll<HTMLElement>('.screen').forEach((element) => element.classList.toggle('active', element.dataset.screen === screen));
  if (screen === 'menu') setSetupPanelOpen(gameState === 'setup');
}

function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(targetPixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);
  leaderboardExpanded = settings.leaderboard && !isMobileViewport();
  invalidateDebugMetrics();
}

function sceneDetailLevel(): SceneDetailLevel {
  if (settings.performanceMode === 'highDetail') return 'full';
  if (settings.performanceMode === 'battery') return 'battery';
  return 'balanced';
}

function targetPixelRatio(): number {
  const mobile = isMobileViewport();
  if (settings.performanceMode === 'highDetail') return Math.min(window.devicePixelRatio, mobile ? 1.2 : 2);
  if (settings.performanceMode === 'battery') return Math.min(window.devicePixelRatio, mobile ? 0.85 : 1.1);
  return Math.min(window.devicePixelRatio, mobile ? 1 : 1.3);
}

function isMobileViewport(): boolean {
  return window.innerWidth <= 640;
}

function exposeDebug(dt = 0): void {
  debugMetricTimer -= dt;
  if (!cachedDebugMetrics || debugMetricTimer <= 0) {
    debugMetricRefreshes += 1;
    cachedDebugMetrics = buildDebugMetrics();
    debugMetricTimer = 0.2;
  }
  const metrics = cachedDebugMetrics;
  const debugText = `calls ${metrics.calls}\ntris ${metrics.triangles}\ngeos ${metrics.geometries}\ntex ${metrics.textures}\nfps ${metrics.estimatedFps}\nreplay ${metrics.replayFrames}`;
  if (debug.textContent !== debugText) debug.textContent = debugText;
  debug.classList.toggle('active', debugOverlayEnabled());
  (window as any).__GRIDLINE_APEX__ = {
    ready: true,
    state: gameState,
    metrics,
    settings,
    results,
    campaignScores,
    replay: lastReplay,
    debug: {
      forcePodium: forcePodiumForSmoke,
      forceContact: forceContactForSmoke,
      forcePositionGain: forcePositionGainForSmoke,
      forceSideThreat: forceSideThreatForSmoke,
      forceAnnouncementConflict: forceAnnouncementConflictForSmoke,
      forceRaceFinish: finishCampaignRaceForSmoke,
      finishCampaignRace: finishCampaignRaceForSmoke,
    },
  };
}

function invalidateDebugMetrics(): void {
  cachedDebugMetrics = null;
  debugMetricTimer = 0;
}

function buildDebugMetrics() {
  const sortedFrameTimes = [...frameTimes].sort((a, b) => a - b);
  const p50 = percentile(sortedFrameTimes, 0.5);
  const p95 = percentile(sortedFrameTimes, 0.95);
  const worst = sortedFrameTimes[sortedFrameTimes.length - 1] ?? 0;
  const fps = p50 > 0 ? 1 / p50 : 0;
  const cpuRacecraft = summarizeCpuRacecraft(latestSnapshot);
  const titleLetterSpacing = getComputedStyle(brandTitle).letterSpacing;
  return {
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    points: renderer.info.render.points,
    lines: renderer.info.render.lines,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    materials: countSceneMaterials(),
    p50FrameMs: Math.round(p50 * 1000 * 10) / 10,
    p95FrameMs: Math.round(p95 * 1000 * 10) / 10,
    worstFrameMs: Math.round(worst * 1000 * 10) / 10,
    estimatedFps: Math.round(fps),
    pixelRatio: renderer.getPixelRatio(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    performanceMode: settings.performanceMode,
    sceneLifecycle: {
      builds: sceneBuildCount,
      cars: sceneBuild?.cars.size ?? 0,
      hasScene: Boolean(sceneBuild),
      resources: sceneBuild?.resourceStats ?? null,
    },
    performanceWork: {
      hudDomWrites,
      leaderboardRenders: leaderboardRenderCount,
      trackMapDomWrites,
      debugMetricRefreshes,
      debugMetricCadenceMs: 200,
      generatedAssetWarmup: {
        scheduled: generatedAssetWarmupScheduled,
        started: generatedAssetWarmupStarted,
        completed: generatedAssetWarmupCompleted,
        pending: generatedAssetWarmupPending,
        method: generatedAssetWarmupMethod,
        blockedState: generatedAssetWarmupBlockedState,
        deferrals: generatedAssetWarmupDeferrals,
        delayMs:
          generatedAssetWarmupScheduled && generatedAssetWarmupStarted
            ? Math.max(0, Math.round(generatedAssetWarmupStartedAt - generatedAssetWarmupScheduledAt))
            : null,
      },
    },
    state: gameState,
    menu: {
      setupOpen: !setupPanel.hidden,
      visibleActionCount: [...root.querySelectorAll<HTMLElement>('[data-screen="menu"] .menu-top button, [data-screen="menu"] .menu-top a')].filter(
        (item) => item.offsetParent !== null,
      ).length,
      titleTreatment: {
        id: brandTitle.dataset.titleTreatment ?? null,
        lineCount: brandTitle.querySelectorAll('.brand-line').length,
        letterSpacing: titleLetterSpacing === 'normal' ? '0px' : titleLetterSpacing,
        computedLetterSpacing: titleLetterSpacing,
        width: Math.round(brandTitle.getBoundingClientRect().width),
      },
      flyoverLabel: {
        trackId: menuFlyoverTrack.dataset.trackId ?? null,
        text: menuFlyoverTrack.textContent,
        visible: menuFlyoverTrack.offsetParent !== null,
      },
    },
    track: selectedTrack.id,
    previewTrack: menuPreviewTrack.id,
    replayFrames: lastReplay?.frames.length ?? 0,
    liveReplayFrames: replayRecorder?.frameCount() ?? 0,
    replayIncidents: lastReplay?.incidentCount ?? 0,
    liveReplayIncidents: replayRecorder?.incidentCount() ?? 0,
    replayEvents: lastReplay?.events.length ?? 0,
    replayEventIndex,
    replayFocusRacerId,
    replayBytes: lastReplay?.estimatedBytes ?? 0,
    replayDroppedSamples: lastReplay?.droppedSamples ?? 0,
    replaySampleRate: lastReplay?.sampleRate ?? 0,
    replayPlayback: {
      active: gameState === 'replay' && Boolean(lastReplay),
      elapsed: Math.round(replayElapsed * 10) / 10,
      wrappedElapsed: Math.round(replayWrappedElapsed * 10) / 10,
      duration: lastReplay?.duration ?? 0,
      eventIndex: replayEventIndex,
      eventCount: lastReplay?.events.length ?? 0,
      focusRacerId: replayFocusRacerId,
      frameCount: lastReplay?.frames.length ?? 0,
      lastEvent: lastReplayEvent
        ? {
            kind: lastReplayEvent.kind,
            lineId: lastReplayEvent.lineId,
            speaker: lastReplayEvent.speaker,
            focusRacerId: lastReplayEvent.focusRacerId ?? null,
            radioKey: lastReplayEvent.radioKey,
            sourceKind: lastReplayEvent.sourceKind,
            sourceTime: lastReplayEvent.sourceTime,
          }
        : null,
    },
    lightsOn,
    caption: {
      speaker: lastCaptionSpeaker,
      text: lastCaptionText,
      active: caption.classList.contains('active'),
    },
    captionSequence: {
      pending: captionQueue.length,
      delivered: captionQueueDelivered,
      speakers: captionQueueSpeakers,
    },
    preRaceCommentary: {
      trackId: preRaceCommentaryTrackId,
      lineIds: preRaceCommentaryLineIds,
    },
    raceReadability: {
      trackMapActive: Boolean(trackMapLayout),
      trackMapDots: trackMapDotCount,
      nearestAheadMeters,
      nearestBehindMeters,
      closingAhead: readoutClosingAhead,
      closingBehind: readoutClosingBehind,
      sideBySide: readoutSideBySide,
      nextBrakeMeters,
      brakeUrgency,
    },
    leaderboard: {
      enabled: settings.leaderboard,
      open: leaderboard.classList.contains('active'),
      mobileCollapsed: isMobileViewport() && settings.leaderboard && !leaderboard.classList.contains('active'),
      rowCount: leaderboardList.children.length,
      playerPosition: latestSnapshot?.position ?? null,
      renders: leaderboardRenderCount,
    },
    controlLayout: {
      mode: settings.controlMode,
      brakeVisible: !brakePedal.hidden,
      visiblePedals: [...controls.querySelectorAll<HTMLButtonElement>('.pedal')].filter((pedal) => !pedal.hidden).length,
      goLabel: goPedal.textContent,
      goAriaLabel: goPedal.getAttribute('aria-label'),
    },
    playerHandling: latestSnapshot?.player.handling ?? null,
    cpuRacecraft,
    contact: {
      playerEvents: latestSnapshot?.player.contactEvents ?? 0,
      playerLastSeverity: latestSnapshot?.player.lastContactSeverity ?? 0,
      playerMaxSeverity: latestSnapshot?.player.maxContactSeverity ?? 0,
      playerLastRacerId: latestSnapshot?.player.lastContactRacerId ?? null,
      totalEvents: latestSnapshot ? latestSnapshot.racers.reduce((total, racer) => total + racer.contactEvents, 0) : 0,
      maxSeverity: latestSnapshot ? Math.max(0, ...latestSnapshot.racers.map((racer) => racer.maxContactSeverity)) : 0,
    },
    raceCommentary: {
      callouts: raceCommentaryCallouts,
      spotterCallouts,
      suppressedByCooldown: raceCommentarySuppressedByCooldown,
      suppressedByDedupe: raceCommentarySuppressedByDedupe,
      lastKind: lastRaceCommentaryKind,
      lastLineId: lastRaceCommentaryLineId,
      lastPriority: lastRaceCommentaryPriority,
      lastSpeaker: lastRaceCommentarySpeaker,
      lastFocusRacerId: lastRaceCommentaryFocusRacerId,
      deliveredRadioKeys: [...deliveredRadioKeys],
      cooldownRemaining: Math.max(0, Math.round((4.4 - (raceCommentaryElapsed - lastRaceCommentaryAt)) * 10) / 10),
    },
    campaignLeader: campaignLeader(campaignScores)?.name ?? null,
    campaign: {
      mode,
      trackIndex: campaignTrackIndex,
      trackCount: tracks.length,
      scores: campaignScores,
      objective: currentCampaignObjective
        ? {
            raceNumber: currentCampaignObjective.raceNumber,
            totalRaces: currentCampaignObjective.totalRaces,
            trackId: currentCampaignObjective.trackId,
            targetPosition: currentCampaignObjective.targetPosition,
            rivalRacerId: currentCampaignObjective.rivalRacerId,
            rivalName: currentCampaignObjective.rivalName,
            summary: currentCampaignObjective.summary,
            visible: !campaignObjective.hidden,
          }
        : null,
      objectiveOutcome: lastCampaignObjectiveOutcome
        ? {
            achieved: lastCampaignObjectiveOutcome.achieved,
            playerPosition: lastCampaignObjectiveOutcome.playerPosition,
            rivalPosition: lastCampaignObjectiveOutcome.rivalPosition,
            summary: lastCampaignObjectiveOutcome.summary,
          }
        : null,
      nextAction:
        mode === 'campaign' && gameState === 'podium'
          ? campaignTrackIndex < tracks.length - 1
            ? 'next-race'
            : 'finale'
          : null,
    },
    sceneDetails: sceneBuild?.detailStats ?? null,
    podium: {
      active: Boolean(podiumGroup),
      focusRacerId: podiumFocusId,
      topThreeRacerIds: podiumTopThreeIds,
      stagedCarCount: podiumStagedCarCount,
      parkedCarCount: podiumParkedCarCount,
      stats: podiumStats,
    },
    podiumCommentary: {
      eventCount: podiumCommentaryEvents.length,
      nextIndex: podiumCommentaryIndex,
      lastKind: lastPodiumCommentaryKind,
      lastLineId: lastPodiumCommentaryLineId,
      lastSpeaker: lastPodiumCommentarySpeaker,
      lastFocusRacerId: lastPodiumCommentaryFocusRacerId,
    },
    driverRig: summarizeSceneDriverRigs(),
    audio: audio.metrics(),
    assetKit: formulaAssetManifest,
    assetStatus: formulaAssets.metrics(),
  };
}

function countSceneMaterials(): number {
  const materials = new Set<THREE.Material>();
  scene.traverse((object) => {
    const material = (object as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((entry) => materials.add(entry));
    else if (material) materials.add(material);
  });
  return materials.size;
}

function debugOverlayEnabled(): boolean {
  return new URLSearchParams(window.location.search).has('debug') || localStorage.getItem('gridline.debug') === 'true';
}

function summarizeSceneDriverRigs(): {
  activeCars: number;
  visibleCars: number;
  carMeshCount: number;
  customizableDrivers: number;
  torsos: number;
  helmets: number;
  visors: number;
  armPairs: number;
  generatedSuits: number;
  podiumCelebratingRacerId: string | null;
  podiumCelebrationMode: 'idle' | 'podium' | 'finale';
  podiumCelebrationEnergy: number;
} {
  const cars = sceneBuild ? [...sceneBuild.cars.values()] : [];
  const summaries = cars.map((car) => summarizeDriverRig(car));
  const celebratingCar = gameState === 'podium' || gameState === 'finale' ? sceneBuild?.cars.get(podiumFocusId ?? '') : null;
  const celebratingSummary = celebratingCar ? summarizeDriverRig(celebratingCar) : null;
  const carMeshCount = cars.reduce((total, car) => {
    let meshes = 0;
    car.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) meshes += 1;
    });
    return total + meshes;
  }, 0);
  return {
    activeCars: cars.length,
    visibleCars: cars.filter((car) => car.visible).length,
    carMeshCount,
    customizableDrivers: summaries.filter((summary) => summary.hasDriver).length,
    torsos: summaries.filter((summary) => summary.hasTorso).length,
    helmets: summaries.filter((summary) => summary.hasHelmet).length,
    visors: summaries.filter((summary) => summary.hasVisor).length,
    armPairs: summaries.filter((summary) => summary.armCount >= 2).length,
    generatedSuits: summaries.filter((summary) => summary.hasGeneratedSuit).length,
    podiumCelebratingRacerId: gameState === 'podium' || gameState === 'finale' ? podiumFocusId : null,
    podiumCelebrationMode: celebratingSummary?.celebrationMode ?? 'idle',
    podiumCelebrationEnergy: celebratingSummary?.celebrationEnergy ?? 0,
  };
}

function summarizeCpuRacecraft(snapshot: RaceSnapshot | null): {
  brakingCount: number;
  overtakeCount: number;
  maxCornerLoad: number;
  trafficGapMeters: number | null;
  targetSpeedMax: number;
} {
  if (!snapshot) {
    return { brakingCount: 0, overtakeCount: 0, maxCornerLoad: 0, trafficGapMeters: null, targetSpeedMax: 0 };
  }
  const cpus = snapshot.racers.filter((racer) => racer.definition.id !== playerTemplate.id);
  const gaps = cpus.map((racer) => racer.racecraft.trafficGapMeters).filter((gap): gap is number => gap !== null);
  return {
    brakingCount: cpus.filter((racer) => racer.racecraft.braking).length,
    overtakeCount: cpus.filter((racer) => racer.racecraft.overtakeLane !== 0).length,
    maxCornerLoad: Math.round(Math.max(0, ...cpus.map((racer) => racer.racecraft.cornerLoad)) * 1000) / 1000,
    trafficGapMeters: gaps.length ? Math.min(...gaps) : null,
    targetSpeedMax: Math.round(Math.max(0, ...cpus.map((racer) => racer.racecraft.targetSpeed))),
  };
}

function renderSwatches(target: 'bodyPaint' | 'helmetPaint', options: typeof bodyPaintOptions, selected: string): string {
  return options
    .map(
      (option) =>
        `<button class="swatch ${option.id === selected ? 'selected' : ''}" data-paint-target="${target}" data-paint-id="${option.id}" title="${option.label}" aria-label="${option.label}" style="--swatch:${option.css}"></button>`,
    )
    .join('');
}

function recordFrameTime(dt: number): void {
  frameTimes.push(dt);
  frameTimeWindow += dt;
  while (frameTimeWindow > 5 && frameTimes.length > 1) {
    frameTimeWindow -= frameTimes.shift() ?? 0;
  }
}

function percentile(sortedValues: number[], fraction: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.floor((sortedValues.length - 1) * fraction)));
  return sortedValues[index];
}

function resetFrameStats(): void {
  frameTimes.length = 0;
  frameTimeWindow = 0;
}

function fill(text: string): string {
  return text.replaceAll('{player}', settings.playerName).replaceAll('{track}', selectedTrack.name);
}

function createSceneCar(racer: RacerDefinition): THREE.Group {
  return formulaAssets.createCar(racer.color, racer.helmet, settings.performanceMode === 'highDetail' && racer.id === playerTemplate.id);
}

function formatTime(value: number): string {
  if (!Number.isFinite(value)) return '--';
  const minutes = Math.floor(value / 60);
  const seconds = (value % 60).toFixed(2).padStart(5, '0');
  return `${minutes}:${seconds}`;
}

function formatMeters(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}km`;
  return `${Math.max(1, value)}m`;
}

function visibleRacerLap(racer: RaceSnapshot['player']): number {
  const totalLaps = mode === 'timeAttack' ? 1 : selectedTrack.laps;
  return racer.finished ? totalLaps : Math.min(totalLaps, racer.lap + 1);
}
