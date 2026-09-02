/**
 * KUS WORLD ENGINE — Settings Page
 *
 * Configure extraction quality, rendering options, and app preferences.
 * Settings are persisted to IndexedDB.
 */

import { StorageManager } from '../ui/StorageManager.js';

class SettingsPage {
  constructor() {
    this.storage = StorageManager.getInstance();
  }

  async render(params) {
    const mainArea = document.getElementById('contentArea');
    if (!mainArea) return;

    document.getElementById('landing')?.classList.add('hidden');
    document.querySelectorAll('.page-content').forEach(el => el.style.display = 'none');

    const defaults = this.storage.getDefaults();
    const settings = await this.storage.getSettings();

    // Merge defaults with saved settings
    const s = { ...defaults, ...settings };

    mainArea.innerHTML = `
      <div class="page-content settings-page" style="display:block">
        <div class="page-header">
          <h1>⚙️ Settings</h1>
          <p class="page-subtitle">Configure the engine to your preference</p>
        </div>

        <div class="settings-section">
          <h2>🎬 Video Extraction</h2>

          <div class="setting-row">
            <label class="setting-label">
              <span>Frame Rate</span>
              <small>Frames extracted per second of video (higher = more detail, slower)</small>
            </label>
            <div class="setting-control">
              <select id="setting-frameRate" class="setting-select">
                ${[1, 2, 4, 6, 10, 15, 24, 30].map(fps =>
                  `<option value="${fps}" ${s.frameRate === fps ? 'selected' : ''}>${fps} fps</option>`
                ).join('')}
              </select>
            </div>
          </div>

          <div class="setting-row">
            <label class="setting-label">
              <span>Max Frames</span>
              <small>Maximum number of frames to extract (limits processing time)</small>
            </label>
            <div class="setting-control">
              <select id="setting-maxFrames" class="setting-select">
                ${[50, 100, 150, 200, 300, 500, 1000].map(n =>
                  `<option value="${n}" ${s.maxFrames === n ? 'selected' : ''}>${n}</option>`
                ).join('')}
              </select>
            </div>
          </div>

          <div class="setting-row">
            <label class="setting-label">
              <span>Extraction Quality</span>
              <small>Balanced uses moderate resolution. Quality uses full resolution.</small>
            </label>
            <div class="setting-control">
              <select id="setting-extractionQuality" class="setting-select">
                <option value="fast" ${s.extractionQuality === 'fast' ? 'selected' : ''}>⚡ Fast</option>
                <option value="balanced" ${s.extractionQuality === 'balanced' ? 'selected' : ''}>⚖️ Balanced</option>
                <option value="quality" ${s.extractionQuality === 'quality' ? 'selected' : ''}>🌟 Quality</option>
              </select>
            </div>
          </div>

          <div class="setting-row">
            <label class="setting-label">
              <span>Max Width</span>
              <small>Maximum pixel width for extracted frames</small>
            </label>
            <div class="setting-control">
              <select id="setting-maxWidth" class="setting-select">
                ${[320, 480, 640, 854, 960, 1280].map(w =>
                  `<option value="${w}" ${s.maxWidth === w ? 'selected' : ''}>${w}px</option>`
                ).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h2>🎮 Rendering</h2>

          <div class="setting-row">
            <label class="setting-label">
              <span>WebGPU</span>
              <small>Use WebGPU for rendering (requires compatible browser)</small>
            </label>
            <div class="setting-control">
              <label class="toggle">
                <input type="checkbox" id="setting-enableWebGPU" ${s.enableWebGPU !== false ? 'checked' : ''} />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-row">
            <label class="setting-label">
              <span>Antialiasing</span>
              <small>Smooth jagged edges in the 3D view</small>
            </label>
            <div class="setting-control">
              <label class="toggle">
                <input type="checkbox" id="setting-antialias" ${s.antialias !== false ? 'checked' : ''} />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-row">
            <label class="setting-label">
              <span>Adaptive Quality</span>
              <small>Automatically adjust quality for smooth performance</small>
            </label>
            <div class="setting-control">
              <label class="toggle">
                <input type="checkbox" id="setting-adaptiveQuality" ${s.adaptiveQuality !== false ? 'checked' : ''} />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-row">
            <label class="setting-label">
              <span>Show FPS</span>
              <small>Display frames-per-second counter in game HUD</small>
            </label>
            <div class="setting-control">
              <label class="toggle">
                <input type="checkbox" id="setting-showFps" ${s.showFps !== false ? 'checked' : ''} />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h2>💾 Storage</h2>

          <div class="setting-row">
            <label class="setting-label">
              <span>Auto-Save Worlds</span>
              <small>Automatically save generated worlds to your library</small>
            </label>
            <div class="setting-control">
              <label class="toggle">
                <input type="checkbox" id="setting-autoSaveWorlds" ${s.autoSaveWorlds !== false ? 'checked' : ''} />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-row">
            <label class="setting-label">
              <span>Storage Usage</span>
              <small>Clear all saved worlds, videos, and settings</small>
            </label>
            <div class="setting-control">
              <button id="clearStorageBtn" class="btn-danger">🗑️ Clear All Data</button>
            </div>
          </div>
        </div>

        <div class="settings-actions">
          <button id="saveSettingsBtn" class="btn-primary">💾 Save Settings</button>
          <button id="resetSettingsBtn" class="btn-secondary">↻ Reset to Defaults</button>
        </div>

        <div id="settingsStatus" class="settings-status"></div>
      </div>
    `;

    // Attach listeners
    document.getElementById('saveSettingsBtn')?.addEventListener('click', () => this._saveSettings(defaults));
    document.getElementById('resetSettingsBtn')?.addEventListener('click', () => {
      if (confirm('Reset all settings to defaults?')) {
        this._saveSettings(defaults, defaults);
      }
    });
    document.getElementById('clearStorageBtn')?.addEventListener('click', async () => {
      if (!confirm('Clear ALL saved worlds, videos, and settings? This cannot be undone!')) return;
      const db = await this.storage.open();
      const tx = db.transaction(['worlds', 'videos', 'settings'], 'readwrite');
      tx.objectStore('worlds').clear();
      tx.objectStore('videos').clear();
      tx.objectStore('settings').clear();
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = reject;
      });
      this._showStatus('✅ All data cleared');
      await this.render({});
    });
  }

  async _saveSettings(defaults, resetValues = null) {
    const settings = resetValues || {
      frameRate: parseInt(document.getElementById('setting-frameRate')?.value || defaults.frameRate),
      maxFrames: parseInt(document.getElementById('setting-maxFrames')?.value || defaults.maxFrames),
      maxWidth: parseInt(document.getElementById('setting-maxWidth')?.value || defaults.maxWidth),
      extractionQuality: document.getElementById('setting-extractionQuality')?.value || defaults.extractionQuality,
      enableWebGPU: document.getElementById('setting-enableWebGPU')?.checked ?? defaults.enableWebGPU,
      antialias: document.getElementById('setting-antialias')?.checked ?? defaults.antialias,
      adaptiveQuality: document.getElementById('setting-adaptiveQuality')?.checked ?? defaults.adaptiveQuality,
      showFps: document.getElementById('setting-showFps')?.checked ?? defaults.showFps,
      autoSaveWorlds: document.getElementById('setting-autoSaveWorlds')?.checked ?? defaults.autoSaveWorlds,
    };

    await this.storage.saveSettings(settings);

    if (resetValues) {
      // Update UI to match
      await this.render({});
    }

    this._showStatus('✅ Settings saved');
  }

  _showStatus(msg) {
    const el = document.getElementById('settingsStatus');
    if (el) {
      el.textContent = msg;
      el.style.opacity = '1';
      setTimeout(() => { el.style.opacity = '0'; }, 2000);
    }
  }
}

export default SettingsPage;
export { SettingsPage };