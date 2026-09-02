export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RealWorldLocation {
  lat: number;
  lng: number;
  address: string;
}

export interface LocationDescription {
  realWorld: RealWorldLocation;
  description: string;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  position?: Coordinates;
  assets?: string[];
}

export interface Event {
  id: string;
  type: 'dialogue' | 'action' | 'trigger' | 'cutscene';
  timestamp: number;
  data: Record<string, unknown>;
}

export interface SceneSpec {
  id: string;
  location: LocationDescription;
  characters: Character[];
  events: Event[];
  duration: number;
  keyFrames?: string[];
  metadata?: {
    createdAt: Date;
    source: string;
    version: string;
  };
}

export interface ParsedInput {
  raw: string;
  type: 'script' | 'description' | 'coordinates' | 'mixed';
  extractedLocations: string[];
  extractedCharacters: string[];
  confidence: number;
}

export interface GeoMatch {
  input: string;
  coordinates: Coordinates;
  type: 'cafe' | 'park' | 'street' | 'building' | 'landmark' | 'unknown';
  confidence: number;
  matchedAddress?: string;
}

export interface CachedAsset {
  id: string;
  locationHash: string;
  meshPath: string;
  metadata: {
    createdAt: Date;
    size: number;
    format: string;
  };
}

export interface WorldNode {
  id: string;
  type: 'location' | 'character' | 'prop' | 'light' | 'camera';
  position: Coordinates;
  rotation?: { x: number; y: number; z: number };
  scale?: number;
  children?: WorldNode[];
  metadata: Record<string, unknown>;
}

export interface SceneGraph {
  sceneId: string;
  rootNode: WorldNode;
  geoBase: LocationDescription;
  generatedAssets: string[];
  metadata: {
    generatedAt: Date;
    engine: 'babylonjs' | 'threejs' | 'unity';
    version: string;
  };
}

export interface JobStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying';
  input: unknown;
  output?: unknown;
  error?: string;
  retries: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface Workflow {
  id: string;
  steps: JobStep[];
  status: 'created' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}