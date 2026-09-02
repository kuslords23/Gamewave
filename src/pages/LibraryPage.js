/**
 * KUS WORLD ENGINE — Video Library Page
 *
 * Browse previously processed films with metadata.
 * Shows extraction stats and links to generated worlds.
 */

import { StorageManager } from '../ui/StorageManager.js';

class LibraryPage {
  constructor() {
    this.storage = StorageManager.getInstance();
  }

  async render(params) {
    const mainArea = document.getElementById('contentArea');
    if (!mainArea) return;

    document.getElementById('landing')?.classList.add('hidden');
    document.querySelectorAll('.page-content').forEach(el => el.style.display = 'none');

    const videos = await this.storage.loadVideos();
    const worlds = await this.storage.loadWorlds();

    mainArea.innerHTML = `
      <div class="page-content library-page" style="display:block">
        <div class="page-header">
          <h1>🎬 Video Library</h1>
          <p class="page-subtitle">${videos.length} ${videos.length === 1 ? 'video' : 'videos'} processed</p>
        </div>
        <div class="video-list" id="videoList">
          ${videos.length === 0 ? this._emptyState() : videos.map(v => this._videoCard(v, worlds)).join('')}
        </div>
      </div>
    `;

    // Attach events
    mainArea.querySelectorAll('.delete-video-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.videoId;
        if (!confirm('Delete this video from library?')) return;
        await this.storage.deleteVideo(id);
        await this.render({});
      });
    });
  }

  _emptyState() {
    return `
      <div class="empty-state">
        <div class="empty-icon">🎥</div>
        <h2>No videos processed yet</h2>
        <p>Go to the home page and drop a video to get started.</p>
        <a href="#home" class="btn-primary">Go to Home</a>
      </div>
    `;
  }

  _videoCard(video, worlds) {
    const date = new Date(video.processedAt || Date.now());
    const dateStr = date.toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });

    const duration = video.duration || 0;
    const durStr = duration > 60
      ? `${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`
      : `${Math.floor(duration)}s`;

    const sizeStr = video.size
      ? this._formatSize(video.size)
      : 'Unknown';

    const relatedWorld = worlds.find(w => w.name === video.name?.replace(/\.[^/.]+$/, ''));

    return `
      <div class="video-card">
        <div class="video-card-icon">📽️</div>
        <div class="video-card-body">
          <h3 class="video-card-title">${video.name || 'Unknown'}</h3>
          <div class="video-card-meta">
            <span>⏱️ ${durStr}</span>
            <span>💾 ${sizeStr}</span>
            <span>🖼️ ${Math.floor(duration * (video.frameRate || 6))} frames</span>
          </div>
          <div class="video-card-date">Processed ${dateStr}</div>
        </div>
        <div class="video-card-actions">
          ${relatedWorld ? `<a href="#worlds" class="action-btn" title="View world">🌍 View World</a>` : ''}
          <button class="action-btn danger delete-video-btn" data-video-id="${video.id}">🗑️</button>
        </div>
      </div>
    `;
  }

  _formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}

export default LibraryPage;
export { LibraryPage };