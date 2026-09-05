/**
 * KUS WORLD ENGINE — Main Entry Point
 * 
 * Bootstraps the application and wires up all components.
 */

import { PipelineManager } from './pipeline/PipelineManager.js';
import { UIManager } from './ui/UIManager.js';
import { StorageManager } from './ui/StorageManager.js';
import { SceneEngine } from './engine/SceneEngine.js';
import { Router } from './router/Router.js';
import { Sidebar } from './ui/Sidebar.js';

let sceneEngine = null;
let pipeline = null;
let uiManager = null;
let storageManager = null;
let router = null;
let sidebar = null;

export async function main() {
  console.log('🚀 KUS WORLD ENGINE starting...');

  // Initialize storage
  storageManager = StorageManager.getInstance();
  await storageManager.open();
  console.log('✓ IndexedDB ready');

  // Initialize pipeline
  pipeline = PipelineManager.getInstance();
  pipeline.onStateChange((state) => {
    updateProgressUI(state);
  });

  // Initialize UI
  uiManager = new UIManager('landing', {
    onFileSelected: (file) => console.log('Selected:', file.name),
    onGenerate: startGeneration
  });

  // Initialize sidebar
  sidebar = new Sidebar();

  // Initialize router
  router = Router.getInstance();
  router.register('home', showHome);
  router.register('worlds', showWorlds);
  router.register('library', showLibrary);
  router.register('settings', showSettings);
  router.register('about', showAbout);
  router.start();

  console.log('✓ All systems initialized');
}

async function startGeneration(videoSource) {
  console.log('🎬 Starting pipeline for:', videoSource.name);
  
  // Show loading overlay
  const progressOverlay = document.getElementById('progressOverlay');
  const gameCanvas = document.getElementById('gameCanvas');
  const gameContainer = document.getElementById('gameContainer');
  const fpsCounter = document.getElementById('fpsCounter');
  
  progressOverlay.classList.remove('hidden');
  gameContainer.classList.remove('hidden');
  fpsCounter.classList.remove('hidden');
  document.getElementById('landing').classList.add('hidden');
  sidebar.setVisible(false);

  try {
    const world = await pipeline.start(videoSource);
    console.log('✅ World generated:', world.name);
    
    // Build the 3D world
    sceneEngine = new SceneEngine();
    const success = await sceneEngine.init(gameCanvas);
    
    if (success) {
      await sceneEngine.loadWorld(world.sceneGraph);
      console.log('🎮 World rendering...');
      startFPSCounter();
    }
  } catch (err) {
    console.error('❌ Generation failed:', err);
    alert('Failed to generate world: ' + err.message);
    progressOverlay.classList.add('hidden');
    document.getElementById('landing').classList.remove('hidden');
    sidebar.setVisible(true);
  }
}

function startFPSCounter() {
  let frameCount = 0;
  let lastTime = performance.now();
  let fps = 0;

  function update() {
    frameCount++;
    const now = performance.now();
    
    if (now - lastTime >= 1000) {
      fps = Math.round((frameCount * 1000) / (now - lastTime));
      frameCount = 0;
      lastTime = now;
      document.getElementById('fpsCounter').textContent = `FPS: ${fps}`;
    }
    
    requestAnimationFrame(update);
  }
  
  requestAnimationFrame(update);
}

function updateProgressUI(state) {
  const progressFill = document.getElementById('progressFill');
  const currentStage = document.getElementById('currentStage');
  const progressSteps = document.getElementById('progressSteps');
  
  if (progressFill) {
    progressFill.textContent = `${state.overallProgress}%`;
  }
  
  const current = state.stages[state.currentStageIndex];
  if (currentStage) {
    currentStage.textContent = `${current.name} — ${current.status}`;
  }
  
  if (progressSteps) {
    progressSteps.innerHTML = state.stages.map((stage, i) => {
      const icon = stage.status === 'completed' ? '✓' : stage.status === 'running' ? '▶' : '○';
      const cls = stage.status === 'done' ? 'done' : stage.status === 'active' ? 'active' : '';
      return `<li class="${cls}"><span class="step-icon">${icon}</span> ${stage.name}</li>`;
    }).join('');
  }
}

// Route handlers
async function showHome() {
  document.getElementById('landing').classList.remove('hidden');
  document.getElementById('gameContainer').classList.add('hidden');
  document.getElementById('progressOverlay').classList.add('hidden');
  sidebar.setVisible(true);
}

async function showWorlds() {
  const worlds = await storageManager.loadWorlds();
  document.getElementById('contentArea').innerHTML = `
    <h2>Your Worlds</h2>
    <p>${worlds.length} saved worlds</p>
    ${worlds.map(w => `<div>${w.name}</div>`).join('')}
  `;
}

async function showLibrary() {
  document.getElementById('contentArea').innerHTML = `
    <h2>World Library</h2>
    <p>Browse and import worlds</p>
  `;
}

async function showSettings() {
  document.getElementById('contentArea').innerHTML = `
    <h2>Settings</h2>
    <p>Configure the engine</p>
  `;
}

async function showAbout() {
  document.getElementById('contentArea').innerHTML = `
    <h2>About KUS World Engine</h2>
    <p>Turn film into interactive 3D worlds.</p>
    <p>Powered by Babylon.js and WebGPU.</p>
  `;
}

// Cleanup
window.addEventListener('beforeunload', () => {
  if (sceneEngine) sceneEngine.dispose();
  if (pipeline) pipeline.reset();
});

export { sceneEngine, pipeline, uiManager, storageManager, router };