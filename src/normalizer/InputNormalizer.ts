import { SceneSpec, ParsedInput, Character, Event } from '../types/scene';

/**
 * Input Normalizer
 * Converts any input (script, description, mixed) into structured SceneSpec format
 */
export class InputNormalizer {
  private static instance: InputNormalizer;

  private constructor() {}

  public static getInstance(): InputNormalizer {
    if (!InputNormalizer.instance) {
      InputNormalizer.instance = new InputNormalizer();
    }
    return InputNormalizer.instance;
  }

  /**
   * Parse raw input into structured format
   */
  public parse(rawInput: string): ParsedInput {
    const locations = this.extractLocations(rawInput);
    const characters = this.extractCharacters(rawInput);
    const type = this.detectInputType(rawInput);
    const confidence = this.calculateConfidence(locations, characters);

    return {
      raw: rawInput,
      type,
      extractedLocations: locations,
      extractedCharacters: characters,
      confidence,
    };
  }

  /**
   * Convert parsed input into SceneSpec
   */
  public toSceneSpec(parsed: ParsedInput, options?: {
    defaultDuration?: number;
    locationDefaults?: { lat: number; lng: number };
  }): SceneSpec {
    const id = this.generateId();
    const duration = options?.defaultDuration ?? 300; // 5 minutes default

    return {
      id,
      location: {
        realWorld: {
          lat: options?.locationDefaults?.lat ?? 0,
          lng: options?.locationDefaults?.lng ?? 0,
          address: parsed.extractedLocations[0] ?? 'Unknown',
        },
        description: parsed.raw.substring(0, 200),
      },
      characters: this.buildCharacters(parsed.extractedCharacters),
      events: this.buildEvents(parsed.raw),
      duration,
      metadata: {
        createdAt: new Date(),
        source: 'InputNormalizer',
        version: '1.0.0',
      },
    };
  }

  /**
   * Extract location references from text
   */
  private extractLocations(text: string): string[] {
    const locationPatterns = [
      /\b(?:coffee shop|cafe|restaurant|park|street|downtown|uptown|building|office|home|house)\b/gi,
      /\b\d+\s+\w+\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd)\b/gi,
      /\b(?:on\s+the\s+corner|near|at|inside|outside)\s+[^.]+\b/gi,
    ];

    const locations: string[] = [];
    locationPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        locations.push(...matches);
      }
    });

    return [...new Set(locations)]; // Remove duplicates
  }

  /**
   * Extract character references from text
   */
  private extractCharacters(text: string): string[] {
    const characterPatterns = [
      /NPC\s+"([^"]+)"/gi,
      /character\s+"([^"]+)"/gi,
      /@(\w+)/g,
      /(?<=says?\s+|talks?\s+to\s+|meets?\s+)\b[A-Z][a-z]+\b/g,
    ];

    const characters: string[] = [];
    characterPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        characters.push(match[1] || match[0]);
      }
    });

    return [...new Set(characters)];
  }

  /**
   * Detect the type of input
   */
  private detectInputType(text: string): ParsedInput['type'] {
    if (/^\s*[-*]\s+.+$/m.test(text)) return 'script';
    if (/^\d+\.\d+\s*,/.test(text) || /lat.*lng/i.test(text)) return 'coordinates';
    if (/character|location|scene|event/i.test(text)) return 'mixed';
    return 'description';
  }

  /**
   * Calculate confidence score for parsed input
   */
  private calculateConfidence(locations: string[], characters: string[]): number {
    let score = 0.5; // Base score
    if (locations.length > 0) score += 0.2;
    if (characters.length > 0) score += 0.2;
    if (locations.length > 2) score += 0.1;
    return Math.min(score, 1.0);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Build character array from extracted names
   */
  private buildCharacters(names: string[]): Character[] {
    return names.map((name, index) => ({
      id: `char_${index}_${name.toLowerCase().replace(/\s+/g, '_')}`,
      name: name.replace(/^["']|["']$/g, ''),
      description: `Character extracted from input: ${name}`,
    }));
  }

  /**
   * Build events from raw text
   */
  private buildEvents(text: string): Event[] {
    const events: Event[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());

    sentences.forEach((sentence, index) => {
      if (sentence.toLowerCase().includes('says') || sentence.toLowerCase().includes('talks')) {
        events.push({
          id: `event_${index}`,
          type: 'dialogue',
          timestamp: index * 10,
          data: { text: sentence.trim() },
        });
      } else if (sentence.toLowerCase().includes('goes') || sentence.toLowerCase().includes('moves')) {
        events.push({
          id: `event_${index}`,
          type: 'action',
          timestamp: index * 10,
          data: { text: sentence.trim() },
        });
      }
    });

    return events;
  }

  /**
   * Batch normalize multiple inputs
   */
  public normalizeBatch(inputs: string[]): SceneSpec[] {
    return inputs.map(input => {
      const parsed = this.parse(input);
      return this.toSceneSpec(parsed);
    });
  }
}

export default InputNormalizer;