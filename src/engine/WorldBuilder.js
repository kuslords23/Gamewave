/**
 * KUS WORLD ENGINE — World Builder
 *
 * Converts a scene graph from the WorldGenerator into
 * actual Babylon.js 3D meshes in the scene.
 *
 * Handles all entity types: terrain, structures, characters, props
 * Each type has a specific mesh construction strategy.
 */

class WorldBuilder {
  constructor() {
    this.meshes = new Map();
    this.BJS = null;     // Babylon.js module refs (set during build)
  }

  /**
   * Build a complete 3D world from a scene graph
   * Must be called after Babylon.js scene is initialized
   */
  async build(sceneGraph, babylonScene) {
    this.scene = babylonScene;
    this.meshes.clear();

    // Cache Babylon.js constructors
    this.BJS = {
      Vector3: (await import('@babylonjs/core/Maths/math.vector')).Vector3,
      Color3: (await import('@babylonjs/core/Maths/math.color')).Color3,
      MeshBuilder: (await import('@babylonjs/core/Meshes/meshBuilder')).MeshBuilder,
      StandardMaterial: (await import('@babylonjs/core/Materials/standardMaterial')).StandardMaterial,
    };

    console.log(`🏗️ Building world: ${sceneGraph.name} with ${sceneGraph.nodes.length} nodes`);

    for (const node of sceneGraph.nodes) {
      try {
        switch (node.type) {
          case 'location':
            await this._buildLocationNode(node);
            break;
          case 'character':
            await this._buildCharacterNode(node);
            break;
          case 'prop':
            await this._buildPropNode(node);
            break;
          default:
            console.warn(`Unknown node type: ${node.type}`);
        }
      } catch (err) {
        console.warn(`Failed to build node ${node.id}: ${err.message}`);
      }

      // Yield to browser every 5 nodes
      if (sceneGraph.nodes.indexOf(node) % 5 === 4) {
        await this._delay(0);
      }
    }

    console.log(`✅ World built: ${this.meshes.size} meshes created`);
    return this.meshes;
  }

  /**
   * Build terrain / location node
   */
  async _buildLocationNode(node) {
    const { Vector3, Color3 } = this.BJS;
    const { MeshBuilder } = this.BJS;
    const { StandardMaterial } = this.BJS;

    const width = node.metadata?.width || 30;
    const depth = node.metadata?.depth || 30;
    const color = node.metadata?.color || [30, 30, 45];

    // Ground plane
    const ground = MeshBuilder.CreateGround('ground', {
      width,
      height: depth,
      subdivisions: 8,
    }, this.scene);

    const groundMat = new StandardMaterial('groundMat', this.scene);
    groundMat.diffuseColor = new Color3(
      color[0] / 255 * 0.6,
      color[1] / 255 * 0.6,
      color[2] / 255 * 0.6
    );
    groundMat.specularColor = new Color3(0.02, 0.02, 0.04);
    groundMat.roughness = 0.8;
    ground.material = groundMat;
    ground.receiveShadows = true;
    ground.checkCollisions = true;

    this.meshes.set(node.id, ground);

    // Grid lines
    if (node.metadata?.gridVisible) {
      for (let i = -width / 2; i <= width / 2; i += 2) {
        const line = MeshBuilder.CreateLines(`grid_h_${i}`, {
          points: [
            new Vector3(-width / 2, 0.01, i),
            new Vector3(width / 2, 0.01, i),
          ],
        }, this.scene);
        line.color = new Color3(0.15, 0.15, 0.2);

        const lineV = MeshBuilder.CreateLines(`grid_v_${i}`, {
          points: [
            new Vector3(i, 0.01, -depth / 2),
            new Vector3(i, 0.01, depth / 2),
          ],
        }, this.scene);
        lineV.color = new Color3(0.15, 0.15, 0.2);
      }
    }
  }

