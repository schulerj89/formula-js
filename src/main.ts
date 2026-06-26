import './styles.css';
import * as THREE from 'three';
import { musicThemes } from './data/audio';
import { formulaAssetManifest } from './data/assets';
import { bodyPaintOptions, findPaint, helmetPaintOptions } from './data/customization';
import { dialogue } from './data/dialogue';
import { cpuRacers, playerTemplate } from './data/racers';
import { tracks } from './data/tracks';
import { RaceAudio } from './game/audio';
import { applyCampaignResults, campaignLeader, createCampaignScores, type CampaignScore } from './game/campaign';
import { animateDriverIdle } from './game/models';
import { createRace, createResults, type RaceControl, type RaceSnapshot } from './game/race';
import { createReplayRecorder, findReplayFrame, type RaceReplay, type ReplayRecorder } from './game/replay';
import { buildRaceScene, type SceneBuild } from './game/scene';
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
let lightTimer = 0;
let lastRadio = '';
let campaignTrackIndex = 0;
let uiBound = false;
let replayRecorder: ReplayRecorder | null = null;
let lastReplay: RaceReplay | null = null;
let replayElapsed = 0;
let menuFlyoverIndex = 0;
let menuFlyoverTimer = 0;
let menuPreviewTrack = selectedTrack;
const frameTimes: number[] = [];
let frameTimeWindow = 0;

const control: RaceControl = { throttle: false, brake: false, steer: 0 };
const keys = new Set<string>();

