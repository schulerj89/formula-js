import './styles.css';
import * as THREE from 'three';
import { dialogue } from './data/dialogue';
import { cpuRacers, playerTemplate } from './data/racers';
import { tracks } from './data/tracks';
import { RaceAudio } from './game/audio';
import { animateDriverIdle } from './game/models';
import { createRace, createResults, type RaceControl, type RaceSnapshot } from './game/race';
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
};

let gameState: GameState = 'menu';
let mode: GameMode = 'campaign';
let selectedTrack = tracks[0];
let sceneBuild: SceneBuild | null = null;
let race: ReturnType<typeof createRace> | null = null;
let latestSnapshot: RaceSnapshot | null = null;
let results: RaceResult[] = [];
let captionTimer = 0;
let captionIndex = 0;
let lightTimer = 0;
let lastRadio = '';
let campaignTrackIndex = 0;
let uiBound = false;

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
        <h2>Podium</h2>
        <div id="podiumResults"></div>
        <div class="race-actions">
          <button class="primary" data-action="nextRace">Next Race</button>
          <button class="secondary" data-action="menu">Menu</button>
        </div>
      </div>
    </section>

    <section class="screen" data-screen="replay">
      <div class="panel">
        <h2>Race Replay</h2>
        <p id="replayText">No full replay saved yet. Run a race to create the highlight camera.</p>
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
    if (!action) return;
    audio.resume();
    if (action === 'campaign') {
      mode = 'campaign';
      campaignTrackIndex = 0;
      selectedTrack = tracks[0];
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
      } else {
        gameState = 'replay';
        showScreen('replay');
        showCaption('Mags Whitlow', fill(dialogue.finale[1][1]));
      }
    } else if (action === 'replay') {
      gameState = 'replay';
      showScreen('replay');
      showCaption('Arthur Bell', fill(dialogue.replay[0][1]));
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
  if (gameState === 'menu') {
    updateMenuCamera(dt);
    audio.menuMusic(dt);
  } else if (gameState === 'prerace') {
    lightTimer -= dt;
    if (lightTimer <= 0) startRace();
    updateMenuCamera(dt * 0.7);
  } else if (gameState === 'race') {
    updateInputFromKeyboard();
    latestSnapshot = race?.update(dt, control) ?? null;
    if (latestSnapshot) {
      updateCars(latestSnapshot);
      updateRaceCamera(latestSnapshot);
      updateHud(latestSnapshot);
      updateRadio(latestSnapshot);
      audio.setEngine(latestSnapshot.player.speed);
      if (latestSnapshot.complete) finishRace(latestSnapshot);
    }
  } else if (gameState === 'podium') {
    updatePodiumCamera(dt);
  } else if (gameState === 'replay') {
    updateMenuCamera(dt * 1.2);
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
  latestSnapshot = race.snapshot();
  lightTimer = 2.8;
  audio.beep(5);
  showCaption('Arthur Bell', fill(dialogue.prerace[0][1]));
}

function startRace(): void {
  gameState = 'race';
  hud.classList.add('active');
  controls.classList.add('active');
  control.brake = false;
  showCaption('Mags Whitlow', fill(dialogue.lights[1][1]));
}

function finishRace(snapshot: RaceSnapshot): void {
  results = createResults(snapshot);
  gameState = 'podium';
  audio.stopEngine();
  controls.classList.remove('active');
  hud.classList.remove('active');
  showScreen('podium');
  renderPodium();
  showCaption('Arthur Bell', fill(dialogue.podium[0][1]));
}

function buildRacers(): RacerDefinition[] {
  return [{ ...playerTemplate, name: settings.playerName }, ...cpuRacers];
}

function loadMenuScene(): void {
  sceneBuild = buildRaceScene(scene, selectedTrack, buildRacers());
  race = null;
  latestSnapshot = null;
  hud.classList.remove('active');
  controls.classList.remove('active');
}

function updateMenuCamera(dt: number): void {
  if (!sceneBuild) return;
  captionTimer -= dt;
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

function updatePodiumCamera(dt: number): void {
  if (!sceneBuild || !results[0]) return;
  const winner = sceneBuild.cars.get(results[0].racerId);
  const elapsed = performance.now() * 0.001;
  const radius = 12;
  const target = winner?.position ?? new THREE.Vector3();
  camera.position.set(target.x + Math.cos(elapsed * 0.45) * radius, 7, target.z + Math.sin(elapsed * 0.45) * radius);
  camera.lookAt(target.x, 1.5, target.z);
  if (winner) animateDriverIdle(winner, elapsed, true);
  for (const car of sceneBuild.cars.values()) animateDriverIdle(car, elapsed, car === winner);
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
}

function renderPodium(): void {
  const podium = root.querySelector<HTMLDivElement>('#podiumResults')!;
  podium.innerHTML = results
    .slice(0, 3)
    .map((result, index) => `<p><strong>${index + 1}. ${result.name}</strong> / ${formatTime(result.totalTime)} / Best ${formatTime(result.bestLap)}</p>`)
    .join('');
}

function updateInputFromKeyboard(): void {
  if (keys.has('arrowleft') || keys.has('a')) control.steer = -1;
  else if (keys.has('arrowright') || keys.has('d')) control.steer = 1;
  else if (!controls.matches(':active')) control.steer = 0;

  control.throttle = control.throttle || keys.has('arrowup') || keys.has('w') || keys.has(' ');
  control.brake = control.brake || keys.has('arrowdown') || keys.has('s');
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
  const metrics = {
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    state: gameState,
    track: selectedTrack.id,
  };
  debug.textContent = `calls ${metrics.calls}\ntris ${metrics.triangles}\ngeos ${metrics.geometries}\ntex ${metrics.textures}`;
  debug.classList.toggle('active', settings.performanceMode === 'highDetail');
  (window as any).__GRIDLINE_APEX__ = {
    ready: true,
    state: gameState,
    metrics,
    settings,
    results,
  };
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
