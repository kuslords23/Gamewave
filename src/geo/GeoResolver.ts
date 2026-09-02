import { GeoMatch, Coordinates, LocationDescription } from '../types/scene';

/**
 * Geo Resolver
 * Matches script descriptions to real-world coordinates
 */
export class GeoResolver {
  private static instance: GeoResolver;
  private cache: Map<string, GeoMatch>;
  private geocodingApi: string | null;

  private constructor() {
    this.cache = new Map();
    this.geocodingApi = null;
  }

  public static getInstance(): GeoResolver {
    if (!GeoResolver.instance) {
      GeoResolver.instance = new GeoResolver();
    }
    return GeoResolver.instance;
  }

  /**
   * Configure geocoding API (optional)
   */
  public setGeocodingApi(apiKey: string): void {
    this.geocodingApi = apiKey;
  }

  /**
   * Match a description to real coordinates
   */
  public async resolve(description: string): Promise<GeoMatch> {
    // Check cache first
    const cacheKey = this.normalizeKey(description);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const match = this.fuzzyMatch(description);
    this.cache.set(cacheKey, match);
    return match;
  }

  /**
   * Resolve a batch of descriptions
   */
  public async resolveBatch(descriptions: string[]): Promise<GeoMatch[]> {
    return Promise.all(descriptions.map(desc => this.resolve(desc)));
  }

  /**
   * Convert coordinates to location description
   */
  public async reverseGeocode(coords: Coordinates): Promise<string> {
    // In production, call geocoding API
    // For now, return a formatted string
    return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
  }

  /**
   * Get cached matches
   */
  public getCached(): Map<string, GeoMatch> {
    return new Map(this.cache);
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Fuzzy match description to known location patterns
   */
  private fuzzyMatch(description: string): GeoMatch {
    const lowerDesc = description.toLowerCase();
    const match = this.matchPatterns(lowerDesc);
    
    return {
      input: description,
      coordinates: match.coords,
      type: match.type,
      confidence: match.confidence,
      matchedAddress: match.address,
    };
  }

  /**
   * Match against known location patterns
   */
  private matchPatterns(desc: string): {
    coords: Coordinates;
    type: GeoMatch['type'];
    confidence: number;
    address: string;
  } {
    // Pattern: Downtown LA cafe
    if (/downtown.*la|la.*downtown|los angeles.*downtown/i.test(desc)) {
      return {
        coords: { lat: 34.0479, lng: -118.2503 },
        type: 'street',
        confidence: 0.85,
        address: 'Downtown Los Angeles, CA',
      };
    }

    // Pattern: Coffee shop
    if (/coffee|cafe|café/i.test(desc)) {
      return {
        coords: { lat: 34.0522, lng: -118.2437 },
        type: 'cafe',
        confidence: 0.80,
        address: 'Coffee shop location',
      };
    }

    // Pattern: Park
    if (/park|garden|plaza/i.test(desc)) {
      return {
        coords: { lat: 34.0736, lng: -118.2404 },
        type: 'park',
        confidence: 0.75,
        address: 'Central Park area',
      };
    }

    // Pattern: Building/Office
    if (/building|office|tower/i.test(desc)) {
      return {
        coords: { lat: 34.0505, lng: -118.2508 },
        type: 'building',
        confidence: 0.70,
        address: 'Commercial building',
      };
    }

    // Pattern: Corner location
    if (/corner|intersection/i.test(desc)) {
      return {
        coords: { lat: 34.0489, lng: -118.2467 },
        type: 'landmark',
        confidence: 0.65,
        address: 'Street corner',
      };
    }

    // Pattern: Street
    if (/street|st|avenue|ave|road|rd/i.test(desc)) {
      return {
        coords: { lat: 34.0495, lng: -118.2456 },
        type: 'street',
        confidence: 0.60,
        address: 'Street location',
      };
    }

    // Default fallback
    return {
      coords: { lat: 34.0522, lng: -118.2437 },
      type: 'unknown',
      confidence: 0.30,
      address: 'Unknown location',
    };
  }

  /**
   * Normalize key for cache lookup
   */
  private normalizeKey(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Build location description from match
   */
  public buildLocationDescription(match: GeoMatch): LocationDescription {
    return {
      realWorld: {
        lat: match.coordinates.lat,
        lng: match.coordinates.lng,
        address: match.matchedAddress || 'Unknown',
      },
      description: match.input,
    };
  }
}

export default GeoResolver;