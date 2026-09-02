/**
 * KUS WORLD ENGINE — Home Page
 *
 * The landing page where users drop a video to start the pipeline.
 * Refactored from the original UIManager into a page component.
 */

import { PipelineManager } from '../pipeline/PipelineManager.js';
import { StorageManager } from '../ui/StorageManager.js';
import { Router } from '../router/Router.js';

class HomePage {
  constructor() {
    this.pipeline = PipelineManager.getInstance();
    this.storage = StorageManager.getInstance();
    this.selectedFile = null;
    this.router = Router.getInstance();
  }

  /**
   * Render the home page (this is the default view)
   */
  async render(params) {
    // Show landing, hide other pages
    document.getElementById('landing').classList.remove('hidden');
    document.getElementById('landing').style.display = '';
    document.getElementById('gameContainer').classList.remove('active');
    document.getElementById('progressOverlay').classList.remove('active');
    document.getElementById('hud').classList.remove('active');

    // Hide page content areas
    document.querySelectorAll('.page-content').forEach(el => {
      el.style.display = 'none';
    });

    // Reset drop zone
    this.selectedFile = null;
    document.getElementById('dropZone')?.classList.remove('has-file');
    document.getElementById('generateBtn').disabled = true;
  }

  /**
   * Called when a world is completed — save it and navigate
   */
  async onWorldComplete(world) {
    // Auto-save world to IndexedDB
    const settings = await this.storage.getSettings();
    if (settings.autoSaveWorlds !== false) {
      try {
        await this.storage.saveWorld({
          ...world,
          status: 'ready',
        });
        console.log('💾 World saved to storage');
      } catch (err) {
        console.warn('Failed to save world:', err.message);
      }
    }

    // Show game
    this.router.navigate('game');
  }
}

export default HomePage;
export { HomePage };