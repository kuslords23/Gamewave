/**
 * KUS WORLD ENGINE — Pipeline Manager
 *
 * Orchestrates the progressive film-to-world pipeline with REAL stages:
 *
 * 1. Ingest         — Load video metadata
 * 2. Extract Frames — Real frame + audio extraction via WebCodecs/canvas
 * 3. Analyze Scenes — Shot detection, color/mood/motion analysis
 * 4. Detect Objects — (placeholder for YOLO/transformers.js)
 * 5. Track People   — Motion-based character tracking
 * 6. Transcribe     — Speech recognition via Web Speech API / VAD
 * 7. Reconstruct 3D — Convert analysis into 3D world data
 * 8. Build World    — (reserved for WorldBuilder execution)
 * 9. Spawn          — Signal ready for game
 */

import { FrameExtractor } from './FrameExtractor.js';
import { SceneAnalyzer } from './SceneAnalyzer.js';
import { AudioProcessor } from './AudioProcessor.js';
import { WorldGenerator } from './WorldGenerator.js';

const STAGE_DEFS = [
  { id: 'ingest',           name: 'Ingesting video',                weight: 5  },
  { id: 'extract_frames',   name: 'Extracting frames & audio',      weight: 15 },
  { id: 'analyze_scenes',   name: 'Analyzing scenes & shots',       weight: 20 },
  { id: 'detect_objects',   name: 'Detecting objects & characters', weight: 15 },
  { id: 'track_characters', name: 'Tracking characters',            weight: 10 },
  { id: 'transcribe_audio', name: 'Transcribing dialogue',          weight: 10 },
  { id: 'reconstruct_3d',   name: 'Reconstructing 3D world',        weight: 20 },
  { id: 'build_world',      name: 'Building interactive world',     weight: 5  },
  { id: 'spawn',            name: 'Spawning into game',             weight: 5  },
];

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

  /* ── State ── */

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
    this.listeners.forEach(l => l(this.getState()));
  }

  /* ── Lifecycle ── */

  async start(video) {
    this.state = this._createInitialState();
    this.state.videoSource = video;
    this.state.status = 'running';
    this._notify();

    // Collected data passed between stages
    const context = { video, videoSource: video };

    try {
      for (let i = 0; i < this.state.stages.length; i++) {
        this.state.currentStageIndex = i;
        const stage = this.state.stages[i];
        stage.status = 'running';
        stage.startedAt = new Date();
        this._notify();

        await this._runStage(stage, context);

        stage.status = 'completed';
        stage.completedAt = new Date();
        stage.progress = 100;
        this._updateOverallProgress();
        this._notify();
      }

      this.state.status = 'completed';
      this.state.world = context.world;
      this._notify();
      return context.world;

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

  /* ── Real Stage Execution ── */

  async _runStage(stage, context) {
    switch (stage.id) {
      case 'ingest':
        await this._stageIngest(stage, context);
        break;
      case 'extract_frames':
        await this._stageExtractFrames(stage, context);
        break;
      case 'analyze_scenes':
        await this._stageAnalyze(stage, context);
        break;
      case 'detect_objects':
        await this._stageDetectObjects(stage, context);
        break;
      case 'track_characters':
        await this._stageTrackCharacters(stage, context);
        break;
      case 'transcribe_audio':
        await this._stageTranscribe(stage, context);
        break;
      case 'reconstruct_3d':
        await this._stageReconstruct(stage, context);
        break;
      case 'build_world':
        await this._stageBuild(stage, context);
        break;
      case 'spawn':
        await this._stageSpawn(stage, context);
        break;
    }
  }

  /* ── Stage 1: Ingest ── */

  async _stageIngest(stage, context) {
    const video = context.video;
    const steps = 3;

    for (let s = 0; s < steps; s++) {
      await this._delay(50);
      stage.progress = Math.round(((s + 1) / steps) * 100);
      this._updateOverallProgress();
      this._notify();
    }

    console.log(`📁 Ingested: ${video.name} (${(video.size / 1024 / 1024).toFixed(1)} MB)`);
  }

  /* ── Stage 2: Extract Frames ── */

  async _stageExtractFrames(stage, context) {
    const video = context.video;
    const extractor = new FrameExtractor({
      maxFrames: 300,
      frameRate: 6,
      maxWidth: 640,
    });

    const frameData = await extractor.extract(video, (pct) => {
      stage.progress = pct;
      this._updateOverallProgress();
      this._notify();
    });

    context.frameData = frameData;
    context.extractor = extractor;

    console.log(`📽️ Extracted ${frameData.frames.length} frames, audio: ${frameData.audioData ? '✅' : '❌'}`);
  }

  /* ── Stage 3: Analyze Scenes ── */

  async _stageAnalyze(stage, context) {
    const analyzer = new SceneAnalyzer();
    const steps = 5;

    for (let s = 0; s < steps; s++) {
      await this._delay(0); // Let analysis run synchronously but track steps
      stage.progress = Math.round(((s + 1) / steps) * 100);
      this._updateOverallProgress();
      this._notify();
    }

    const analysis = analyzer.analyze(context.frameData);
    context.sceneAnalysis = analysis;

    console.log(`🔍 Analyzed: ${analysis.totalShots} shots, ${analysis.totalScenes} scenes`);
  }

  /* ── Stage 4: Detect Objects ── */

  async _stageDetectObjects(stage, context) {
    const steps = 5;
    for (let s = 0; s < steps; s++) {
      await this._delay(80);
      stage.progress = Math.round(((s + 1) / steps) * 100);
      this._updateOverallProgress();
      this._notify();
    }

    // Motion-based object detection using frame data
    context.detectedObjects = [];
    const motion = context.sceneAnalysis.motion;
    const highMotionFrames = motion.filter(m => m.intensity > 0.15);

    // Group high-motion events into detected "objects"
    const clusters = [];
    let currentCluster = null;
    for (const m of highMotionFrames) {
      if (!currentCluster || m.frameIndex - currentCluster.lastFrame > 5) {
        currentCluster = { startFrame: m.frameIndex, lastFrame: m.frameIndex, count: 1, maxIntensity: m.intensity };
        clusters.push(currentCluster);
      } else {
        currentCluster.lastFrame = m.frameIndex;
        currentCluster.count++;
        currentCluster.maxIntensity = Math.max(currentCluster.maxIntensity, m.intensity);
      }
    }

    context.detectedObjects = clusters.filter(c => c.count > 3).map((c, idx) => ({
      id: `obj_${idx}`,
      type: c.maxIntensity > 0.3 ? 'moving_character' : 'ambient_motion',
      confidence: Math.min(1, c.maxIntensity * 2),
      startFrame: c.startFrame,
      endFrame: c.lastFrame,
      tracked: false,
    }));

    console.log(`🔎 Detected ${context.detectedObjects.length} objects from motion analysis`);
  }

  /* ── Stage 5: Track Characters ── */

  async _stageTrackCharacters(stage, context) {
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      await this._delay(60);
      stage.progress = Math.round(((s + 1) / steps) * 100);
      this._updateOverallProgress();
      this._notify();
    }

    // Tag detected objects as "tracked" and assign to scenes
    const scenes = context.sceneAnalysis.scenes;
    context.trackedCharacters = context.detectedObjects.map((obj, idx) => {
      // Find which scene this object belongs to
      let sceneId = scenes[0]?.id || 'scene_0';
      for (const scene of scenes) {
        const frame = context.frameData.frames[obj.startFrame];
        if (frame && frame.timestamp >= scene.startTime && frame.timestamp <= scene.endTime) {
          sceneId = scene.id;
          break;
        }
      }

      return {
        id: `char_tracked_${idx}`,
        objectId: obj.id,
        name: `Character ${idx + 1}`,
        sceneId,
        confidence: obj.confidence,
        isMoving: obj.type === 'moving_character',
        tracked: true,
      };
    });

    console.log(`🗺️ Tracked ${context.trackedCharacters.length} characters across scenes`);
  }

  /* ── Stage 6: Transcribe Audio ── */

  async _stageTranscribe(stage, context) {
    const audioProcessor = new AudioProcessor();
    const steps = 4;

    for (let s = 0; s < steps; s++) {
      await this._delay(50);
      stage.progress = Math.round(((s + 1) / steps) * 100);
      this._updateOverallProgress();
      this._notify();
    }

    const audioResult = await audioProcessor.process(
      context.frameData.audioData,
      context.frameData,
      (pct) => {
        stage.progress = 50 + Math.round(pct * 0.5);
        this._updateOverallProgress();
        this._notify();
      }
    );

    context.audioResult = audioResult;
    console.log(`🎙️ Transcribed: ${audioResult.segments.length} segments, ${audioResult.wordCount || 0} words`);
  }

  /* ── Stage 7: Reconstruct 3D ── */

  async _stageReconstruct(stage, context) {
    const generator = new WorldGenerator();
    const steps = 6;

    for (let s = 0; s < steps; s++) {
      await this._delay(30);
      stage.progress = Math.round(((s + 1) / steps) * 100);
      this._updateOverallProgress();
      this._notify();
    }

    const world = generator.generate(
      context.videoSource,
      context.frameData,
      context.sceneAnalysis,
      context.audioResult
    );

    context.world = world;
    context.world.characters = context.trackedCharacters || [];

    console.log(`🏗️ 3D world reconstructed: ${world.sceneGraph.nodes.length} nodes`);
  }

  /* ── Stage 8: Build World ── */

  async _stageBuild(stage, context) {
    // World building is done by the SceneEngine when the game starts
    // Here we just prepare metadata
    const steps = 3;

    for (let s = 0; s < steps; s++) {
      await this._delay(30);
      stage.progress = Math.round(((s + 1) / steps) * 100);
      this._updateOverallProgress();
      this._notify();
    }

    // The world is already built in context.world by stage 7.
    // At this point we could export glTF or other formats.
    console.log(`📦 World ready for spawning: ${context.world.name}`);
  }

  /* ── Stage 9: Spawn ── */

  async _stageSpawn(stage, context) {
    const steps = 2;
    for (let s = 0; s < steps; s++) {
      await this._delay(20);
      stage.progress = Math.round(((s + 1) / steps) * 100);
      this._updateOverallProgress();
      this._notify();
    }

    console.log('🎮 World spawned! Ready to drop the player in.');
  }

  /* ── Progress ── */

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