root.innerHTML = `
  <div class="game-shell">
    <canvas class="game-canvas" aria-label="Gridline Apex race view"></canvas>

    <section class="screen active" data-screen="menu">
      <div class="menu-top">
        <p class="kicker">Mobile formula racing</p>
        <h1>Gridline Apex</h1>
        <div class="menu-actions">
          <button class="primary" data-action="campaign">Campaign</button>
          <button class="secondary" data-action="timeAttack">Time Attack</button>
          <button class="secondary" data-action="settings">Settings</button>
          <button class="secondary" data-action="replay">Replay</button>
        </div>
      </div>
      <div class="panel">
        <h2>Driver Setup</h2>
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
      <aside class="leaderboard" id="leaderboard"><ol></ol></aside>
    </div>

    <div class="caption" id="caption"></div>

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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.performanceMode === 'highDetail' ? 2 : 1.45));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
const clock = new THREE.Clock();
const audio = new RaceAudio(settings);

const playerNameInput = root.querySelector<HTMLInputElement>('#playerName')!;
const trackSelect = root.querySelector<HTMLSelectElement>('#trackSelect')!;
const trackStrip = root.querySelector<HTMLDivElement>('#trackStrip')!;
const bodyPaintSwatches = root.querySelector<HTMLDivElement>('#bodyPaintSwatches')!;
const helmetPaintSwatches = root.querySelector<HTMLDivElement>('#helmetPaintSwatches')!;
const caption = root.querySelector<HTMLDivElement>('#caption')!;
const controls = root.querySelector<HTMLDivElement>('#controls')!;
const hud = root.querySelector<HTMLDivElement>('.hud')!;
const leaderboard = root.querySelector<HTMLElement>('#leaderboard')!;
const debug = root.querySelector<HTMLElement>('#debug')!;

initUi();
loadMenuScene();
showCaption('Arthur Bell', fill(dialogue.title[0][1]));

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
    } else if (action === 'settings') {
      showScreen('settings');
    } else if (action === 'back' || action === 'menu') {
      gameState = 'menu';
      audio.stopEngine();
      showScreen('menu');
      loadMenuScene();
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
        gameState = 'menu';
        showScreen('menu');
        loadMenuScene();
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
    if (lightTimer <= 0) startRace();
    updateMenuCamera(dt * 0.7, false);
  } else if (gameState === 'race') {
    const activeControl = currentControl();
    latestSnapshot = race?.update(dt, activeControl) ?? null;
    if (latestSnapshot) {
      updateCars(latestSnapshot);
      updateRaceCamera(latestSnapshot);
      updateHud(latestSnapshot);
      updateRadio(latestSnapshot);
      replayRecorder?.record(dt, latestSnapshot);
      audio.setEngine(latestSnapshot.player.speed);
      if (latestSnapshot.complete) finishRace(latestSnapshot);
    }
  } else if (gameState === 'podium') {
    audio.playMusic(musicThemes.podium, dt);
    updatePodiumCamera(dt, false);
  } else if (gameState === 'replay') {
    updateReplayPlayback(dt);
  } else if (gameState === 'finale') {
    audio.playMusic(musicThemes.finale, dt);
    updatePodiumCamera(dt, true);
  }

  captionTimer -= dt;
  if (captionTimer <= 0 && (gameState === 'menu' || gameState === 'race')) rotateCaption();
  exposeDebug();
}

function showSetup(): void {
  selectedTrack = mode === 'campaign' ? tracks[campaignTrackIndex] : selectedTrack;
  trackSelect.value = selectedTrack.id;
  initUi();
  gameState = 'setup';
  showScreen('menu');
}

function startPreRace(): void {
  settings.playerName = playerNameInput.value.trim() || 'Rookie';
  saveSettings();
  gameState = 'prerace';
  showScreen(null);
  hud.classList.remove('active');
  controls.classList.remove('active');
  sceneBuild = buildRaceScene(scene, selectedTrack, buildRacers());
  race = createRace(mode, selectedTrack, buildRacers(), settings);
  replayRecorder = createReplayRecorder(selectedTrack.id, selectedTrack.name, settings.playerName);
  latestSnapshot = race.snapshot();
  replayRecorder.record(0, latestSnapshot);
  lightTimer = 2.8;
  audio.beep(5);
  showCaption('Arthur Bell', fill(dialogue.prerace[0][1]));
}

function startRace(): void {
  gameState = 'race';
  resetFrameStats();
  audio.stopMusic();
  hud.classList.add('active');
  controls.classList.add('active');
  control.brake = false;
  control.throttle = false;
  control.steer = 0;
  showCaption('Mags Whitlow', fill(dialogue.lights[1][1]));
}

function finishRace(snapshot: RaceSnapshot): void {
  results = createResults(snapshot);
  lastReplay = replayRecorder?.finalize(results) ?? lastReplay;
  replayRecorder = null;
  if (mode === 'campaign') {
    campaignScores = applyCampaignResults(campaignScores.length ? campaignScores : createCampaignScores(buildRacers()), results);
  }
  gameState = 'podium';
  audio.stopEngine();
  controls.classList.remove('active');
  hud.classList.remove('active');
  showScreen('podium');
  renderPodium();
  showCaption('Arthur Bell', fill(dialogue.podium[0][1]));
}

function buildRacers(): RacerDefinition[] {
  const bodyPaint = findPaint(bodyPaintOptions, settings.bodyPaint, bodyPaintOptions[0]);
  const helmetPaint = findPaint(helmetPaintOptions, settings.helmetPaint, helmetPaintOptions[0]);
  return [{ ...playerTemplate, name: settings.playerName, color: bodyPaint.value, helmet: helmetPaint.value }, ...cpuRacers];
}

function loadMenuScene(): void {
  menuPreviewTrack = selectedTrack;
  menuFlyoverIndex = tracks.findIndex((track) => track.id === selectedTrack.id);
  menuFlyoverTimer = 7;
  sceneBuild = buildRaceScene(scene, menuPreviewTrack, buildRacers());
  race = null;
  latestSnapshot = null;
  hud.classList.remove('active');
  controls.classList.remove('active');
}

function updateMenuCamera(dt: number, cycleTracks: boolean): void {
  if (!sceneBuild) return;
  captionTimer -= dt;
  if (cycleTracks) {
    menuFlyoverTimer -= dt;
    if (menuFlyoverTimer <= 0) {
      menuFlyoverIndex = (menuFlyoverIndex + 1) % tracks.length;
      menuPreviewTrack = tracks[menuFlyoverIndex];
      sceneBuild = buildRaceScene(scene, menuPreviewTrack, buildRacers());
      menuFlyoverTimer = 7;
      showCaption('Arthur Bell', `Track preview: ${menuPreviewTrack.name}.`);
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
  if (!sceneBuild || !results[0]) return;
  const targetId = finale ? campaignLeader(campaignScores)?.racerId ?? results[0].racerId : results[0].racerId;
  const winner = sceneBuild.cars.get(targetId);
  const elapsed = performance.now() * 0.001;
  const radius = finale ? 18 : 12;
  const target = winner?.position ?? new THREE.Vector3();
  camera.position.set(target.x + Math.cos(elapsed * 0.45) * radius, finale ? 10 : 7, target.z + Math.sin(elapsed * 0.45) * radius);
  camera.lookAt(target.x, 1.5, target.z);
  if (winner) animateDriverIdle(winner, elapsed, true, finale);
  for (const car of sceneBuild.cars.values()) animateDriverIdle(car, elapsed, car === winner, finale);
  void dt;
}

function updateCars(snapshot: RaceSnapshot): void {
  if (!sceneBuild) return;
  for (const state of snapshot.racers) {
    const car = sceneBuild.cars.get(state.definition.id);
    if (!car) continue;
    const pose = sceneBuild.path.poseAt(state.progress, state.lateral);
    car.position.copy(pose.position);
    car.position.y = 0.2;
    car.rotation.y = pose.yaw - state.lateral * 0.015;
    animateDriverIdle(car, performance.now() * 0.001);
    const wheelSpin = state.speed * performance.now() * 0.0006;
    car.children.filter((child) => child.name === 'separate-wheel').forEach((wheel) => {
      wheel.rotation.x = wheelSpin;
    });
  }
}

function updateHud(snapshot: RaceSnapshot): void {
  root.querySelector('#place')!.textContent = `${snapshot.position}/8`;
  root.querySelector('#lap')!.textContent = `${Math.min(selectedTrack.laps, snapshot.player.lap + 1)}/${mode === 'timeAttack' ? 1 : selectedTrack.laps}`;
  root.querySelector('#speed')!.textContent = `${Math.round(snapshot.player.speed * 3.6)}`;
  root.querySelector<HTMLElement>('#damageBar')!.style.transform = `scaleX(${snapshot.player.damage})`;
  root.querySelector<HTMLElement>('#tireBar')!.style.transform = `scaleX(${snapshot.player.tires})`;
  leaderboard.classList.toggle('active', settings.leaderboard);
  const list = leaderboard.querySelector('ol')!;
  list.innerHTML = snapshot.standings.map((racer) => `<li>${racer.definition.shortName} / L${racer.lap + 1}</li>`).join('');
}

function updateRadio(snapshot: RaceSnapshot): void {
  const warnings: Array<[string, string]> = [
    ['damage', snapshot.player.damage < 0.45 ? 'Radio' : ''],
    ['tires', snapshot.player.tires < 0.38 ? 'Radio' : ''],
  ];
  const damageWarning = warnings[0][1] && lastRadio !== 'damage';
  const tireWarning = warnings[1][1] && lastRadio !== 'tires';
  if (damageWarning) {
    lastRadio = 'damage';
    showCaption('Radio', 'Damage is climbing. Stay off the outside kerbs and bring it home.');
  } else if (tireWarning) {
    lastRadio = 'tires';
    showCaption('Radio', 'Tyres are fading. Brake earlier and keep the steering smooth.');
  }
}

function rotateCaption(): void {
  const bank = gameState === 'race' ? dialogue.race : dialogue.title;
  const line = bank[captionIndex % bank.length];
  captionIndex += 1;
  showCaption(line[0], fill(line[1]));
}

function showCaption(name: string, text: string): void {
  caption.innerHTML = `<strong>${name}</strong> ${text}`;
  caption.classList.add('active');
  captionTimer = 5.5;
  audio.speak(name, text);
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

function showCampaignFinale(): void {
  const champion = campaignLeader(campaignScores);
  gameState = 'finale';
  showScreen('podium');
  root.querySelector<HTMLHeadingElement>('#podiumTitle')!.textContent = 'Campaign Champions';
  root.querySelector<HTMLDivElement>('#podiumResults')!.innerHTML = campaignScores
    .slice(0, 3)
    .map((score, index) => `<p><strong>${index + 1}. ${score.name}</strong> / ${score.points} pts / ${score.wins} wins</p>`)
    .join('');
  renderCampaignStandings();
  root.querySelector<HTMLButtonElement>('#nextRaceButton')!.textContent = 'Done';
  showCaption('Mags Whitlow', fill(dialogue.finale[1][1]));
  if (champion) showCaption('Arthur Bell', `${champion.name} is champion after ${tracks.length} races.`);
}

function showReplayScreen(): void {
  gameState = 'replay';
  showScreen('replay');
  root.querySelector<HTMLParagraphElement>('#replayText')!.textContent = lastReplay
    ? `${lastReplay.trackName} replay: ${lastReplay.frames.length} frames, about ${Math.ceil(lastReplay.estimatedBytes / 1024)} KB.`
    : 'No full replay saved yet. Run a race to create the highlight camera.';
  showCaption('Arthur Bell', fill(dialogue.replay[0][1]));
  if (lastReplay) startReplayPlayback();
}

function startReplayPlayback(): void {
  if (!lastReplay) {
    showReplayScreen();
    return;
  }
  const track = tracks.find((item) => item.id === lastReplay?.trackId) ?? selectedTrack;
  selectedTrack = track;
  sceneBuild = buildRaceScene(scene, track, buildRacers());
  replayElapsed = 0;
  gameState = 'replay';
  showScreen(null);
  hud.classList.remove('active');
  controls.classList.remove('active');
  showCaption('Arthur Bell', fill(dialogue.replay[0][1]));
}

function updateReplayPlayback(dt: number): void {
  if (!lastReplay || !sceneBuild) {
    updateMenuCamera(dt * 1.2, false);
    return;
  }
  replayElapsed += dt;
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
  const focus = frame.racers[0];
  const pose = sceneBuild.path.poseAt(focus.progress, focus.lateral);
  const side = pose.normal.clone().multiplyScalar(16 * Math.sin(replayElapsed * 0.6));
  const back = pose.tangent.clone().multiplyScalar(-18);
  camera.position.lerp(pose.position.clone().add(side).add(back).add(new THREE.Vector3(0, 9, 0)), 0.08);
  camera.lookAt(pose.position.x, 1.5, pose.position.z);
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.performanceMode === 'highDetail' ? 2 : 1.45));
  saveSettings();
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
}

function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function exposeDebug(): void {
  const sortedFrameTimes = [...frameTimes].sort((a, b) => a - b);
  const p50 = percentile(sortedFrameTimes, 0.5);
  const p95 = percentile(sortedFrameTimes, 0.95);
  const worst = sortedFrameTimes[sortedFrameTimes.length - 1] ?? 0;
  const fps = p50 > 0 ? 1 / p50 : 0;
  const metrics = {
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    points: renderer.info.render.points,
    lines: renderer.info.render.lines,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    p50FrameMs: Math.round(p50 * 1000 * 10) / 10,
    p95FrameMs: Math.round(p95 * 1000 * 10) / 10,
    worstFrameMs: Math.round(worst * 1000 * 10) / 10,
    estimatedFps: Math.round(fps),
    pixelRatio: renderer.getPixelRatio(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    performanceMode: settings.performanceMode,
    state: gameState,
    track: selectedTrack.id,
    previewTrack: menuPreviewTrack.id,
    replayFrames: lastReplay?.frames.length ?? 0,
    replayBytes: lastReplay?.estimatedBytes ?? 0,
    replayDroppedSamples: lastReplay?.droppedSamples ?? 0,
    replaySampleRate: lastReplay?.sampleRate ?? 0,
    campaignLeader: campaignLeader(campaignScores)?.name ?? null,
    audio: audio.metrics(),
    assetKit: formulaAssetManifest,
  };
  debug.textContent = `calls ${metrics.calls}\ntris ${metrics.triangles}\ngeos ${metrics.geometries}\ntex ${metrics.textures}\nfps ${metrics.estimatedFps}\nreplay ${metrics.replayFrames}`;
  debug.classList.toggle('active', settings.performanceMode === 'highDetail');
  (window as any).__GRIDLINE_APEX__ = {
    ready: true,
    state: gameState,
    metrics,
    settings,
    results,
    campaignScores,
    replay: lastReplay,
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

function formatTime(value: number): string {
  if (!Number.isFinite(value)) return '--';
  const minutes = Math.floor(value / 60);
  const seconds = (value % 60).toFixed(2).padStart(5, '0');
  return `${minutes}:${seconds}`;
}
