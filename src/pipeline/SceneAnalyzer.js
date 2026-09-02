/**
 * KUS WORLD ENGINE — Scene Analyzer
 *
 * Analyzes extracted frames for:
 * - Shot boundary detection (histogram comparison)
 * - Dominant color / mood analysis
 * - Motion intensity tracking
 * - Scene composition description
 *
 * Uses only client-side canvas analysis — no external AI APIs.
 */

import { FrameExtractor } from './FrameExtractor.js';

class SceneAnalyzer {
  /**
   * Analyze extracted frames to detect shots, colors, motion, and scenes.
   */
  analyze(frameData) {
    const { frames, duration, width, height } = frameData;

    console.log(`🔍 Analyzing ${frames.length} frames...`);

    const shots = this._detectShots(frames);
    console.log(`  📊 ${shots.length} shots detected`);

    const sceneMoods = this._analyzeMoods(shots, frames);
    console.log(`  🎨 ${sceneMoods.length} scene moods computed`);

    const motion = this._analyzeMotion(frames);
    console.log(`  🏃 Motion intensity tracked across ${motion.length} frames`);

    const dominantColors = this._extractDominantColors(shots, frames);
    console.log(`  🖌️ Dominant colors extracted per shot`);

    // Build scene descriptions
    const scenes = this._buildScenes(shots, frames, sceneMoods, dominantColors, motion);

    return {
      shots,
      scenes,
      motion,
      sceneMoods,
      dominantColors,
      totalShots: shots.length,
      totalScenes: scenes.length,
      metadata: {
        analysisTechnique: 'histogram_color_motion',
        duration,
        frameCount: frames.length,
        resolution: `${width}x${height}`,
      },
    };
  }

  /**
   * Detect shot boundaries using histogram comparison
   * A shot change is detected when the histogram distance exceeds a threshold
   */
  _detectShots(frames) {
    const shots = [];
    let currentShotStart = 0;
    const threshold = 0.15; // Histogram distance threshold for cut detection
    const minShotFrames = 3;  // Minimum frames per shot (to avoid noise)

    for (let i = 1; i < frames.length; i++) {
      const distance = FrameExtractor.histogramDistance(
        frames[i - 1].histogram,
        frames[i].histogram
      );

      // Also check motion — low motion + big histogram change = likely cut
      const motion = i > 1 ? FrameExtractor.computeMotion(
        frames[i - 1].imageData,
        frames[i].imageData
      ) : 0;

      const isCut = distance > threshold || (distance > threshold * 0.7 && motion < 0.1);

      if (isCut) {
        const shotLength = i - currentShotStart;
        if (shotLength >= minShotFrames) {
          shots.push({
            id: `shot_${shots.length}`,
            startFrame: currentShotStart,
            endFrame: i - 1,
            startTime: frames[currentShotStart].timestamp,
            endTime: frames[i - 1].timestamp,
            duration: frames[i - 1].timestamp - frames[currentShotStart].timestamp,
            keyFrameIndices: this._selectKeyFrames(frames, currentShotStart, i - 1),
            confidence: Math.min(1, distance * 3),
            cutType: distance > threshold * 2 ? 'hard_cut' : 'soft_transition',
          });
        }
        currentShotStart = i;
      }
    }

    // Final shot
    if (currentShotStart < frames.length - 1) {
      shots.push({
        id: `shot_${shots.length}`,
        startFrame: currentShotStart,
        endFrame: frames.length - 1,
        startTime: frames[currentShotStart].timestamp,
        endTime: frames[frames.length - 1].timestamp,
        duration: frames[frames.length - 1].timestamp - frames[currentShotStart].timestamp,
        keyFrameIndices: this._selectKeyFrames(frames, currentShotStart, frames.length - 1),
        confidence: 0.5,
        cutType: 'end',
      });
    }

    return shots;
  }

  /**
   * Select representative key frames from a shot
   */
  _selectKeyFrames(frames, start, end) {
    const range = end - start;
    if (range <= 1) return [start];

    // Pick up to 3 key frames: beginning, middle, end
    const indices = [start];
    if (range > 2) {
      indices.push(start + Math.floor(range / 2));
    }
    if (range > 1) {
      indices.push(end);
    }

    return indices;
  }

