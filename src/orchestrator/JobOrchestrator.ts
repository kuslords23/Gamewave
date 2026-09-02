import { Workflow, JobStep, SceneSpec, GeoMatch, SceneGraph } from '../types/scene';
import { InputNormalizer } from '../normalizer/InputNormalizer';
import { GeoResolver } from '../geo/GeoResolver';
import { AssetCacheManager } from '../cache/AssetCacheManager';
import { WorldComposer } from '../composer/WorldComposer';

export class JobOrchestrator {
  private static instance: JobOrchestrator;
  private workflows: Map<string, Workflow>;
  private normalizer: InputNormalizer;
  private geoResolver: GeoResolver;
  private assetCache: AssetCacheManager;
  private worldComposer: WorldComposer;
  private maxRetries: number;
  private stepTimeout: number;

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

  public async execute(workflowId: string): Promise<SceneGraph> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    workflow.status = 'running';
    workflow.startedAt = new Date();

    try {
      const parseStep = this.getStep(workflow, 'parse');
      parseStep.input = parseStep.input || '';
      await this.executeStep(parseStep, async () => {
        const parsed = this.normalizer.parse(parseStep.input as string);
        return this.normalizer.toSceneSpec(parsed);
      });

      const geoStep = this.getStep(workflow, 'resolve_geo');
      const scene = workflow.steps[0].output as SceneSpec;
      await this.executeStep(geoStep, async () => {
        return this.geoResolver.resolve(scene.location.description);
      });

      const assetStep = this.getStep(workflow, 'generate_assets');
      const geoMatch = workflow.steps[1].output as GeoMatch;
      await this.executeStep(assetStep, async () => {
        if (this.assetCache.hasLocation(geoMatch.coordinates.lat, geoMatch.coordinates.lng)) {
          return this.assetCache.getByLocation(geoMatch.coordinates.lat, geoMatch.coordinates.lng);
        }
        const asset = this.assetCache.storeMesh(
          geoMatch.coordinates.lat,
          geoMatch.coordinates.lng,
          `generated_${Date.now()}.gltf`
        );
        return [asset];
      });

      const composeStep = this.getStep(workflow, 'compose_world');
      const assets = workflow.steps[2].output as any[];
      await this.executeStep(composeStep, async () => {
        scene.location.realWorld.lat = geoMatch.coordinates.lat;
        scene.location.realWorld.lng = geoMatch.coordinates.lng;
        scene.location.realWorld.address = geoMatch.matchedAddress || '';
        return this.worldComposer.compose(scene, assets.map((a: any) => a.meshPath));
      });

      workflow.status = 'completed';
      workflow.completedAt = new Date();
      return workflow.steps[3].output as SceneGraph;
    } catch (error) {
      workflow.status = 'failed';
      throw error;
    }
  }

  private async executeStep(step: JobStep, fn: () => Promise<unknown>): Promise<void> {
    let attempts = 0;
    step.retries = 0;

    while (attempts <= this.maxRetries) {
      attempts++;
      step.status = 'running';
      step.startedAt = new Date();

      try {
        const result = await this.withTimeout(fn(), this.stepTimeout);
        step.output = result;
        step.status = 'completed';
        step.completedAt = new Date();
        return;
      } catch (error) {
        step.retries = attempts;
        if (attempts <= this.maxRetries) {
          step.status = 'retrying';
          await this.delay(1000 * attempts);
        } else {
          step.error = error instanceof Error ? error.message : String(error);
          step.status = 'failed';
          step.completedAt = new Date();
          throw error;
        }
      }
    }
  }

  private getStep(workflow: Workflow, stepId: string): JobStep {
    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) throw new Error(`Step ${stepId} not found in workflow`);
    return step;
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Step timeout')), ms);
      promise
        .then(value => { clearTimeout(timer); resolve(value); })
        .catch(err => { clearTimeout(timer); reject(err); });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  public getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  public cancel(id: string): boolean {
    const workflow = this.workflows.get(id);
    if (!workflow || workflow.status === 'completed' || workflow.status === 'failed') return false;
    workflow.status = 'failed';
    workflow.completedAt = new Date();
    return true;
  }

  public getStatus(id: string): { status: string; progress: number } | null {
    const workflow = this.workflows.get(id);
    if (!workflow) return null;
    const completedSteps = workflow.steps.filter(s => s.status === 'completed').length;
    const progress = (completedSteps / workflow.steps.length) * 100;
    return { status: workflow.status, progress };
  }
}

export default JobOrchestrator;