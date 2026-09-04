/**
 * KUS WORLD ENGINE — UI Manager
 *
 * Manages landing page UI interactions:
 * - Drag-and-drop video upload
 * - Pipeline progress overlay
 * - Screen transitions between landing → progress → game
 */

import { PipelineManager } from '../pipeline/PipelineManager.js';

class UIManager {
  constructor(landingId = 'landing', handlers = {}) {
    this.pipeline = PipelineManager.getInstance();
    this.selectedFile = null;
    this.handlers = handlers;
    this._onPipelineComplete = null;

    // DOM refs
    this.landing = document.getElementById(landingId);
    this.dropZone = document.getElementById('dropZone');
    this.fileInput = document.getElementById('fileInput');
    this.fileName = document.getElementById('fileName');
    this.fileSize = document.getElementById('fileSize');
    this.generateBtn = document.getElementById('generateBtn');
    this.progressOverlay = document.getElementById('progressOverlay');
    this.progressFill = document.getElementById('progressFill');
    this.currentStage = document.getElementById('currentStage');
    this.progressSteps = document.getElementById('progressSteps');
    this.gameContainer = document.getElementById('gameContainer');
    this.hud = document.getElementById('hud');
    this.gameCanvas = document.getElementById('gameCanvas');

    if (this.landing && this.dropZone) {
      this._setupEventListeners();
      this._watchPipeline();
    }
  }

  /* ── Event Listeners ── */

  _setupEventListeners() {
    this.fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this._handleFileSelected(file);
    });

    this.dropZone.addEventListener('click', () => this.fileInput.click());

    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropZone.classList.add('drag-over');
    });

    this.dropZone.addEventListener('dragleave', () => {
      this.dropZone.classList.remove('drag-over');
    });

    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropZone.classList.remove('drag-over');
      const file = e.dataTransfer?.files[0];
      if (file && file.type.startsWith('video/')) {
        this._handleFileSelected(file);
      }
    });

    this.generateBtn.addEventListener('click', () => this._startGeneration());
  }

  /* ── File Selection ── */

  _handleFileSelected(file) {
    this.selectedFile = file;
    this.fileName.textContent = file.name;
    this.fileSize.textContent = this._formatFileSize(file.size);
    this.dropZone.classList.add('has-file');
    this.generateBtn.disabled = false;
    console.log(`📁 File selected: ${file.name} (${this._formatFileSize(file.size)})`);
  }

  /* ── Generation ── */

  async _startGeneration() {
    if (!this.selectedFile) return;

    // Transition landing out
    this.landing.classList.add('hidden');

    // Show progress overlay
    this.progressOverlay.classList.add('active');
    this.generateBtn.disabled = true;

    // Create video source
    const videoSource = {
      file: this.selectedFile,
      name: this.selectedFile.name,
      size: this.selectedFile.size,
      type: this.selectedFile.type,
      duration: 0,
      frameRate: 24,
      totalFrames: 0,
      width: 0,
      height: 0,
    };

    try {
      // Get video metadata
      try {
        const metadata = await this._getVideoMetadata(this.selectedFile);
        videoSource.duration = metadata.duration;
        videoSource.width = metadata.width;
        videoSource.height = metadata.height;
        videoSource.totalFrames = Math.round(metadata.duration * videoSource.frameRate);
      } catch {
        console.warn('Could not extract video metadata, using defaults');
      }

      // Start the pipeline
      const world = await this.pipeline.start(videoSource);

      // Hide progress
      this.progressOverlay.classList.remove('active');

      // Call completion handler
      if (this._onPipelineComplete) {
        await this._onPipelineComplete(world);
      }

    } catch (err) {
      console.error('Pipeline failed:', err);
      this.currentStage.textContent = `❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  /* ── Pipeline Watching ── */

  _watchPipeline() {
    this.pipeline.onStateChange((state) => {
      this._updateProgressUI(state);
    });
  }

  _updateProgressUI(state) {
    this.progressFill.style.width = `${state.overallProgress}%`;

    const currentStage = state.stages[state.currentStageIndex];
    if (currentStage) {
      this.currentStage.textContent = currentStage.status === 'completed'
        ? `✅ ${currentStage.name} — complete`
        : `⚡ ${currentStage.name}...`;
    }

    const stepElements = this.progressSteps.querySelectorAll('li');
    state.stages.forEach((stage, i) => {
      const el = stepElements[i];
      if (el) {
        el.classList.remove('active', 'done');
        if (stage.status === 'completed') {
          el.classList.add('done');
          el.querySelector('.step-icon').textContent = '✓';
        } else if (stage.status === 'running') {
          el.classList.add('active');
          el.querySelector('.step-icon').textContent = '▶';
        } else if (stage.status === 'failed') {
          el.querySelector('.step-icon').textContent = '✗';
          el.style.color = 'rgba(255,100,100,0.8)';
        }
      }
    });
  }

  /* ── Helpers ── */

  _formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  _getVideoMetadata(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        });
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Could not load video metadata'));
      };
      video.src = URL.createObjectURL(file);
    });
  }

  getCanvas() {
    return this.gameCanvas;
  }
}

export default UIManager;
export { UIManager };