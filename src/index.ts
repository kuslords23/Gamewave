/**
 * Gamewave - FindMyMom TypeScript Starter
 * Open World Game Generation Platform
 * 
 * Architecture:
 * - Input Normalizer: Converts any input to structured scene data
 * - Geo Resolver: Matches script descriptions to real coordinates
 * - Asset Cache Manager: Stores generated 3D assets by location hash
 * - World Composer: Combines real geo base + generated assets
 * - Job Orchestrator: Manages workflow with retries and caching
 */

import { JobOrchestrator } from './orchestrator/JobOrchestrator';
import { InputNormalizer } from './normalizer/InputNormalizer';
import { GeoResolver } from './geo/GeoResolver';
import { AssetCacheManager } from './cache/AssetCacheManager';
import { WorldComposer } from './composer/WorldComposer';
import { SceneSpec, Workflow, SceneGraph } from './types/scene';

// Re-export all public interfaces
export {
  JobOrchestrator,
  InputNormalizer,
  GeoResolver,
  AssetCacheManager,
  WorldComposer,
  SceneSpec,
  Workflow,
  SceneGraph,
};

/**
 * Quick start: process input and get scene graph
 */
export async function processInput(rawInput: string): Promise<SceneGraph> {
  const orchestrator = JobOrchestrator.getInstance();
  const workflow = orchestrator.createWorkflow(rawInput);
  workflow.steps[0].input = rawInput;
  return orchestrator.execute(workflow.id);
}

/**
 * Main demo function
 */
async function main() {
  console.log('🎮 Gamewave - Open World Generator');
  console.log('===================================\n');

  // Example input
  const exampleInput = `
    Coffee shop on the corner, downtown LA.
    NPC "Barista" says hello to the player.
    Location has warm lighting and wooden furniture.
    A customer NPC "Patron" sits at the counter.
  `;

  try {
    console.log('📝 Processing input...');
    console.log(`Input: ${exampleInput.substring(0, 50)}...\n`);

    const sceneGraph = await processInput(exampleInput);

    console.log('✅ Scene generated successfully!\n');
    console.log('📍 Location:', sceneGraph.geoBase.realWorld.address);
    console.log('📐 Coordinates:', `${sceneGraph.geoBase.realWorld.lat}, ${sceneGraph.geoBase.realWorld.lng}`);
    console.log('🎬 Engine:', sceneGraph.metadata.engine);
    console.log('🔧 Scene Graph ID:', sceneGraph.sceneId);
    console.log('\n📦 Generated Assets:', sceneGraph.generatedAssets.length);
    
    console.log('\n🌐 Scene Graph Structure:');
    console.log(JSON.stringify(sceneGraph.rootNode, null, 2).substring(0, 500) + '...');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
  }
}

// Run demo if executed directly
if (require.main === module) {
  main();
}