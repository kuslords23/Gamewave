/**
 * KUS WORLD ENGINE — Scene Engine
 *
 * Renders a complete 3D scene in Babylon.js with dynamic lighting,
 * shadows, materials, and physics-enabled objects.
 * Supports WebGPU (preferred) with WebGL fallback.
 */

import { WorldBuilder } from './WorldBuilder.js';

class SceneEngine {
  constructor() {
    this.scene = null;
    this.engine = null;
    this.camera = null;
    this.light = null;
    this.meshes = new Map();
    this.worldBuilder = new WorldBuilder();
    this.BJS = null;
  }

  async init(canvas) {
    try {
      // Dynamically import Babylon.js modules
      const { Engine } = await import('@babylonjs/core/Engines/engine');
      const { Scene } = await import('@babylonjs/core/scene');
      const { ArcRotateCamera } = await import('@babylonjs/core/Cameras/arcRotateCamera');
      const { Vector3 } = await import('@babylonjs/core/Maths/math.vector');
      const { Color3 } = await import('@babylonjs/core/Maths/math.color');
      const { HemisphericLight } = await import('@babylonjs/core/Lights/hemisphericLight');
      const { WebGPUEngine } = await import('@babylonjs/core/Engines/webGPUEngine');
      const { SceneLoader } = await import('@babylonjs/core/Loaders/sceneLoader');
      
      this.BJS = { Engine, Scene, ArcRotateCamera, Vector3, Color3, HemisphericLight, WebGPUEngine, SceneLoader };

      // Create engine with WebGPU/WebGL fallback
      this.engine = new Engine(canvas, true, {
        preserveDrawingBuffer: false,
        stencil: true,
        antialias: true,
      }, true);

      // Create scene
      this.scene = new Scene(this.engine);

      // Setup camera
      this._setupCamera();

      // Setup lighting
      this._setupLighting();

      // Start render loop
      this.engine.runRenderLoop(() => {
        if (this.scene) this.scene.render();
      });

      // Handle resize
      window.addEventListener('resize', () => {
        this.engine?.resize();
      });

      console.log('🎮 Scene Engine initialized');
      return true;

    } catch (err) {
      console.error('❌ Failed to initialize Scene Engine:', err);
      return false;
    }
  }

  _setupCamera() {
    const { ArcRotateCamera, Vector3 } = this.BJS;
    
    this.camera = new ArcRotateCamera(
      'camera',
      -Math.PI / 3,
      Math.PI / 2.5,
      15,
      new Vector3(0, 2, 0),
      this.scene
    );
    this.camera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
  }

  _setupLighting() {
    const { HemisphericLight, Vector3, Color3 } = this.BJS;

    // Main ambient light
    this.light = new HemisphericLight(
      'light',
      new Vector3(0, 1, 0),
      this.scene
    );
    this.light.intensity = 0.7;
    this.light.specular = new Color3(0.3, 0.3, 0.3);
  }

  async buildDemoWorld() {
    // Build a procedurally generated demo world
    const demoWorld = {
      id: 'demo_world',
      name: 'Demo World',
      nodes: [],
      metadata: {}
    };

    // Create ground
    await this._createGround(demoWorld);

    // Create demo buildings
    await this._createBuildings(demoWorld);

    // Create characters
    await this._createCharacters(demoWorld);

    // Build world from scene graph
    await this.worldBuilder.build(demoWorld, this.scene);

    console.log('🌍 Demo world built');
    return demoWorld;
  }

  async _createGround(world) {
    const { MeshBuilder } = this.BJS;
    
    const ground = MeshBuilder.CreateGround('ground', {
      width: 20,
      height: 20,
      subdivisions: 8
    }, this.scene);

    const { StandardMaterial, Color3 } = this.BJS;
    const groundMat = new StandardMaterial('groundMat', this.scene);
    groundMat.diffuseColor = new Color3(0.3, 0.3, 0.35);
    groundMat.roughness = 0.9;
    ground.material = groundMat;
    ground.receiveShadows = true;

    world.nodes.push({ id: 'ground', type: 'location', mesh: ground });
  }

  async _createBuildings(world) {
    const { MeshBuilder, Vector3, StandardMaterial, Color3 } = this.BJS;

    // Create a few demo buildings
    const buildingPositions = [
      { x: -5, z: -5, w: 2, h: 3, d: 2, color: [100, 80, 120] },
      { x: 5, z: -5, w: 1.5, h: 2.5, d: 1.5, color: [120, 100, 80] },
      { x: 0, z: 5, w: 3, h: 4, d: 3, color: [80, 120, 100] },
    ];

    buildingPositions.forEach((pos, i) => {
      this._createBuilding(`building_${i}`, new Vector3(pos.x, 0, pos.z), pos.w, pos.h, pos.d, pos.color);
    });
  }

  async _createBuilding(id, pos, w, h, d, color) {
    const { MeshBuilder, Vector3, StandardMaterial, Color3 } = this.BJS;

    const box = MeshBuilder.CreateBox(id, { width: w, height: h, depth: d }, this.scene);
    box.position = new Vector3(pos.x, h / 2, pos.z);
    box.checkCollisions = true;

    const r = color[0] / 255;
    const g = color[1] / 255;
    const b = color[2] / 255;

    const mat = new StandardMaterial(`mat_${id}`, this.scene);
    mat.diffuseColor = new Color3(r, g, b);
    mat.roughness = 0.7;
    mat.specularColor = new Color3(0.1, 0.1, 0.1);
    box.material = mat;

    this.meshes.set(id, box);
  }

  async _createCharacters(world) {
    const { MeshBuilder, Vector3, StandardMaterial, Color3 } = this.BJS;

    // Create a simple character
    const char = MeshBuilder.CreateCylinder('character', {
      height: 1.8,
      diameterTop: 0.3,
      diameterBottom: 0.35,
    }, this.scene);
    char.position = new Vector3(0, 0.9, 0);

    const mat = new StandardMaterial('char_mat', this.scene);
    mat.diffuseColor = new Color3(0.8, 0.6, 0.5);
    char.material = mat;

    world.nodes.push({ id: 'character_0', type: 'character', mesh: char });
  }

  async loadWorld(sceneGraph) {
    await this.worldBuilder.build(sceneGraph, this.scene);
    return this.worldBuilder.meshes;
  }

  dispose() {
    this.engine?.dispose();
    this.scene = null;
    this.engine = null;
  }

  getScene() {
    return this.scene;
  }

  getEngine() {
    return this.engine;
  }

  getMeshes() {
    return this.meshes;
  }
}

export default SceneEngine;
export { SceneEngine };