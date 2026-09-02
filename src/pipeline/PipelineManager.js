/**
 * KUS WORLD ENGINE — Pipeline Manager
 *
 * Orchestrates the progressive film-to-world pipeline.
 * Each stage reports progress for real-time UI updates.
 */

/* ── Stage Definitions ── */

const STAGE_DEFS = [
  { id: 'ingest',           name: 'Ingesting video',              weight: 5  },
  { id: 'extract_frames',   name: 'Extracting frames & audio',     weight: 10 },
  { id: 'analyze_scenes',   name: 'Analyzing scenes & shots',      weight: 15 },
  { id: 'detect_objects',   name: 'Detecting objects & characters', weight: 15 },
  { id: 'track_characters', name: 'Tracking characters across frames', weight: 15 },
  { id: 'transcribe_audio', name: 'Transcribing dialogue',         weight: 10 },
  { id: 'reconstruct_3d',   name: 'Reconstructing 3D environment', weight: 20 },
  { id: 'build_world',      name: 'Building interactive world',    weight: 5  },
  { id: 'spawn',            name: 'Spawning into game',           weight: 5  },
];

/* ── Pipeline Manager ── */

class PipelineManager {
  static instance = null;

  constructor() {
    this.state = this._createInitialState();
    this.listeners = [];
  }

  static getInstance() {
    if (!PipelineManager.instance) {
      PipelineManager.instance = new PipelineManager();
    }
    return PipelineManager.instance;
  }

  /* ── State Access ── */

  getState() {
    return {
      ...this.state,
      stages: this.state.stages.map(s => ({ ...s })),
    };
  }

  onStateChange(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  _notify() {
    const snapshot = this.getState();
    this.listeners.forEach(l => l(snapshot));
  }

  /* ── Lifecycle ── */

  async start(video) {
    this.state = this._createInitialState();
    this.state.videoSource = video;
    this.state.status = 'running';
    this._notify();

    try {
      for (let i = 0; i < this.state.stages.length; i++) {
        this.state.currentStageIndex = i;
        const stage = this.state.stages[i];
        stage.status = 'running';
        stage.startedAt = new Date();
        this._notify();

        await this._runStage(stage, video);

        stage.status = 'completed';
        stage.completedAt = new Date();
        stage.progress = 100;
        this._updateOverallProgress();
        this._notify();
      }

      this.state.status = 'completed';
      this.state.world = this._buildDemoWorld(video);
      this._notify();
      return this.state.world;

    } catch (err) {
      this.state.status = 'failed';
      const currentStage = this.state.stages[this.state.currentStageIndex];
      if (currentStage) {
        currentStage.status = 'failed';
        currentStage.error = err instanceof Error ? err.message : String(err);
      }
      this._notify();
      throw err;
    }
  }

  reset() {
    this.state = this._createInitialState();
    this._notify();
  }

  /* ── Stage Execution ── */

  async _runStage(stage, video) {
    const totalSteps = 5 + Math.floor(Math.random() * 6);
    for (let step = 0; step < totalSteps; step++) {
      await this._delay(100 + Math.random() * 300);
      stage.progress = Math.round(((step + 1) / totalSteps) * 100);
      this._updateOverallProgress();
      this._notify();
    }
  }

  _updateOverallProgress() {
    const totalWeight = STAGE_DEFS.reduce((s, d) => s + d.weight, 0);
    let completed = 0;

    for (let i = 0; i < this.state.stages.length; i++) {
      const stage = this.state.stages[i];
      const def = STAGE_DEFS[i];
      if (stage.status === 'completed') {
        completed += def.weight;
      } else if (stage.status === 'running') {
        completed += def.weight * (stage.progress / 100);
      }
    }

    this.state.overallProgress = Math.round((completed / totalWeight) * 100);
  }

  /* ── Demo World ── */

  _buildDemoWorld(video) {
    return {
      id: `world_${Date.now()}`,
      name: video.name.replace(/\.[^/.]+$/, ''),
      sceneGraph: {
        id: `sg_${Date.now()}`,
        name: video.name,
        nodes: [],
        metadata: {
          sourceFilm: video.name,
          engine: 'babylonjs',
          generatedAt: new Date(),
          version: '0.1.0',
        },
      },
      characters: [],
      assets: [],
      dialogues: [],
      environment: {
        sceneId: `env_${Date.now()}`,
        meshPath: '',
        status: 'completed',
        quality: 0.5,
        confidence: 0.5,
        metadata: { technique: 'hybrid' },
      },
      status: 'ready',
      createdAt: new Date(),
    };
  }

  /* ── Helpers ── */

  _createInitialState() {
    return {
      videoSource: null,
      stages: STAGE_DEFS.map(def => ({
        id: def.id,
        name: def.name,
        status: 'pending',
        progress: 0,
        weight: def.weight,
      })),
      currentStageIndex: 0,
      overallProgress: 0,
      status: 'idle',
      world: null,
      createdAt: new Date(),
    };
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default PipelineManager;
export { PipelineManager };