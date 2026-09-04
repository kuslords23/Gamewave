/**
 * KUS WORLD ENGINE — World Generator
 *
 * The heart of the reconstruction pipeline.
 * Converts analyzed video data (shots, scenes, colors, motion, audio)
 * into a structured 3D world description complete with:
 *
 * - Terrain/environment based on scene mood/colors
 * - Buildings and structures from scene composition
 * - Characters placed where motion/speech is detected
 * - Props and objects from detected scene types
 * - Lighting that matches the original scene mood
 * - Dialogue metadata embedded in the world
 */

class WorldGenerator {
  /**
   * Generate a complete world from video analysis data
   */
  generate(videoSource, frameData, sceneAnalysis, audioResult) {
    const { scenes, shots, motion, sceneMoods } = sceneAnalysis;
    const worldId = `world_${Date.now()}`;

    console.log(`🏗️ Generating world from ${scenes.length} scenes...`);

    // Build the world layout — a street/area for each scene
    const worldLayout = this._buildWorldLayout(scenes, shots, sceneMoods, videoSource);

    // Generate structures for each scene
    const structures = this._generateStructures(scenes, sceneAnalysis, worldLayout);

    // Place characters from motion/speech data
    const characters = this._generateCharacters(scenes, motion, audioResult, frameData);

    // Generate props and objects
    const props = this._generateProps(scenes, sceneMoods);

    // Build full scene graph
    const sceneGraph = this._buildSceneGraph(worldId, worldLayout, structures, characters, props, videoSource);

    console.log(`  🏛️ ${structures.length} structures`);
    console.log(`  🧍 ${characters.length} characters`);
    console.log(`  📦 ${props.length} props`);

    return {
      id: worldId,
      name: videoSource.name.replace(/\.[^/.]+$/, ''),
      sceneGraph,
      characters,
      structures,
      props,
      dialogues: audioResult?.segments || [],
      environment: {
        sceneId: `env_${worldId}`,
        meshPath: '',
        status: 'completed',
        quality: 0.7,
        confidence: 0.7,
        metadata: { technique: 'hybrid' },
      },
      status: 'ready',
      createdAt: new Date(),
    };
  }

  /**
   * Build the spatial layout of the world
   * Each shot/scene becomes a zone in the 3D space
   */
  _buildWorldLayout(scenes, shots, sceneMoods, videoSource) {
    const layout = {
      width: 40,
      depth: 40,
      scenes: [],
    };

    // Arrange scenes in a grid pattern left-to-right
    const scenesPerRow = Math.ceil(Math.sqrt(scenes.length));
    const sceneSpacing = 8;

    scenes.forEach((scene, idx) => {
      const row = Math.floor(idx / scenesPerRow);
      const col = idx % scenesPerRow;
      const x = (col - (scenesPerRow - 1) / 2) * sceneSpacing;
      const z = (row - (scenesPerRow - 1) / 2) * sceneSpacing;

      layout.scenes.push({
        ...scene,
        position: { x, y: 0, z },
        zone: {
          width: sceneSpacing * 0.8,
          depth: sceneSpacing * 0.8,
        },
      });
    });

    return layout;
  }

  /**
   * Generate 3D structures based on scene characteristics
   */
  _generateStructures(scenes, sceneAnalysis, layout) {
    const structures = [];

    scenes.forEach((scene) => {
      const pos = scene.position;
      const mood = scene.mood;
      const colors = scene.dominantColors;

      // Primary structure — represents the main subject of the scene
      const primaryColor = colors?.[0]?.rgb || [100, 100, 120];
      const structureHeight = 2 + (mood.brightness || 0.5) * 4;
      const structureWidth = 1.5 + (scene.motion || 0.3) * 2;

      // Scene type determines structure shape
      let type = 'building';
      if (scene.type === 'action') type = 'arena';
      else if (scene.type === 'outdoor_bright') type = 'plaza';
      else if (scene.type === 'warm_interior') type = 'lounge';
      else if (scene.type === 'interior_dark') type = 'chamber';

      structures.push({
        id: `struct_${scene.id}`,
        sceneId: scene.id,
        name: scene.name,
        type,
        position: pos,
        dimensions: {
          width: structureWidth,
          height: structureHeight,
          depth: structureWidth * 0.8,
        },
        color: primaryColor,
        colorHex: colors?.[0]?.hex || '#667788',
        style: this._deriveArchitecturalStyle(mood, type),
        metadata: {
          sourceScene: scene.name,
          mood: mood.label,
          motion: scene.motion,
          brightness: mood.brightness,
        },
      });
    });

    return structures;
  }