  /**
   * Analyze mood/tone of each shot based on color analysis
   * Computes brightness, saturation, warmth
   */
  _analyzeMoods(shots, frames) {
    return shots.map((shot, idx) => {
      const keyFrameIdx = shot.keyFrameIndices[Math.floor(shot.keyFrameIndices.length / 2)];
      const frame = frames[keyFrameIdx];
      if (!frame) return { shotId: shot.id, mood: 'unknown', brightness: 0.5, warmth: 0.5 };

      const imageData = frame.imageData;
      const data = imageData.data;
      const len = data.length;
      const step = Math.max(1, Math.floor(len / (100 * 100)));

      let totalBrightness = 0;
      let totalSaturation = 0;
      let totalWarmth = 0;
      let count = 0;

      for (let i = 0; i < len; i += 4 * step) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Brightness (perceived luminance)
        totalBrightness += (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        // Saturation (max - min / max)
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        totalSaturation += max > 0 ? (max - min) / max : 0;

        // Warmth (r - b normalized)
        totalWarmth += (r - b) / 255 + 0.5;

        count++;
      }

      const brightness = totalBrightness / count;
      const saturation = totalSaturation / count;
      const warmth = totalWarmth / count;

      // Classify mood
      let mood;
      if (brightness < 0.3) mood = 'dark';
      else if (brightness > 0.7) mood = 'bright';
      else if (warmth > 0.6) mood = 'warm';
      else if (warmth < 0.4) mood = 'cool';
      else if (saturation > 0.5) mood = 'vibrant';
      else mood = 'neutral';

      return {
        shotId: shot.id,
        brightness: Math.round(brightness * 100) / 100,
        saturation: Math.round(saturation * 100) / 100,
        warmth: Math.round(warmth * 100) / 100,
        mood,
        label: this._moodLabel(brightness, saturation, warmth),
      };
    });
  }

  _moodLabel(brightness, saturation, warmth) {
    if (brightness < 0.25) return '🔦 Dim / Night';
    if (brightness < 0.4) return '🌆 Twilight / Interior';
    if (warmth > 0.65 && brightness > 0.5) return '🌅 Golden hour / Warm';
    if (saturation > 0.5 && brightness > 0.5) return '🌈 Vivid / Colorful';
    if (brightness > 0.7) return '☀️ Bright daylight';
    if (warmth < 0.35) return '🌊 Cool / Blue tone';
    return '🌤️ Natural / Neutral';
  }

  /**
   * Analyze motion intensity across frames using frame differencing
   */
  _analyzeMotion(frames) {
    const motionData = [];

    for (let i = 1; i < frames.length; i++) {
      const motion = FrameExtractor.computeMotion(
        frames[i - 1].imageData,
        frames[i].imageData
      );
      motionData.push({
        frameIndex: i,
        timestamp: frames[i].timestamp,
        intensity: Math.round(motion * 100) / 100,
        label: motion > 0.3 ? 'high' : motion > 0.1 ? 'medium' : 'low',
      });
    }

    return motionData;
  }

  /**
   * Extract dominant colors from each shot
   */
  _extractDominantColors(shots, frames) {
    return shots.map((shot) => {
      const midIdx = Math.floor(shot.keyFrameIndices.length / 2);
      const frameIdx = shot.keyFrameIndices[midIdx];
      const frame = frames[frameIdx];
      if (!frame) return { shotId: shot.id, colors: [] };

      return {
        shotId: shot.id,
        colors: this._medianCutQuantize(frame.imageData, 4),
      };
    });
  }

  /**
   * Simple color quantization using median cut algorithm
   * Returns N dominant colors as RGB arrays
   */
  _medianCutQuantize(imageData, numColors) {
    const data = imageData.data;
    const pixels = [];
    const step = Math.max(1, Math.floor(data.length / 4 / 5000));

    for (let i = 0; i < data.length; i += 4 * step) {
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }

    if (pixels.length === 0) return [];

    // Simple k-means clustering with k = numColors
    const centroids = [];
    // Initialize centroids randomly
    for (let k = 0; k < numColors; k++) {
      centroids.push(pixels[Math.floor(Math.random() * pixels.length)].slice());
    }

    for (let iter = 0; iter < 5; iter++) {
      const clusters = Array.from({ length: numColors }, () => []);

      for (const pixel of pixels) {
        let minDist = Infinity;
        let closest = 0;
        for (let k = 0; k < numColors; k++) {
          const dist = (pixel[0] - centroids[k][0]) ** 2 +
                        (pixel[1] - centroids[k][1]) ** 2 +
                        (pixel[2] - centroids[k][2]) ** 2;
          if (dist < minDist) {
            minDist = dist;
            closest = k;
          }
        }
        clusters[closest].push(pixel);
      }

      for (let k = 0; k < numColors; k++) {
        if (clusters[k].length > 0) {
          const sum = clusters[k].reduce(
            (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]],
            [0, 0, 0]
          );
          centroids[k] = sum.map(v => Math.round(v / clusters[k].length));
        }
      }
    }

