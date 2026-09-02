/**
 * KUS WORLD ENGINE — Application Entry Point
 *
 * Boots the application:
 * 1. Initializes the UI manager (handles drag-drop, progress, transitions)
 * 2. Initializes the Babylon.js scene engine
 * 3. When the pipeline completes, builds the 3D world from the analyzed video data
 * 4. Runs the game loop
 */

import { UIManager } from './ui/UIManager.js';
import { SceneEngine } from './engine/SceneEngine.js';
import { PipelineManager } from './pipeline/PipelineManager.js';

let sceneEngine = null;
let uiManager = null;
let pipeline = null;

export async function main() {
  console.log('🎮 KUS WORLD ENGINE — Starting...');
  console.log(`📅 ${new Date().toLocaleString()}`);
  console.log('⚡ WebGPU target — Babylon.js renderer');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  pipeline = PipelineManager.getInstance();
  uiManager = new UIManager();

  // Watch for pipeline completion to start the game
  pipeline.onStateChange((state) => {
    if (state.status === 'completed' && state.world && !sceneEngine) {
      startGame(state.world);
    }
  });

  // MutationObserver for game container activation
  const container = document.getElementById('gameContainer');
  if (container) {
    const observer = new MutationObserver(() => {
      if (container.classList.contains('active') && !sceneEngine) {
        const world = pipeline.getState().world;
        if (world) startGame(world);
      }
    });
    observer.observe(container, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  console.log('✅ KUS WORLD Engine ready. Drop a movie to begin.');
}

/**
 * Spin up the game world from pipeline output
 */
async function startGame(world) {
  console.log(`🌍 Starting game: "${world.name}"`);
  console.log(`  🏛️ ${world.structures?.length || 0} structures`);
  console.log(`  🧍 ${world.characters?.length || 0} characters`);
  console.log(`  📦 ${world.props?.length || 0} props`);
  if (world.dialogues?.length) {
    console.log(`  💬 ${world.dialogues.length} dialogue segments`);
  }

  sceneEngine = new SceneEngine({
    canvasId: 'gameCanvas',
    enableWebGPU: true,
    antialias: true,
    adaptive: true,
  });

  const canvas = uiManager.getCanvas();
  await sceneEngine.init(canvas);

  // Build world from scene graph (reconstructed from video)
  if (world.sceneGraph && world.sceneGraph.nodes.length > 0) {
    await sceneEngine.buildFromSceneGraph(world.sceneGraph);
  } else {
    // Fallback demo world
    console.log('ℹ️ No scene graph data, using demo world');
    await sceneEngine.buildDemoWorld();
  }

  // Fade in
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 1.5s ease';
  requestAnimationFrame(() => {
    canvas.style.opacity = '1';
  });

  console.log('✅ World spawned — WASD to explore!');
}

// HMR support
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    sceneEngine?.dispose();
  });
}