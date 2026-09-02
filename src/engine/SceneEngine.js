/**
 * KUS WORLD ENGINE — Scene Engine (Babylon.js)
 *
 * Manages the 3D scene lifecycle:
 * - Creates Babylon.js engine with WebGPU/WebGL
 * - Builds worlds from scene graphs via WorldBuilder
 * - Handles camera, lighting, and rendering loop
 * - Fallback to procedural demo world when no scene graph provided
 */

import { WorldBuilder } from './WorldBuilder.js';

const DEFAULT_CONFIG = {
  canvasId: 'gameCanvas',
  enableWebGPU: true,
  antialias: true,
  adaptive: true,
};

class SceneEngine {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.engine = null;
    this.scene = null;
    this.camera = null;
    this.onFrameCallbacks = [];
    this.shadowGenerator = null;
    this.meshes = new Map();
    this.fpsCounter = 0;
    this.lastFpsUpdate = 0;
    this.frameCount = 0;
    this.worldBuilder = new WorldBuilder();
    this.shadowCasterMeshes = [];
  }

  /* ── Initialization ── */

  async init(canvas) {
    canvas = canvas || document.getElementById(this.config.canvasId);
    if (!canvas) throw new Error('Canvas element not found');

    const { Engine } = await import('@babylonjs/core/Engines/engine');
    const { WebGPUEngine } = await import('@babylonjs/core/Engines/webgpuEngine');

    let engine;
    try {
      if (this.config.enableWebGPU && typeof navigator.gpu !== 'undefined') {
        const webgpu = new WebGPUEngine(canvas);
        await webgpu.initAsync();
        engine = webgpu;
        console.log('🎮 WebGPU initialized');
      } else {
        engine = new Engine(canvas, this.config.antialias, {
          adaptToDeviceRatio: this.config.adaptive,
        });
        console.log('🎮 WebGL initialized');
      }
    } catch {
      engine = new Engine(canvas, this.config.antialias, {
        adaptToDeviceRatio: this.config.adaptive,
      });
      console.log('🎮 WebGL initialized (fallback)');
    }

    this.engine = engine;
    const { Scene } = await import('@babylonjs/core/scene');
    this.scene = new Scene(engine);
    const { Color4, Color3 } = await import('@babylonjs/core/Maths/math.color');
    this.scene.clearColor = new Color4(0.05, 0.05, 0.08, 1.0);
    this.scene.ambientColor = new Color3(0.3, 0.3, 0.35);

    await this.setupLighting();
    await this.setupCamera(canvas);

    // Render loop
    engine.runRenderLoop(() => {
      this.scene.render();
      this.frameCount++;

      const now = performance.now();
      if (now - this.lastFpsUpdate > 1000) {
        this.fpsCounter = this.frameCount;
        this.frameCount = 0;
        this.lastFpsUpdate = now;
        const fpsEl = document.getElementById('fpsCounter');
        if (fpsEl) fpsEl.textContent = `${this.fpsCounter} FPS`;
      }

      this.onFrameCallbacks.forEach(cb => cb());
    });

    window.addEventListener('resize', () => this.engine?.resize());
  }

  /* ── Camera ── */

  async setupCamera(canvas) {
    const { FreeCamera } = await import('@babylonjs/core/Cameras/freeCamera');
    const { Vector3 } = await import('@babylonjs/core/Maths/math.vector');

    const camera = new FreeCamera('playerCamera', new Vector3(0, 2, -8), this.scene);
    camera.setTarget(Vector3.Zero());
    camera.attachControl(canvas, true);
    camera.speed = 0.15;
    camera.minZ = 0.1;
    camera.maxZ = 1000;
    camera.fov = 0.857;
    camera.keysUp = [87];
    camera.keysDown = [83];
    camera.keysLeft = [65];
    camera.keysRight = [68];
    camera.keysUpward = [81];
    camera.keysDownward = [69];
    camera.checkCollisions = true;

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') camera.speed = 0.35;
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') camera.speed = 0.15;
    });

    this.camera = camera;
  }

  /* ── Lighting ── */

  async setupLighting() {
    const { HemisphericLight, DirectionalLight } = await import('@babylonjs/core/Lights/light');
    const { Vector3 } = await import('@babylonjs/core/Maths/math.vector');
    const { Color3 } = await import('@babylonjs/core/Maths/math.color');
    const { ShadowGenerator } = await import('@babylonjs/core/Lights/Shadows/shadowGenerator');

    const hemi = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), this.scene);
    hemi.intensity = 0.6;
    hemi.diffuse = new Color3(0.8, 0.8, 1.0);
    hemi.groundColor = new Color3(0.2, 0.2, 0.3);

    const sun = new DirectionalLight('sunLight', new Vector3(-0.5, -1, -0.3), this.scene);
    sun.intensity = 0.8;
    sun.diffuse = new Color3(1, 0.95, 0.85);

    this.shadowGenerator = new ShadowGenerator(2048, sun);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 32;
  }

  /* ════════════════════════════════════════
     WORLD BUILDING
     ════════════════════════════════════════ */

  /**
   * Build a world from a scene graph (reconstructed from video)
   */
  async buildFromSceneGraph(sceneGraph) {
    console.log(`🏗️ Building world from scene graph: "${sceneGraph.name}"`);
    const meshes = await this.worldBuilder.build(sceneGraph, this.scene);

    // Store references
    meshes.forEach((mesh, id) => {
      this.meshes.set(id, mesh);
      if (id !== 'ground') {
        this.shadowCasterMeshes.push(mesh);
      }
    });

    // Enable shadows
    this.shadowCasterMeshes.forEach(mesh => {
      this.shadowGenerator?.addShadowCaster(mesh);
    });

    // Center camera on the world
    if (this.camera) {
      const { Vector3 } = await import('@babylonjs/core/Maths/math.vector');
      this.camera.position = new Vector3(0, 5, -12);
      this.camera.setTarget(Vector3.Zero());
    }

    console.log(`✅ World built: ${this.meshes.size} meshes total`);
  }

  /**
   * Build a demo world (fallback when no scene graph available)
   * Used for testing/development
   */
  async buildDemoWorld() {
    const { Vector3 } = await import('@babylonjs/core/Maths/math.vector');
    const { Color3 } = await import('@babylonjs/core/Maths/math.color');
    const { MeshBuilder } = await import('@babylonjs/core/Meshes/meshBuilder');
    const { StandardMaterial } = await import('@babylonjs/core/Materials/standardMaterial');

    // Ground
    const ground = MeshBuilder.CreateGround('ground', {
      width: 30, height: 30, subdivisions: 4,
    }, this.scene);
    const groundMat = new StandardMaterial('groundMat', this.scene);
    groundMat.diffuseColor = new Color3(0.12, 0.12, 0.18);
    groundMat.specularColor = new Color3(0.02, 0.02, 0.04);
    groundMat.roughness = 0.8;
    ground.material = groundMat;
    ground.receiveShadows = true;
    ground.checkCollisions = true;
    this.meshes.set('ground', ground);

    // Grid
    for (let i = -15; i <= 15; i++) {
      const line = MeshBuilder.CreateLines(`grid_h_${i}`, {
        points: [new Vector3(-15, 0.01, i), new Vector3(15, 0.01, i)],
      }, this.scene);
      line.color = new Color3(0.2, 0.2, 0.3);

      const lineV = MeshBuilder.CreateLines(`grid_v_${i}`, {
        points: [new Vector3(i, 0.01, -15), new Vector3(i, 0.01, 15)],
      }, this.scene);
      lineV.color = new Color3(0.2, 0.2, 0.3);
    }

    // Buildings
    await this.createBuilding('building_main', new Vector3(-3, 0, -2), 2, 4, 2, 0x445566);
    await this.createBuilding('building_left', new Vector3(-6, 0, 2), 1.5, 3, 1.5, 0x556677);
    await this.createBuilding('building_right', new Vector3(3, 0, -1), 2.5, 3.5, 1.8, 0x334455);
    await this.createBuilding('building_corner', new Vector3(5, 0, 3), 1.8, 2.5, 1.8, 0x667788);

    // Lamps, trees, props
    await Promise.all([
      this.createLamp('lamp_1', new Vector3(-1, 0, 4)),
      this.createLamp('lamp_2', new Vector3(2, 0, -4)),
      this.createLamp('lamp_3', new Vector3(-4, 0, -3)),
      this.createTree('tree_1', new Vector3(-7, 0, -2)),
      this.createTree('tree_2', new Vector3(6, 0, -1.5)),
      this.createTree('tree_3', new Vector3(-5, 0, 4)),
      this.createTree('tree_4', new Vector3(4, 0, 4.5)),
      this.createCharacter('npc_1', new Vector3(-2, 0, 1), 0xCC8899),
      this.createCharacter('npc_2', new Vector3(4, 0, -2), 0x99CC88),
      this.createCharacter('npc_3', new Vector3(-1, 0, -4), 0x8899CC),
    ]);

    // Enable shadows
    this.meshes.forEach((mesh, key) => {
      if (key !== 'ground') {
        this.shadowGenerator?.addShadowCaster(mesh);
      }
    });

    console.log('🌍 Demo world built successfully');
  }

  /* ── Mesh Factories ── */

  async createBuilding(id, pos, w, h, d, color) {
    const { MeshBuilder } = await import('@babylonjs/core/Meshes/meshBuilder');
    const { StandardMaterial } = await import('@babylonjs/core/Materials/standardMaterial');
    const { Color3, Vector3 } = await import('@babylonjs/core/Maths/math');

    const box = MeshBuilder.CreateBox(id, { width: w, height: h, depth: d }, this.scene);
    box.position = pos.clone();
    box.position.y += h / 2;
    box.checkCollisions = true;

    const r = ((color >> 16) & 0xFF) / 255;
    const g = ((color >> 8) & 0xFF) / 255;
    const b = (color & 0xFF) / 255;

    const mat = new StandardMaterial(`mat_${id}`, this.scene);
    mat.diffuseColor = new Color3(r, g, b);
    mat.roughness = 0.7;
    mat.specularColor = new Color3(0.1, 0.1, 0.1);
    box.material = mat;
    this.meshes.set(id, box);
  }

  async createTree(id, pos) {
    const { MeshBuilder } = await import('@babylonjs/core/Meshes/meshBuilder');
    const { StandardMaterial } = await import('@babylonjs/core/Materials/standardMaterial');
    const { Color3 } = await import('@babylonjs/core/Maths/math.color');

    const trunk = MeshBuilder.CreateCylinder(`${id}_trunk`, {
      height: 1.2, diameterTop: 0.12, diameterBottom: 0.2,
    }, this.scene);
    trunk.position = pos.clone();
    trunk.position.y += 0.6;
    trunk.checkCollisions = true;

    const trunkMat = new StandardMaterial(`${id}_trunk_mat`, this.scene);
    trunkMat.diffuseColor = new Color3(0.35, 0.25, 0.15);
    trunk.material = trunkMat;

    const foliage = MeshBuilder.CreateSphere(`${id}_foliage`, {
      diameter: 1.5, segments: 8,
    }, this.scene);
    foliage.position = pos.clone();
    foliage.position.y += 1.6;

    const foliageMat = new StandardMaterial(`${id}_foliage_mat`, this.scene);
    foliageMat.diffuseColor = new Color3(0.15, 0.35, 0.15);
    foliageMat.specularColor = new Color3(0.01, 0.02, 0.01);
    foliage.material = foliageMat;

    this.meshes.set(id, trunk);
  }

  async createLamp(id, pos) {
    const { MeshBuilder } = await import('@babylonjs/core/Meshes/meshBuilder');
    const { StandardMaterial } = await import('@babylonjs/core/Materials/standardMaterial');
    const { Color3 } = await import('@babylonjs/core/Maths/math.color');

    const pole = MeshBuilder.CreateCylinder(`${id}_pole`, {
      height: 2.5, diameterTop: 0.05, diameterBottom: 0.08,
    }, this.scene);
    pole.position = pos.clone();
    pole.position.y += 1.25;
    pole.checkCollisions = true;

    const poleMat = new StandardMaterial(`${id}_pole_mat`, this.scene);
    poleMat.diffuseColor = new Color3(0.15, 0.15, 0.2);
    pole.material = poleMat;

    const bulb = MeshBuilder.CreateSphere(`${id}_bulb`, { diameter: 0.15 }, this.scene);
    bulb.position = pos.clone();
    bulb.position.y += 2.5;

    const bulbMat = new StandardMaterial(`${id}_bulb_mat`, this.scene);
    bulbMat.emissiveColor = new Color3(1, 0.95, 0.7);
    bulbMat.diffuseColor = new Color3(1, 0.95, 0.8);
    bulb.material = bulbMat;

    this.meshes.set(id, pole);
  }

  async createCharacter(id, pos, color) {
    const { MeshBuilder } = await import('@babylonjs/core/Meshes/meshBuilder');
    const { StandardMaterial } = await import('@babylonjs/core/Materials/standardMaterial');
    const { Color3 } = await import('@babylonjs/core/Maths/math.color');

    const body = MeshBuilder.CreateCylinder(`${id}_body`, {
      height: 1.2, diameterTop: 0.3, diameterBottom: 0.35,
    }, this.scene);
    body.position = pos.clone();
    body.position.y += 0.6;

    const head = MeshBuilder.CreateSphere(`${id}_head`, { diameter: 0.25 }, this.scene);
    head.position = pos.clone();
    head.position.y += 1.3;

    const r = ((color >> 16) & 0xFF) / 255;
    const g = ((color >> 8) & 0xFF) / 255;
    const b = (color & 0xFF) / 255;

    const bodyMat = new StandardMaterial(`${id}_body_mat`, this.scene);
    bodyMat.diffuseColor = new Color3(r, g, b);
    body.material = bodyMat;

    const headMat = new StandardMaterial(`${id}_head_mat`, this.scene);
    headMat.diffuseColor = new Color3(0.9, 0.8, 0.7);
    head.material = headMat;

    this.meshes.set(id, body);
  }

  /* ── Controls ── */

  getPlayerState() {
    if (!this.camera) {
      return { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, speed: 0, sprintMultiplier: 1, grounded: true, currentScene: '' };
    }
    return {
      position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      rotation: { x: this.camera.rotation.x, y: this.camera.rotation.y, z: this.camera.rotation.z },
      speed: this.camera.speed,
      sprintMultiplier: this.camera.speed > 0.25 ? 2 : 1,
      grounded: this.camera.position.y <= 0.1,
      currentScene: 'main_world',
    };
  }

  onFrame(cb) {
    this.onFrameCallbacks.push(cb);
    return () => {
      this.onFrameCallbacks = this.onFrameCallbacks.filter(fn => fn !== cb);
    };
  }

  getFPS() {
    return this.fpsCounter;
  }

  dispose() {
    this.onFrameCallbacks = [];
    this.engine?.dispose();
    this.engine = null;
    this.scene = null;
  }
}

export default SceneEngine;
export { SceneEngine };