    return centroids.map((rgb, idx) => ({
      rgb,
      hex: '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join(''),
      label: this._colorName(rgb[0], rgb[1], rgb[2]),
      fraction: 1 / numColors,
    }));
  }

  /**
   * Map RGB values to human-readable color names
   */
  _colorName(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max > 0 ? (max - min) / max : 0;

    if (max < 30) return 'black';
    if (max > 230 && sat < 0.1) return 'white';
    if (sat < 0.1) return 'gray';

    if (r > 200 && g < 100 && b < 100) return 'red';
    if (r > 200 && g > 100 && b < 100) return 'orange';
    if (r > 200 && g > 150 && b < 80) return 'yellow';
    if (r < 100 && g > 150 && b < 100) return 'green';
    if (r < 100 && g < 100 && b > 180) return 'blue';
    if (r > 100 && g < 100 && b > 100) return 'purple';
    if (r < 80 && g > 100 && b > 100) return 'teal';
    if (r > 150 && g > 100 && b > 150) return 'pink';
    if (r > 150 && g > 150 && b < 100) return 'brown';
    return 'mixed';
  }

  /**
   * Build structured scenes from shot analysis
   * Groups related shots into scenes based on color/mood continuity
   */
  _buildScenes(shots, frames, moods, colors, motion) {
    const scenes = [];
    let currentSceneShots = [shots[0]];
    let currentMood = moods[0];

    for (let i = 1; i < shots.length; i++) {
      const prevMood = moods[i - 1];
      const currMood = moods[i];

      // If mood changes significantly, it's a new scene
      const moodShift = Math.abs(
        (prevMood?.brightness || 0.5) - (currMood?.brightness || 0.5)
      );

      if (moodShift > 0.3) {
        scenes.push(this._createScene(scenes.length, currentSceneShots, frames, moods, colors, motion));
        currentSceneShots = [shots[i]];
      } else {
        currentSceneShots.push(shots[i]);
      }
    }

    // Last scene
    if (currentSceneShots.length > 0) {
      scenes.push(this._createScene(scenes.length, currentSceneShots, frames, moods, colors, motion));
    }

    return scenes;
  }

  _createScene(index, sceneShots, frames, moods, colors, motion) {
    const firstShot = sceneShots[0];
    const lastShot = sceneShots[sceneShots.length - 1];
    const startFrame = firstShot.startFrame;
    const endFrame = lastShot.endFrame;

    // Compute average mood for the scene
    const sceneMoods = sceneShots.map(s => moods.find(m => m.shotId === s.id)).filter(Boolean);
    const avgBrightness = sceneMoods.reduce((a, m) => a + m.brightness, 0) / sceneMoods.length;
    const avgWarmth = sceneMoods.reduce((a, m) => a + m.warmth, 0) / sceneMoods.length;

    // Compute motion intensity for the scene
    const sceneMotion = motion.filter(m =>
      m.timestamp >= frames[startFrame]?.timestamp &&
      m.timestamp <= frames[endFrame]?.timestamp
    );
    const avgMotion = sceneMotion.reduce((a, m) => a + m.intensity, 0) / Math.max(1, sceneMotion.length);

    // Scene type based on characteristics
    let type = 'generic';
    if (avgMotion < 0.05 && avgBrightness < 0.4) type = 'interior_dark';
    else if (avgMotion < 0.05 && avgBrightness > 0.6) type = 'exterior_static';
    else if (avgMotion > 0.2) type = 'action';
    else if (avgBrightness > 0.7) type = 'outdoor_bright';
    else if (avgWarmth > 0.6) type = 'warm_interior';

    return {
      id: `scene_${index}`,
      name: `Scene ${index + 1}`,
      shotIds: sceneShots.map(s => s.id),
      startFrame,
      endFrame,
      startTime: frames[startFrame]?.timestamp || 0,
      endTime: frames[endFrame]?.timestamp || 0,
      duration: (frames[endFrame]?.timestamp || 0) - (frames[startFrame]?.timestamp || 0),
      type,
      mood: {
        brightness: Math.round(avgBrightness * 100) / 100,
        warmth: Math.round(avgWarmth * 100) / 100,
        label: this._moodLabel(avgBrightness, 0.3, avgWarmth),
      },
      motion: Math.round(avgMotion * 100) / 100,
      dominantColors: colors[index]?.colors || [],
      keyFrame: frames[Math.floor((startFrame + endFrame) / 2)],
    };
  }
}

export default SceneAnalyzer;
export { SceneAnalyzer };