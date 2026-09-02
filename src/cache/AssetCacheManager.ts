import { CachedAsset, SceneSpec } from '../types/scene';

/**
 * Asset Cache Manager
 * Stores generated 3D assets by location hash for reuse
 */
export class AssetCacheManager {
  private static instance: AssetCacheManager;
  private cache: Map<string, CachedAsset>;
  private storagePath: string;
  private maxCacheSize: number;

  private constructor(storagePath: string = './cache/assets') {
    this.cache = new Map();
    this.storagePath = storagePath;
    this.maxCacheSize = 1000;
    this.loadFromStorage();
  }

  public static getInstance(storagePath?: string): AssetCacheManager {
    if (!AssetCacheManager.instance) {
      AssetCacheManager.instance = new AssetCacheManager(storagePath);
    }
    return AssetCacheManager.instance;
  }

  /**
   * Generate hash from location coordinates
   */
  public generateLocationHash(lat: number, lng: number): string {
    // Round to 4 decimal places for consistent hashing
    const roundedLat = Math.round(lat * 10000) / 10000;
    const roundedLng = Math.round(lng * 10000) / 10000;
    return `loc_${roundedLat}_${roundedLng}`;
  }

  /**
   * Generate hash from scene spec
   */
  public generateSceneHash(scene: SceneSpec): string {
    const locationString = `${scene.location.realWorld.lat},${scene.location.realWorld.lng}`;
    const charString = scene.characters.map(c => c.id).join('|');
    return this.hashString(`${locationString}:${charString}`);
  }

  /**
   * Check if asset exists in cache
   */
  public has(assetId: string): boolean {
    return this.cache.has(assetId);
  }

  /**
   * Check if location has cached assets
   */
  public hasLocation(lat: number, lng: number): boolean {
    const hash = this.generateLocationHash(lat, lng);
    return Array.from(this.cache.values()).some(
      asset => asset.locationHash === hash
    );
  }

  /**
   * Get asset from cache
   */
  public get(assetId: string): CachedAsset | undefined {
    return this.cache.get(assetId);
  }

  /**
   * Get all assets for a location
   */
  public getByLocation(lat: number, lng: number): CachedAsset[] {
    const hash = this.generateLocationHash(lat, lng);
    return Array.from(this.cache.values()).filter(
      asset => asset.locationHash === hash
    );
  }

  /**
   * Store asset in cache
   */
  public store(asset: CachedAsset): void {
    // Enforce max cache size
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldest();
    }
    this.cache.set(asset.id, asset);
    this.persistToStorage(asset);
  }

  /**
   * Store mesh data for a location
   */
  public storeMesh(
    lat: number,
    lng: number,
    meshPath: string,
    format: string = 'gltf'
  ): CachedAsset {
    const hash = this.generateLocationHash(lat, lng);
    const id = `asset_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const asset: CachedAsset = {
      id,
      locationHash: hash,
      meshPath,
      metadata: {
        createdAt: new Date(),
        size: 0, // Would calculate from actual file
        format,
      },
    };

    this.store(asset);
    return asset;
  }

  /**
   * Get cache statistics
   */
  public getStats(): {
    totalAssets: number;
    uniqueLocations: number;
    cacheSize: number;
    oldestAsset: Date | null;
  } {
    const assets = Array.from(this.cache.values());
    const uniqueHashes = new Set(assets.map(a => a.locationHash));
    
    let oldest: Date | null = null;
    assets.forEach(asset => {
      if (!oldest || asset.metadata.createdAt < oldest) {
        oldest = asset.metadata.createdAt;
      }
    });

    return {
      totalAssets: assets.length,
      uniqueLocations: uniqueHashes.size,
      cacheSize: this.estimateCacheSize(),
      oldestAsset: oldest,
    };
  }

  /**
   * Clear entire cache
   */
  public clear(): void {
    this.cache.clear();
    this.clearStorage();
  }

  /**
   * Clear cache for specific location
   */
  public clearLocation(lat: number, lng: number): void {
    const hash = this.generateLocationHash(lat, lng);
    const toDelete: string[] = [];
    
    this.cache.forEach((asset, id) => {
      if (asset.locationHash === hash) {
        toDelete.push(id);
      }
    });

    toDelete.forEach(id => this.cache.delete(id));
  }

  /**
   * Get all cached asset IDs
   */
  public getAllAssetIds(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Check if scene can be reused from cache
   */
  public canReuseScene(scene: SceneSpec): boolean {
    const assets = this.getByLocation(
      scene.location.realWorld.lat,
      scene.location.realWorld.lng
    );
    return assets.length > 0;
  }

  // Private helper methods

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `hash_${Math.abs(hash).toString(16)}`;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    this.cache.forEach((asset, key) => {
      const time = asset.metadata.createdAt.getTime();
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private estimateCacheSize(): number {
    let size = 0;
    this.cache.forEach(asset => {
      size += asset.metadata.size;
    });
    return size;
  }

  private loadFromStorage(): void {
    // In production, load from file system or database
    // For now, start with empty cache
  }

  private persistToStorage(asset: CachedAsset): void {
    // In production, write to file system or database
  }

  private clearStorage(): void {
    // In production, clear from file system or database
  }
}

export default AssetCacheManager;