  /**
   * Generate characters from motion/dialogue analysis
   */
  _generateCharacters(scenes, motionData, audioResult, frameData) {
    const characters = [];
    const usedPositions = new Set();

    // Find high-motion areas and place characters there
    scenes.forEach((scene, sceneIdx) => {
      const pos = scene.position;
      const sceneMotion = motionData.filter(m =>
        m.timestamp >= scene.startTime && m.timestamp <= scene.endTime
      );

      const avgMotion = sceneMotion.reduce((a, m) => a + m.intensity, 0) / Math.max(1, sceneMotion.length);

      // Determine number of characters based on motion and scene type
      let charCount = 0;
      if (avgMotion > 0.3) charCount = 2;          // Action scene
      else if (avgMotion > 0.1) charCount = 1;     // Moderate motion
      else if (scene.type === 'warm_interior') charCount = 2; // Dialogue scene
      else charCount = 1;

      // Check for dialogue segments in this scene's timeframe
      if (audioResult?.segments) {
        const dialogueInScene = audioResult.segments.filter(s =>
          s.startTime >= scene.startTime && s.endTime <= scene.endTime
        );
        // More dialogue = more characters
        if (dialogueInScene.length > 3) charCount = Math.max(charCount, 3);
      }

      for (let c = 0; c < charCount; c++) {
        const charId = `char_${sceneIdx}_${c}`;

        // Distribute characters around the scene position
        const angle = (c / charCount) * Math.PI * 2 + sceneIdx * 0.5;
        const radius = 1.5 + c * 0.8;
        const x = pos.x + Math.cos(angle) * radius;
        const z = pos.z + Math.sin(angle) * radius;

        const posKey = `${x.toFixed(1)},${z.toFixed(1)}`;
        if (usedPositions.has(posKey)) continue;
        usedPositions.add(posKey);

        // Randomize character appearance based on scene color
        const colors = scene.dominantColors;
        const skinTone = [220, 190, 160]; // Default skin
        const clothingColor = colors?.[1 % colors.length]?.rgb ||
          [80 + Math.random() * 100, 60 + Math.random() * 100, 100 + Math.random() * 100];

        characters.push({
          id: charId,
          name: `Character ${sceneIdx + 1}-${c + 1}`,
          sceneId: scene.id,
          position: { x, y: 0, z },
          rotation: { x: 0, y: angle + Math.PI, z: 0 },
          scale: 0.9 + Math.random() * 0.2,
          skinColor: skinTone,
          clothingColor,
          isMoving: avgMotion > 0.15,
          hasDialogue: audioResult?.segments?.some(s =>
            s.startTime >= scene.startTime && s.endTime <= scene.endTime
          ) || false,
          dialogue: audioResult?.segments
            ?.filter(s => s.startTime >= scene.startTime && s.endTime <= scene.endTime)
            ?.map(s => s.text)
            ?.join(' ') || '',
          personality: this._derivePersonality(scene),
        });
      }
    });

    return characters;
  }

  /**
   * Generate props and objects based on scene types
   */
  _generateProps(scenes, sceneMoods) {
    const props = [];

    scenes.forEach((scene) => {
      const pos = scene.position;
      const mood = scene.mood;

      // Props depend on scene type
      let sceneProps = [];
      switch (scene.type) {
        case 'warm_interior':
        case 'interior_dark':
          sceneProps = [
            { type: 'table', width: 0.8, height: 0.1, depth: 0.5 },
            { type: 'chair', width: 0.3, height: 0.5, depth: 0.3 },
            { type: 'lamp', width: 0.1, height: 0.6, depth: 0.1 },
          ];
          break;
        case 'outdoor_bright':
        case 'exterior_static':
          sceneProps = [
            { type: 'tree', width: 0.5, height: 1.5, depth: 0.5 },
            { type: 'bench', width: 0.6, height: 0.3, depth: 0.3 },
            { type: 'lamp_post', width: 0.1, height: 0.8, depth: 0.1 },
          ];
          break;
        case 'action':
          sceneProps = [
            { type: 'barrier', width: 0.4, height: 0.3, depth: 1.0 },
            { type: 'light', width: 0.2, height: 0.2, depth: 0.2 },
          ];
          break;
        default:
          sceneProps = [
            { type: 'planter', width: 0.4, height: 0.3, depth: 0.4 },
            { type: 'sign', width: 0.6, height: 0.3, depth: 0.05 },
          ];
      }

      sceneProps.forEach((propDef, pIdx) => {
        const angle = (pIdx / sceneProps.length) * Math.PI * 2 + 0.5;
        const radius = 2;
        const propPos = {
          x: pos.x + Math.cos(angle) * radius,
          y: 0,
          z: pos.z + Math.sin(angle) * radius,
        };

        const colorVariant = (pIdx * 40 + scene.id.charCodeAt(scene.id.length - 1) * 20);
        const propColor = [
          (80 + colorVariant) % 200,
          (100 + colorVariant * 0.5) % 200,
          (120 + colorVariant * 0.3) % 200,
        ];

        props.push({
          id: `prop_${scene.id}_${pIdx}`,
          type: propDef.type,
          sceneId: scene.id,
          position: propPos,
          rotation: { x: 0, y: angle, z: 0 },
          dimensions: propDef,
          color: propColor,
          colorHex: '#' + propColor.map(c => Math.round(c).toString(16).padStart(2, '0')).join(''),
          interactive: ['lamp', 'chair', 'sign'].includes(propDef.type),
        });
      });
    });

    return props;
  }

