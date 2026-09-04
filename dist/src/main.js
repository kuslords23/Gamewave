/**
 * KUS WORLD ENGINE — Application Entry Point
 *
 * Boots the multi-page application with:
 * 1. Router with all page handlers (#home, #worlds, #library, #settings, #about, #game)
 * 2. Sidebar navigation with active state tracking
 * 3. UIManager for the landing page (drag-drop, progress, transitions)
 * 4. SceneEngine for the 3D game world
 * 5. StorageManager for IndexedDB persistence
 */

import { UIManager } from './ui/UIManager.js';
import { Sidebar } from './ui/Sidebar.js';
import { StorageManager } from './ui/StorageManager.js';
import { Router } from './router/Router.js';
import { SceneEngine } from './engine/SceneEngine.js';
import { PipelineManager } from './pipeline/PipelineManager.js';
import { HomePage } from './pages/HomePage.js';
import { WorldsPage } from './pages/WorldsPage.js';
import { LibraryPage } from './pages/LibraryPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { AboutPage } from './pages/AboutPage.js';

/* ── App State ── */

let sceneEngine = null;
let uiManager = null;
let pipeline = null;
let storage = null;
let router = null;
let sidebar = null;
let homePage = null;

/* ── GAME STATE ── */
let isGameActive = false;

/* ── Main Boot ── */

export async function main() {
  console.log('🎮 KUS WORLD ENGINE — Starting...');
  console.log(`📅 ${new Date().toLocaleString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Initialize services
  storage = StorageManager.getInstance();
  pipeline = PipelineManager.getInstance();
  router = Router.getInstance();
  sidebar = new Sidebar();
  homePage = new HomePage();

  // Open IndexedDB
  await storage.open();

  // Register routes
  router.register('home', async (params) => {
    sidebar.setActive('home');
    await homePage.render(params);
    sidebar.setVisible(true);
    document.getElementById('app')?.classList.remove('game-active');
  });

  router.register('worlds', async (params) => {
    sidebar.setActive('worlds');
    const worldsPage = new WorldsPage();
    await worldsPage.render(params);
    sidebar.setVisible(true);
    document.getElementById('app')?.classList.remove('game-active');
  });

  router.register('library', async (params) => {
    sidebar.setActive('library');
    const libraryPage = new LibraryPage();
    await libraryPage.render(params);
    sidebar.setVisible(true);
    document.getElementById('app')?.classList.remove('game-active');
  });

  router.register('settings', async (params) => {
    sidebar.setActive('settings');
    const settingsPage = new SettingsPage();
    await settingsPage.render(params);
    sidebar.setVisible(true);
    document.getElementById('app')?.classList.remove('game-active');
  });

  router.register('about', async (params) => {
    sidebar.setActive('about');
    const aboutPage = new AboutPage();
    await aboutPage.render(params);
    sidebar.setVisible(true);
    document.getElementById('app')?.classList.remove('game-active');
  });

  router.register('game', async (params) => {
    sidebar.setVisible(false);
    document.getElementById('app')?.classList.add('game-active');

    const world = pipeline.getState().world;
    if (world && !isGameActive) {
      await startGame(world);
    } else if (params.worldId && !isGameActive) {
      // Load world from storage
      const loaded = await storage.loadWorld(params.worldId);
      if (loaded) {
        pipeline.state.world = loaded;
        pipeline.state.status = 'completed';
        await startGame(loaded);
      }
    }
  });

  // Start the router
  router.start();

  // Initialize UI Manager (handles landing page interactions)
  uiManager = new UIManager('landing');
  uiManager._onPipelineComplete = async (world) => {
    await homePage.onWorldComplete(world);
  };

  // Watch pipeline for completion — navigate to game
  pipeline.onStateChange((state) => {
    if (state.status === 'completed' && state.world && !isGameActive) {
      router.navigate('game', { worldId: state.world.id });
    }
  });

  console.log('✅ KUS WORLD Engine ready. Navigate with sidebar.');

  // Exit game button
  document.getElementById('exitGameBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    exitGame();
  });
}

/* ════════════════════════════════════════
   Game Start / Exit
   ════════════════════════════════════════ */

async function startGame(world) {
  if (isGameActive) return;
  isGameActive = true;

  console.log(`🌍 Starting game: "${world.name}"`);
  console.log(`  🏛️ ${world.structures?.length || 0} structures`);
  console.log(`  🧍 ${world.characters?.length || 0} characters`);
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

  // Build world from scene graph
  if (world.sceneGraph && world.sceneGraph.nodes.length > 0) {
    await sceneEngine.buildFromSceneGraph(world.sceneGraph);
  } else {
    console.log('ℹ️ No scene graph data, using demo world');
    await sceneEngine.buildDemoWorld();
  }

  // Show game elements
  document.getElementById('gameContainer')?.classList.add('active');
  document.getElementById('hud')?.classList.add('active');
  document.getElementById('progressOverlay')?.classList.remove('active');

  // Fade in
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 1.5s ease';
  requestAnimationFrame(() => {
    canvas.style.opacity = '1';
  });

  console.log('✅ World spawned — WASD to explore!');
}

function exitGame() {
  if (!isGameActive) return;
  isGameActive = false;

  // Dispose engine
  if (sceneEngine) {
    sceneEngine.dispose();
    sceneEngine = null;
  }

  // Hide game elements
  document.getElementById('gameContainer')?.classList.remove('active');
  document.getElementById('hud')?.classList.remove('active');

  // Restore sidebar + content
  document.getElementById('app')?.classList.remove('game-active');
  sidebar.setVisible(true);

  // Navigate home
  router.navigate('home');
}

/* ════════════════════════════════════════
   HMR Support
   ════════════════════════════════════════ */

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    sceneEngine?.dispose();
    router?.stop();
  });
}