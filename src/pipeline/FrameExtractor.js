/**
 * KUS WORLD ENGINE — Frame Extractor
 *
 * Extracts frames and audio from a video file using:
 * - <video> element + canvas for frame extraction
 * - Web Audio API for audio decoding
 *
 * Production-ready with configurable frame sampling rate.
 */

class FrameExtractor {
  constructor(options = {}) {
    this.maxFrames = options.maxFrames || 300;       // Max frames to extract
    this.targetFrameRate = options.frameRate || 6;    // Extract at N fps (not 24/30)
    this.maxWidth = options.maxWidth || 640;           // Scale down for performance
    this.video = null;
    this.audioContext = null;
  }

  /**
   * Extract frames from a video file at the configured sampling rate.
   * Returns metadata + frame data for analysis.
   */
  async extract(file, onProgress) {
    const video = await this._loadVideo(file);
    this.video = video;

    const duration = video.duration;
    const width = Math.min(video.videoWidth, this.maxWidth);
    const height = Math.round(video.videoHeight * (width / video.videoWidth));
    const sampleInterval = 1 / this.targetFrameRate; // seconds between frames
    const totalSamples = Math.min(
      Math.ceil(duration / sampleInterval),
      this.maxFrames
    );

    console.log(`📽️ Video: ${duration.toFixed(1)}s, ${width}x${height}, extracting ~${totalSamples} frames at ${this.targetFrameRate}fps`);

    const frames = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;

    let lastTime = 0;

    for (let i = 0; i < totalSamples; i++) {
      const time = i * sampleInterval;

      // Seek to time
      video.currentTime = time;

      // Wait for the seek to complete
      await new Promise((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
        // If already at the right time, resolve immediately
        if (Math.abs(video.currentTime - time) < 0.01) {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        }
      });

      // Draw frame to canvas
      ctx.drawImage(video, 0, 0, width, height);

      // Extract pixel data for analysis
      const imageData = ctx.getImageData(0, 0, width, height);

      // Create a smaller thumbnail (for storage/display)
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 160;
      thumbCanvas.height = Math.round(height * (160 / width));
      const thumbCtx = thumbCanvas.getContext('2d');
      thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

      frames.push({
        index: i,
        timestamp: time,
        width,
        height,
        imageData,             // Full pixel data for analysis
        dataUrl: thumbCanvas.toDataURL('image/jpeg', 0.7), // Compressed thumbnail
        histogram: this._computeHistogram(imageData),
      });

      // Progress
      const pct = Math.round(((i + 1) / totalSamples) * 100);
      if (onProgress) onProgress(pct, i + 1, totalSamples);

      // Allow browser to breathe every 10 frames
      if (i % 10 === 0) {
        await this._delay(0);
      }
    }

    // Extract audio data
    const audioData = await this._extractAudio(file, video);

    return {
      duration,
      width,
      height,
      totalFrames: totalSamples,
      frameRate: this.targetFrameRate,
      frames,
      audioData,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        extractedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Load video file into an HTML video element
   */
  _loadVideo(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;

      const url = URL.createObjectURL(file);
      video.src = url;

      video.onloadedmetadata = () => {
        resolve(video);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load video'));
      };
    });
  }

  /**
   * Extract audio from video using Web Audio API
   */
  async _extractAudio(file, video) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));

      // Downsample to 16kHz mono for speech processing
      const targetSampleRate = 16000;
      const duration = audioBuffer.duration;
      const originalLength = audioBuffer.length;
      const originalSampleRate = audioBuffer.sampleRate;

      // Get mono data
      const channelData = audioBuffer.getChannelData(0);

      // Resample
      const resampledLength = Math.round(duration * targetSampleRate);
      const resampled = new Float32Array(resampledLength);
      const ratio = originalSampleRate / targetSampleRate;

      for (let i = 0; i < resampledLength; i++) {
        const srcIndex = Math.round(i * ratio);
        resampled[i] = channelData[Math.min(srcIndex, originalLength - 1)];
      }

      return {
        sampleRate: targetSampleRate,
        duration,
        channels: 1,
        samples: resampled,
        numberOfSamples: resampledLength,
      };
    } catch (err) {
      console.warn('Audio extraction failed:', err.message);
      return null;
    }
  }

  /**
   * Compute color histogram from image data
   * Uses 8-bin per channel (RGB) for efficient comparison
   */
  _computeHistogram(imageData) {
    const bins = 8;
    const histogram = new Float32Array(bins * bins * bins);
    const data = imageData.data;
    const totalPixels = imageData.width * imageData.height;
    const step = Math.max(1, Math.floor(totalPixels / 10000)); // Sample for performance

    for (let i = 0; i < data.length; i += 4 * step) {
      const r = Math.floor((data[i] / 256) * bins);
      const g = Math.floor((data[i + 1] / 256) * bins);
      const b = Math.floor((data[i + 2] / 256) * bins);
      const idx = r * bins * bins + g * bins + b;
      histogram[idx]++;
    }

    // Normalize
    const total = Math.min(totalPixels, 10000);
    for (let i = 0; i < histogram.length; i++) {
      histogram[i] /= total;
    }

    return histogram;
  }

  /**
   * Compare two histograms using chi-squared distance
   */
  static histogramDistance(h1, h2) {
    let distance = 0;
    for (let i = 0; i < h1.length; i++) {
      const sum = h1[i] + h2[i];
      if (sum > 0) {
        distance += ((h1[i] - h2[i]) ** 2) / sum;
      }
    }
    return distance / h1.length;
  }

  /**
   * Compute frame difference (motion) between two image frames
   * Returns a motion score between 0 and 1
   */
  static computeMotion(prevData, currData) {
    const prev = prevData.data;
    const curr = currData.data;
    const len = Math.min(prev.length, curr.length);
    const step = Math.max(1, Math.floor(len / (64 * 64))); // Sample grid

    let diff = 0;
    let count = 0;

    for (let i = 0; i < len; i += 4 * step) {
      const dr = Math.abs(prev[i] - curr[i]);
      const dg = Math.abs(prev[i + 1] - curr[i + 1]);
      const db = Math.abs(prev[i + 2] - curr[i + 2]);
      diff += (dr + dg + db) / 3;
      count++;
    }

    return Math.min(1, diff / (count * 255) * 3);
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  dispose() {
    if (this.video) {
      URL.revokeObjectURL(this.video.src);
      this.video = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export default FrameExtractor;
export { FrameExtractor };