/**
 * KUS WORLD ENGINE — Application Entry Point
 *
 * Boots the application:
 * 1. Initializes the UI manager (drag-drop, progress, transitions)
 * 2. Initializes the Babylon.js scene engine
 * 3. When pipeline completes, builds the 3D demo world
 * 4. Runs the game loop
 */

import { UIManager } from './ui/UIManager.js';
import { SceneEngine } from './engine/SceneEngine.js';
import { PipelineManager } from './pipeline/PipelineManager.js';

/* ── State ── */

let sceneEngine = null;
let uiManager = null;
let pipeline = null;

/* ── Main Boot ── */

export async function main() {
  console.log('🎮 KUS WORLD ENGINE — Starting...');
  console.log(`📅 ${new Date().toLocaleString()}`);
  console.log('⚡ WebGPU target — Babylon.js renderer');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  pipeline = PipelineManager.getInstance();
  uiManager = new UIManager();

  // Watch for pipeline completion
  pipeline.onStateChange((state) => {
    if (state.status === 'completed' && state.world && !sceneEngine) {
      startGame(state.world);
    }
  });

  // MutationObserver for game container activation
  const observer = new MutationObserver(() => {
    const container = document.getElementById('gameContainer');
    if (container?.classList.contains('active') && !sceneEngine) {
      const world = pipeline.getState().world;
      if (world) startGame(world);
    }
  });
  observer.observe(document.getElementById('gameContainer'), {
    attributes: true,
    attributeFilter: ['class'],
  });

  console.log('✅ KUS WORLD Engine ready. Drop a movie to begin.');
}

/* ── Game Start ── */

async function startGame(world) {
  console.log(`🌍 Starting game: ${world.name}`);

  sceneEngine = new SceneEngine({
    canvasId: 'gameCanvas',
    enableWebGPU: true,
    antialias: true,
    adaptive: true,
  });

  const canvas = uiManager.getCanvas();
  await sceneEngine.init(canvas);
  await sceneEngine.buildDemoWorld();

  // Fade in
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 1.5s ease';
  requestAnimationFrame(() => {
    canvas.style.opacity = '1';
  });

  console.log('✅ World spawned — WASD to explore!');
}

/* ── HMR support ── */

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    sceneEngine?.dispose();
  });
}