  /**
   * Build the complete scene graph from all generated elements
   */
  _buildSceneGraph(worldId, layout, structures, characters, props, videoSource) {
    // Build hierarchical scene graph
    const envNodes = [];

    // Ground/environment node
    const avgColor = this._averageColor(structures);
    envNodes.push({
      id: 'ground',
      type: 'location',
      name: 'Terrain',
      position: { x: 0, y: -0.5, z: 0 },
      scale: 1,
      children: [],
      metadata: {
        color: avgColor,
        width: layout.width,
        depth: layout.depth,
        gridVisible: true,
      },
    });

    // Structures
    structures.forEach((struct) => {
      envNodes.push({
        id: struct.id,
        type: 'prop',
        name: struct.name,
        position: struct.position,
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1,
        children: [],
        metadata: {
          meshType: struct.type,
          dimensions: struct.dimensions,
          color: struct.color,
          colorHex: struct.colorHex,
          sourceScene: struct.sceneId,
        },
      });
    });

    // Characters
    characters.forEach((char) => {
      envNodes.push({
        id: char.id,
        type: 'character',
        name: char.name,
        position: char.position,
        rotation: char.rotation,
        scale: char.scale,
        children: [],
        metadata: {
          skinColor: char.skinColor,
          clothingColor: char.clothingColor,
          isMoving: char.isMoving,
          hasDialogue: char.hasDialogue,
          dialogue: char.dialogue,
          personality: char.personality,
        },
      });
    });

    // Props
    props.forEach((prop) => {
      envNodes.push({
        id: prop.id,
        type: 'prop',
        name: `${prop.type}_${prop.sceneId}`,
        position: prop.position,
        rotation: prop.rotation,
        scale: 1,
        children: [],
        metadata: {
          meshType: prop.type,
          dimensions: prop.dimensions,
          color: prop.color,
          colorHex: prop.colorHex,
          interactive: prop.interactive,
        },
      });
    });

    return {
      id: `sg_${worldId}`,
      name: videoSource.name.replace(/\.[^/.]+$/, ''),
      nodes: envNodes,
      metadata: {
        sourceFilm: videoSource.name,
        engine: 'babylonjs',
        generatedAt: new Date(),
        version: '0.1.0',
      },
    };
  }

  /* ── Helpers ── */

  _deriveArchitecturalStyle(mood, type) {
    if (mood.brightness < 0.3) return 'industrial_brick';
    if (mood.warmth > 0.6) return 'warm_wood';
    if (mood.saturation > 0.5) return 'modern_glass';
    if (type === 'outdoor_bright') return 'concrete_modern';
    return 'standard_urban';
  }

  _derivePersonality(scene) {
    const traits = [];
    if (scene.mood.brightness > 0.6) traits.push('cheerful');
    if (scene.mood.brightness < 0.3) traits.push('mysterious');
    if (scene.motion > 0.2) traits.push('energetic');
    if (scene.mood.warmth > 0.6) traits.push('friendly');
    if (scene.mood.warmth < 0.4) traits.push('reserved');
    if (traits.length === 0) traits.push('neutral');
    return traits;
  }

  _averageColor(structures) {
    if (structures.length === 0) return [30, 30, 45];
    const avg = [0, 0, 0];
    structures.forEach(s => {
      avg[0] += s.color[0];
      avg[1] += s.color[1];
      avg[2] += s.color[2];
    });
    return avg.map(v => Math.round(v / structures.length));
  }
}

export default WorldGenerator;
export { WorldGenerator };