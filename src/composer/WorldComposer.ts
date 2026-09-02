import { SceneSpec, SceneGraph, WorldNode, LocationDescription } from '../types/scene';

/**
 * World Composer
 * Combines real geo base + generated movie assets into scene graph for Babylon.js
 */
export class WorldComposer {
  private static instance: WorldComposer;
  private engine: 'babylonjs' | 'threejs' | 'unity';

  private constructor(engine: 'babylonjs' | 'threejs' | 'unity' = 'babylonjs') {
    this.engine = engine;
  }

  public static getInstance(engine?: 'babylonjs' | 'threejs' | 'unity'): WorldComposer {
    if (!WorldComposer.instance) {
      WorldComposer.instance = new WorldComposer(engine);
    }
    return WorldComposer.instance;
  }

  /**
   * Set rendering engine
   */
  public setEngine(engine: 'babylonjs' | 'threejs' | 'unity'): void {
    this.engine = engine;
  }

  /**
   * Compose scene from SceneSpec
   */
  public compose(scene: SceneSpec, generatedAssets: string[] = []): SceneGraph {
    const rootNode = this.buildSceneGraph(scene, generatedAssets);

    return {
      sceneId: scene.id,
      rootNode,
      geoBase: scene.location,
      generatedAssets,
      metadata: {
        generatedAt: new Date(),
        engine: this.engine,
        version: '1.0.0',
      },
    };
  }

  /**
   * Build hierarchical scene graph
   */
  public buildSceneGraph(scene: SceneSpec, assets: string[]): WorldNode {
    const rootNode: WorldNode = {
      id: `root_${scene.id}`,
      type: 'location',
      position: {
        lat: scene.location.realWorld.lat,
        lng: scene.location.realWorld.lng,
      },
      metadata: {
        address: scene.location.realWorld.address,
        description: scene.location.description,
      },
      children: [],
    };

    // Add ground/terrain node
    rootNode.children!.push(this.createTerrainNode(scene));

    // Add lighting node
    rootNode.children!.push(this.createLightingNode(scene));

    // Add camera node
    rootNode.children!.push(this.createCameraNode(scene));

    // Add character nodes
    scene.characters.forEach(char => {
      rootNode.children!.push(this.createCharacterNode(char, scene));
    });

    // Add prop nodes from generated assets
    assets.forEach((asset, index) => {
      rootNode.children!.push(this.createPropNode(asset, scene, index));
    });

    // Add event triggers
    rootNode.children!.push(this.createEventTriggersNode(scene));

    return rootNode;
  }

  /**
   * Create terrain/ground node
   */
  private createTerrainNode(scene: SceneSpec): WorldNode {
    return {
      id: `terrain_${scene.id}`,
      type: 'prop',
      position: { lat: scene.location.realWorld.lat, lng: scene.location.realWorld.lng },
      scale: 1.0,
      metadata: {
        meshType: 'terrain',
        heightMap: null,
        material: 'default_ground',
      },
    };
  }

  /**
   * Create lighting node
   */
  private createLightingNode(scene: SceneSpec): WorldNode {
    return {
      id: `lighting_${scene.id}`,
      type: 'light',
      position: { lat: 0, lng: 0 }, // Ambient light has no position
      metadata: {
        type: 'ambient',
        intensity: 0.7,
        color: '#ffffff',
        shadows: true,
      },
    };
  }

  /**
   * Create camera node
   */
  private createCameraNode(scene: SceneSpec): WorldNode {
    return {
      id: `camera_${scene.id}`,
      type: 'camera',
      position: { lat: 0, lng: 5 }, // Slightly elevated
      rotation: { x: -0.5, y: 0, z: 0 }, // Looking down slightly
      metadata: {
        fov: 0.8,
        nearClip: 0.1,
        farClip: 1000,
        mode: 'follow', // 'static' | 'follow' | 'cinematic'
      },
    };
  }

  /**
   * Create character node
   */
  private createCharacterNode(char: Scene['characters'][0], scene: SceneSpec): WorldNode {
    const position = char.position || {
      lat: scene.location.realWorld.lat + (Math.random() - 0.5) * 0.001,
      lng: scene.location.realWorld.lng + (Math.random() - 0.5) * 0.001,
    };

    return {
      id: char.id,
      type: 'character',
      position,
      rotation: { x: 0, y: Math.random() * Math.PI * 2, z: 0 },
      scale: 1.0,
      metadata: {
        name: char.name,
        description: char.description,
        model: char.assets?.[0] || 'default_npc',
        animations: ['idle', 'walk', 'talk'],
      },
    };
  }

  /**
   * Create prop node from asset
   */
  private createPropNode(asset: string, scene: SceneSpec, index: number): WorldNode {
    const angle = (index / 8) * Math.PI * 2;
    const radius = 0.0005;

    return {
      id: `prop_${index}_${asset}`,
      type: 'prop',
      position: {
        lat: scene.location.realWorld.lat + Math.cos(angle) * radius,
        lng: scene.location.realWorld.lng + Math.sin(angle) * radius,
      },
      rotation: { x: 0, y: angle, z: 0 },
      scale: 1.0,
      metadata: {
        assetPath: asset,
        type: 'generated',
      },
    };
  }

  /**
   * Create event triggers node
   */
  private createEventTriggersNode(scene: SceneSpec): WorldNode {
    return {
      id: `triggers_${scene.id}`,
      type: 'prop',
      position: { lat: 0, lng: 0 },
      metadata: {
        triggers: scene.events.map(event => ({
          id: event.id,
          type: event.type,
          timestamp: event.timestamp,
          data: event.data,
        })),
      },
    };
  }

  /**
   * Export scene graph to engine-specific format
   */
  public export(sceneGraph: SceneGraph): string {
    switch (this.engine) {
      case 'babylonjs':
        return this.exportBabylonJS(sceneGraph);
      case 'threejs':
        return this.exportThreeJS(sceneGraph);
      case 'unity':
        return this.exportUnity(sceneGraph);
      default:
        throw new Error(`Unsupported engine: ${this.engine}`);
    }
  }

  /**
   * Export to Babylon.js JSON format
   */
  private exportBabylonJS(scene: SceneGraph): string {
    return JSON.stringify({
      ...scene,
      metadata: {
        ...scene.metadata,
        engine: 'babylonjs',
        exportFormat: 'babylon',
      },
    }, null, 2);
  }

  /**
   * Export to Three.js compatible format
   */
  private exportThreeJS(scene: SceneGraph): string {
    return JSON.stringify({
      ...scene,
      metadata: {
        ...scene.metadata,
        engine: 'threejs',
        exportFormat: 'gltf',
      },
    }, null, 2);
  }

  /**
   * Export to Unity prefab format (as JSON description)
   */
  private exportUnity(scene: SceneGraph): string {
    return JSON.stringify({
      ...scene,
      metadata: {
        ...scene.metadata,
        engine: 'unity',
        exportFormat: 'prefab',
      },
    }, null, 2);
  }

  /**
   * Validate scene graph integrity
   */
  public validate(sceneGraph: SceneGraph): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!sceneGraph.sceneId) {
      errors.push('Missing scene ID');
    }

    if (!sceneGraph.rootNode) {
      errors.push('Missing root node');
    }

    if (!sceneGraph.geoBase?.realWorld?.lat || !sceneGraph.geoBase?.realWorld?.lng) {
      errors.push('Invalid geo base coordinates');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default WorldComposer;