  /**
   * Build a structure (building, arena, plaza, etc.)
   */
  async _buildPropNode(node) {
    const { Vector3, Color3 } = this.BJS;
    const { MeshBuilder } = this.BJS;
    const { StandardMaterial } = this.BJS;

    const meshType = node.metadata?.meshType || node.name?.split('_')[0] || 'building';
    const dims = node.metadata?.dimensions || { width: 1.5, height: 2, depth: 1.5 };
    const color = node.metadata?.color || [100, 100, 120];
    const pos = node.position;

    // Choose builder based on type
    switch (meshType) {
      case 'building':
      case 'chamber':
      case 'lounge':
        this._buildBox(node.id, pos, dims, color);
        break;
      case 'plaza':
        this._buildPlaza(node.id, pos, dims, color);
        break;
      case 'arena':
        this._buildArena(node.id, pos, dims, color);
        break;
      case 'tree':
        this._buildTree(node.id, pos);
        break;
      case 'table':
        this._buildBox(node.id, pos, dims, [139, 90, 43]);
        break;
      case 'chair':
        this._buildChair(node.id, pos);
        break;
      case 'lamp':
      case 'lamp_post':
        this._buildLamp(node.id, pos);
        break;
      case 'bench':
        this._buildBox(node.id, pos, dims, [139, 105, 20]);
        break;
      case 'barrier':
        this._buildBox(node.id, pos, dims, [200, 150, 50]);
        break;
      case 'sign':
        this._buildSign(node.id, pos, dims, color);
        break;
      case 'planter':
        this._buildPlanter(node.id, pos, dims);
        break;
      default:
        this._buildBox(node.id, pos, dims, color);
    }
  }

  /**
   * Build a character from scene graph node
   */
  async _buildCharacterNode(node) {
    const { Vector3, Color3 } = this.BJS;
    const { MeshBuilder } = this.BJS;
    const { StandardMaterial } = this.BJS;

    const pos = node.position;
    const rotation = node.rotation || { x: 0, y: 0, z: 0 };
    const scale = node.scale || 1;
    const skin = node.metadata?.skinColor || [220, 190, 160];
    const clothing = node.metadata?.clothingColor || [100, 80, 120];

    const id = node.id;

    // Body
    const body = MeshBuilder.CreateCylinder(`${id}_body`, {
      height: 1.2 * scale,
      diameterTop: 0.3 * scale,
      diameterBottom: 0.35 * scale,
    }, this.scene);
    body.position = new Vector3(pos.x, 0.6 * scale, pos.z);
    body.rotation.y = rotation.y;

    const bodyMat = new StandardMaterial(`${id}_body_mat`, this.scene);
    bodyMat.diffuseColor = new Color3(
      clothing[0] / 255,
      clothing[1] / 255,
      clothing[2] / 255
    );
    body.material = bodyMat;

    // Head
    const head = MeshBuilder.CreateSphere(`${id}_head`, {
      diameter: 0.25 * scale,
    }, this.scene);
    head.position = new Vector3(pos.x, 1.3 * scale, pos.z);

    const headMat = new StandardMaterial(`${id}_head_mat`, this.scene);
    headMat.diffuseColor = new Color3(
      skin[0] / 255,
      skin[1] / 255,
      skin[2] / 255
    );
    head.material = headMat;

    this.meshes.set(id, body);
  }

  /* ── Sub-builders ── */

  _buildBox(id, pos, dims, color) {
    const { Vector3, Color3 } = this.BJS;
    const { MeshBuilder } = this.BJS;
    const { StandardMaterial } = this.BJS;

    const box = MeshBuilder.CreateBox(id, {
      width: dims.width,
      height: dims.height,
      depth: dims.depth,
    }, this.scene);
    box.position = new Vector3(pos.x, dims.height / 2, pos.z);
    box.checkCollisions = true;

    const mat = new StandardMaterial(`mat_${id}`, this.scene);
    mat.diffuseColor = new Color3(
      color[0] / 255,
      color[1] / 255,
      color[2] / 255
    );
    mat.roughness = 0.7;
    mat.specularColor = new Color3(0.05, 0.05, 0.05);
    box.material = mat;

    this.meshes.set(id, box);
  }

