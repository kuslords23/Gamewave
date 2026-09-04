/**
 * KUS WORLD ENGINE — Worlds Page
 *
 * "My Worlds" gallery showing all saved reconstructed worlds.
 * Users can browse, load, delete, or re-enter worlds.
 */

import { StorageManager } from '../ui/StorageManager.js';

class WorldsPage {
  constructor() {
    this.storage = StorageManager.getInstance();
  }

  async render(params) {
    const mainArea = document.getElementById('contentArea');
    if (!mainArea) return;

    // Hide landing, show page content
    document.getElementById('landing')?.classList.add('hidden');
    document.querySelectorAll('.page-content').forEach(el => el.style.display = 'none');

    // Load worlds
    const worlds = await this.storage.loadWorlds();

    mainArea.innerHTML = `
      <div class="page-content worlds-page" style="display:block">
        <div class="page-header">
          <h1>🌍 My Worlds</h1>
          <p class="page-subtitle">${worlds.length} saved ${worlds.length === 1 ? 'world' : 'worlds'}</p>
        </div>
        <div class="world-grid" id="worldGrid">
          ${worlds.length === 0 ? this._emptyState() : worlds.map(w => this._worldCard(w)).join('')}
        </div>
      </div>
    `;

    // Attach event listeners
    mainArea.querySelectorAll('.world-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const id = card.dataset.worldId;
        // Don't trigger if clicking action buttons
        if (e.target.closest('.action-btn')) return;
        this._loadWorld(id);
      });
    });

    mainArea.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.worldId;
        this._deleteWorld(id);
      });
    });

    mainArea.querySelectorAll('.play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.worldId;
        this._playWorld(id);
      });
    });

    mainArea.querySelectorAll('.info-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.worldId;
        this._showWorldInfo(id);
      });
    });
  }

  _emptyState() {
    return `
      <div class="empty-state">
        <div class="empty-icon">🌌</div>
        <h2>No worlds yet</h2>
        <p>Drop a video on the home page to create your first world.</p>
        <a href="#home" class="btn-primary">Go to Home</a>
      </div>
    `;
  }

  _worldCard(world) {
    const date = new Date(world.createdAt || world.savedAt);
    const dateStr = date.toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const charCount = world.characters?.length || 0;
    const structCount = world.structures?.length || 0;
    const propCount = world.props?.length || 0;

    return `
      <div class="world-card" data-world-id="${world.id}">
        <div class="world-card-thumb">
          <div class="world-card-icon">🎬</div>
        </div>
        <div class="world-card-body">
          <h3 class="world-card-title">${world.name || 'Untitled World'}</h3>
          <div class="world-card-meta">
            <span>🏛️ ${structCount} structures</span>
            <span>🧍 ${charCount} characters</span>
            <span>📦 ${propCount} props</span>
          </div>
          <div class="world-card-date">${dateStr}</div>
        </div>
        <div class="world-card-actions">
          <button class="action-btn play-btn" data-world-id="${world.id}" title="Play">▶️ Play</button>
          <button class="action-btn info-btn" data-world-id="${world.id}" title="Info">ℹ️</button>
          <button class="action-btn delete-btn danger" data-world-id="${world.id}" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }

  async _loadWorld(id) {
    const world = await this.storage.loadWorld(id);
    if (world) {
      console.log(`📂 Loaded world: ${world.name}`);
      // Set as current world in pipeline and navigate to game
      const { PipelineManager } = await import('../pipeline/PipelineManager.js');
      const pipeline = PipelineManager.getInstance();
      pipeline.state.world = world;
      pipeline.state.status = 'completed';

      const { Router } = await import('../router/Router.js');
      Router.getInstance().navigate('game', { worldId: id });
    }
  }

  async _deleteWorld(id) {
    if (!confirm('Delete this world permanently?')) return;
    await this.storage.deleteWorld(id);
    await this.render({});
  }

  async _playWorld(id) {
    await this._loadWorld(id);
  }

  async _showWorldInfo(id) {
    const world = await this.storage.loadWorld(id);
    if (!world) return;

    alert(`📋 ${world.name}\n
    Created: ${new Date(world.createdAt).toLocaleString()}
    Structures: ${world.structures?.length || 0}
    Characters: ${world.characters?.length || 0}
    Props: ${world.props?.length || 0}
    Dialogues: ${world.dialogues?.length || 0}
    Scene Graph Nodes: ${world.sceneGraph?.nodes?.length || 0}
    ID: ${world.id}`);
  }
}

export default WorldsPage;
export { WorldsPage };