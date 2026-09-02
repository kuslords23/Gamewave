import { Workflow, JobStep, SceneSpec, GeoMatch, SceneGraph } from '../types/scene';
import { InputNormalizer } from '../normalizer/InputNormalizer';
import { GeoResolver } from '../geo/GeoResolver';
import { AssetCacheManager } from '../cache/AssetCacheManager';
import { WorldComposer } from '../composer/WorldComposer';

/**
 * Job Orchestrator
 * Manages workflow: parse → resolve geo → generate assets → compose world
 */
export class JobOrchestrator {
  private static instance: JobOrchestrator;
  private workflows: Map<string, Workflow>;
  private normalizer: InputNormalizer;
  private geoResolver: GeoResolver;
  private assetCache: AssetCacheManager;
  private worldComposer: WorldComposer;
  private maxRetries: number;
  private stepTimeout: number; // in milliseconds

  private constructor() {
    this.workflows = new Map();
    this.normalizer = InputNormalizer.getInstance();
    this.geoResolver = GeoResolver.getInstance();
    this.assetCache = AssetCacheManager.getInstance();
    this.worldComposer = WorldComposer.getInstance();
    this.maxRetries = 3;
    this.stepTimeout = 30000;
  }

  public static getInstance(): JobOrchestrator {
    if (!JobOrchestrator.instance) {
      JobOrchestrator.instance = new JobOrchestrator();
    }
    return JobOrchestrator.instance;
  }

  /**
   * Create new workflow from raw input
   */
  public createWorkflow(rawInput: string): Workflow {
    const id = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const workflow: Workflow = {
      id,
      steps: [
        { id: 'parse', name: 'Parse Input', status: 'pending', retries: 0 },
        { id: 'resolve_geo', name: 'Resolve Geo', status: 'pending', retries: 0 },
        { id: 'generate_assets', name: 'Generate Assets', status: 'pending', retries: 0 },
        { id: 'compose_world', name: 'Compose World', status: 'pending', retries: 0 },
      ],
      status: 'created',
      createdAt: new Date(),
    };

    this.workflows.set(id, workflow);
    return workflow;
  }

  /**
   * Execute full workflow
   */
  public async execute(workflowId: string): Promise<SceneGraph> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflow.status = 'running';
    workflow.startedAt = new Date();

    try {
      // Step 1: Parse input
      const parseStep = this.getStep(workflow, 'parse');
      await this.executeStep(parseStep, async () => {
        const parsed = this.normalizer.parse(parseStep.input as string);
        return this.normalizer.toSceneSpec(parsed);
      });
      parseStep.input = workflow.steps[0].input || '';

      // Step 2: Resolve geo
      const geoStep = this.getStep(workflow, 'resolve_geo');
      const scene = workflow.steps[0].output as SceneSpec;
      await this.executeStep(geoStep, async () => {
        return this.geoResolver.resolve(scene.location.description);
      });

      // Step 3: Generate/check assets
      const assetStep = this.getStep(workflow, 'generate_assets');
      const geoMatch = workflow.steps[1].output as GeoMatch;
      await this.executeStep(assetStep, async () => {
        // Check cache first
        if (this.assetCache.hasLocation(geoMatch.coordinates.lat, geoMatch.coordinates.lng)) {
          return this.assetCache.getByLocation(geoMatch.coordinates.lat, geoMatch.coordinates.lng);
        }
        // In production, would call asset generation service
        const asset = this.assetCache.storeMesh(
          geoMatch.coordinates.lat,
          geoMatch.coordinates.lng,
          `generated_${Date.now()}.gltf`
        );
        return [asset];
      });

      // Step 4: Compose world
      const composeStep = this.getStep(workflow, 'compose_world');
      const assets = workflow.steps[2].output as any[];
      await this.executeStep(composeStep, async () => {
        // Update scene with resolved geo
        scene.location.realWorld.lat = geoMatch.coordinates.lat;
        scene.location.realWorld.lng = geoMatch.coordinates.lng;
        scene.location.realWorld.address = geoMatch.matchedAddress || '';
        
        return this.worldComposer.compose(scene, assets.map(a => a.meshPath));
      });

      workflow.status = 'completed';
      workflow.completedAt = new Date();

      return workflow.steps[3].output as SceneGraph;
    } catch (error) {
      workflow.status = 'failed';
      throw error;
    }
  }

  /**
   * Execute a single step with retry logic
   */
  private async executeStep(step: JobStep, fn: () => Promise<unknown>): Promise<void> {
    step.status = 'running';
    step.startedAt = new Date();

    try {
      const result = await this.withTimeout(fn(), this.stepTimeout);
      step.output = result;
      step.status = 'completed';
      step.completedAt = new Date();
    } catch (error) {
      step.retries++;
      
      if (step.retries < this.maxRetries) {
        step.status = 'retrying';
        // Retry after delay
        await this.delay(1000 * step.retries);
        return this.executeStep(step, fn);
      }
      
      step.error = error instanceof Error ? error.message : String(error);
      step.status = 'failed';
      throw error;
    }
  }

  /**
   * Get step by ID
   */
  private getStep(workflow: Workflow, stepId: string): JobStep {
    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found in workflow`);
    }
    return step;
  }

  /**
   * Execute with timeout
   */
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Step timeout')), ms);
      promise
        .then(value => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch(err => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get workflow by ID
   */
  public getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  /**
   * Get all workflows
   */
  public getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Cancel workflow
   */
  public cancel(id: string): boolean {
    const workflow = this.workflows.get(id);
    if (!workflow || workflow.status === 'completed' || workflow.status === 'failed') {
      return false;
    }
    workflow.status = 'failed';
    workflow.completedAt = new Date();
    return true;
  }

  /**
   * Get workflow status
   */
  public getStatus(id: string): { status: string; progress: number } | null {
    const workflow = this.workflows.get(id);
    if (!workflow) return null;

    const completedSteps = workflow.steps.filter(s => s.status === 'completed').length;
    const progress = (completedSteps / workflow.steps.length) * 100;

    return {
      status: workflow.status,
      progress,
    };
  }
}

export default JobOrchestrator;