  _buildPlaza(id, pos, dims, color) {
    const { Vector3, Color3 } = this.BJS;
    const { MeshBuilder } = this.BJS;
    const { StandardMaterial } = this.BJS;

    // Low, wide platform
    const platform = MeshBuilder.CreateCylinder(`${id}_platform`, {
      height: 0.3,
      diameterTop: Math.max(dims.width, dims.depth) * 1.5,
      diameterBottom: Math.max(dims.width, dims.depth) * 1.5,
    }, this.scene);
    platform.position = new Vector3(pos.x, 0.15, pos.z);

    const mat = new StandardMaterial(`mat_${id}`, this.scene);
    mat.diffuseColor = new Color3(
      color[0] / 255 * 1.2,
      color[1] / 255 * 1.2,
      color[2] / 255 * 1.2
    );
    mat.roughness = 0.9;
    platform.material = mat;

    this.meshes.set(id, platform);
  }

  _buildArena(id, pos, dims, color) {
    const { Vector3, Color3 } = this.BJS;
    const { MeshBuilder } = this.BJS;
    const { StandardMaterial } = this.BJS;

    // Ring wall
    const wall = MeshBuilder.CreateCylinder(`${id}_wall`, {
      height: 0.8,
      diameterTop: Math.max(dims.width, dims.depth) * 1.2,
      diameterBottom: Math.max(dims.width, dims.depth) * 1.2,
    }, this.scene);
    wall.position = new Vector3(pos.x, 1.6, pos.z);

    // Inner floor
    const floor = MeshBuilder.CreateCylinder(`${id}_floor`, {
      height: 0.1,
      diameterTop: Math.max(dims.width, dims.depth) * 1.0,
      diameterBottom: Math.max(dims.width, dims.depth) * 1.0,
    }, this.scene);
    floor.position = new Vector3(pos.x, 1.21, pos.z);

    const wallMat = new StandardMaterial(`${id}_wall_mat`, this.scene);
    wallMat.diffuseColor = new Color3(
      color[0] / 255,
      color[1] / 255,
      color[2] / 255
    );
    wallMat.wireframe = true;
    wall.material = wallMat;

    const floorMat = new StandardMaterial(`${id}_floor_mat`, this.scene);
    floorMat.diffuseColor = new Color3(0.1, 0.1, 0.15);
    floor.material = floorMat;

    this.meshes.set(id, wall);
  }

  _buildTree(id, pos) {
    const { Vector3, Color3 } = this.BJS;
    const { MeshBuilder } = this.BJS;
    const { StandardMaterial } = this.BJS;

    const trunk = MeshBuilder.CreateCylinder(`${id}_trunk`, {
      height: 1.2,
      diameterTop: 0.12,
      diameterBottom: 0.2,
    }, this.scene);
    trunk.position = new Vector3(pos.x, 0.6, pos.z);

    const trunkMat = new StandardMaterial(`${id}_trunk_mat`, this.scene);
    trunkMat.diffuseColor = new Color3(0.35, 0.25, 0.15);
    trunk.material = trunkMat;
    trunk.checkCollisions = true;

    const foliage = MeshBuilder.CreateSphere(`${id}_foliage`, {
      diameter: 1.5,
      segments: 8,
    }, this.scene);
    foliage.position = new Vector3(pos.x, 1.6, pos.z);

    const foliageMat = new StandardMaterial(`${id}_foliage_mat`, this.scene);
    foliageMat.diffuseColor = new Color3(0.15, 0.35, 0.15);
    foliage.material = foliageMat;

    this.meshes.set(id, trunk);
  }

  _buildChair(id, pos) {
    const { Vector3, Color3 } = this.BJS;
    const { MeshBuilder } = this.BJS;
    const { StandardMaterial } = this.BJS;

    // Seat
    const seat = MeshBuilder.CreateBox(`${id}_seat`, {
      width: 0.3, height: 0.05, depth: 0.3,
    }, this.scene);
    seat.position = new Vector3(pos.x, 0.25, pos.z);

    // Back
    const back = MeshBuilder.CreateBox(`${id}_back`, {
      width: 0.3, height: 0.3, depth: 0.03,
    }, this.scene);
    back.position = new Vector3(pos.x, 0.4, pos.z + 0.16);

    const mat = new StandardMaterial(`mat_${id}`, this.scene);
    mat.diffuseColor = new Color3(0.4, 0.25, 0.15);
    mat.roughness = 0.9;
    seat.material = mat;
    back.material = mat;

    this.meshes.set(id, seat);
  }

  _buildLamp(id, pos) {
    const { Vector3, Color3 } = this.BJS;
    const { MeshBuilder } = this.BJS;
    const { StandardMaterial } = this.BJS;

    const pole = MeshBuilder.CreateCylinder(`${id}_pole`, {
      height: 2.5,
      diameterTop: 0.05,
      diameterBottom: 0.08,
    }, this.scene);
    pole.position = new Vector3(pos.x, 1.25, pos.z);
    pole.checkCollisions = true;

    const poleMat = new StandardMaterial(`${id}_pole_mat`, this.scene);
    poleMat.diffuseColor = new Color3(0.15, 0.15, 0.2);
    pole.material = poleMat;

    const bulb = MeshBuilder.CreateSphere(`${id}_bulb`, {
      diameter: 0.12,
    }, this.scene);
    bulb.position = new Vector3(pos.x, 2.5, pos.z);

    const bulbMat = new StandardMaterial(`${id}_bulb_mat`, this.scene);
    bulbMat.emissiveColor = new Color3(1, 0.95, 0.7);
    bulb.material = bulbMat;

    this.meshes.set(id, pole);
  }

  _buildSign(id, pos, dims, color) {
    const { Vector3, Color3 } = this.BJS;
    const { MeshBuilder } = this.BJS;
    const { StandardMaterial } = this.BJS;

    const sign = MeshBuilder.CreateBox(id, {
      width: dims.width,
      height: dims.height,
      depth: dims.depth || 0.05,
    }, this.scene);
    sign.position = new Vector3(pos.x, 1.5 + dims.height / 2, pos.z);

    const mat = new StandardMaterial(`mat_${id}`, this.scene);
    mat.diffuseColor = new Color3(
      color[0] / 255,
      color[1] / 255,
      color[2] / 255
    );
    mat.emissiveColor = new Color3(
      color[0] / 255 * 0.3,
      color[1] / 255 * 0.3,
      color[2] / 255 * 0.3
    );
    sign.material = mat;

    this.meshes.set(id, sign);
  }

  _buildPlanter(id, pos, dims) {
    const { Vector3, Color3 } = this.BJS;
    const { MeshBuilder } = this.BJS;
    const { StandardMaterial } = this.BJS;

    const planter = MeshBuilder.CreateBox(id, {
      width: dims.width,
      height: dims.height,
      depth: dims.depth,
    }, this.scene);
    planter.position = new Vector3(pos.x, dims.height / 2, pos.z);

    const planterMat = new StandardMaterial(`mat_${id}`, this.scene);
    planterMat.diffuseColor = new Color3(0.25, 0.2, 0.1);
    planter.material = planterMat;

    // Small plant on top
    const plant = MeshBuilder.CreateSphere(`${id}_plant`, {
      diameter: dims.width * 0.6,
    }, this.scene);
    plant.position = new Vector3(pos.x, dims.height + 0.1, pos.z);

    const plantMat = new StandardMaterial(`plant_mat_${id}`, this.scene);
    plantMat.diffuseColor = new Color3(0.1, 0.3, 0.1);
    plant.material = plantMat;

    this.meshes.set(id, planter);
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default WorldBuilder;
export { WorldBuilder };