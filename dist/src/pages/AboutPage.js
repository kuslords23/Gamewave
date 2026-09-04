/**
 * KUS WORLD ENGINE — About Page
 *
 * Project info, credits, architecture overview, and tech stack.
 */

class AboutPage {
  async render(params) {
    const mainArea = document.getElementById('contentArea');
    if (!mainArea) return;

    document.getElementById('landing')?.classList.add('hidden');
    document.querySelectorAll('.page-content').forEach(el => el.style.display = 'none');

    mainArea.innerHTML = `
      <div class="page-content about-page" style="display:block">
        <div class="about-hero">
          <div class="about-logo">◆</div>
          <h1>KUS WORLD ENGINE</h1>
          <p class="about-tagline">Turn Film Into Playable Worlds</p>
        </div>

        <div class="about-section">
          <h2>🎯 What It Does</h2>
          <p>
            KUS WORLD ENGINE is a browser-based AI game engine that reconstructs movies
            into interactive, explorable 3D environments. Drop a video file, and the engine
            extracts frames, detects scenes, tracks motion, transcribes dialogue, and builds
            a complete 3D world — all in your browser.
          </p>
        </div>

        <div class="about-section">
          <h2>🏗️ Architecture</h2>
          <div class="arch-grid">
            <div class="arch-item">
              <span class="arch-icon">📽️</span>
              <span class="arch-label">Frame Extraction</span>
              <span class="arch-desc">Canvas-based extraction at configurable fps</span>
            </div>
            <div class="arch-item">
              <span class="arch-icon">🔍</span>
              <span class="arch-label">Scene Analysis</span>
              <span class="arch-desc">Histogram shot detection, color/mood analysis</span>
            </div>
            <div class="arch-item">
              <span class="arch-icon">🎙️</span>
              <span class="arch-label">Audio Processing</span>
              <span class="arch-desc">VAD + Web Speech API transcription</span>
            </div>
            <div class="arch-item">
              <span class="arch-icon">🏗️</span>
              <span class="arch-label">3D Reconstruction</span>
              <span class="arch-desc">Smart scene-to-mesh generation</span>
            </div>
            <div class="arch-item">
              <span class="arch-icon">🌍</span>
              <span class="arch-label">World Building</span>
              <span class="arch-desc">Babylon.js scene graph construction</span>
            </div>
            <div class="arch-item">
              <span class="arch-icon">🎮</span>
              <span class="arch-label">Game Play</span>
              <span class="arch-desc">WASD controls, physics, WebGPU rendering</span>
            </div>
          </div>
        </div>

        <div class="about-section">
          <h2>🔧 Tech Stack</h2>
          <div class="tech-grid">
            <div class="tech-item"><span class="tech-name">Babylon.js 7.x</span><span class="tech-desc">WebGPU 3D rendering</span></div>
            <div class="tech-item"><span class="tech-name">WebCodecs</span><span class="tech-desc">Video frame extraction</span></div>
            <div class="tech-item"><span class="tech-name">Web Audio API</span><span class="tech-desc">Audio extraction + VAD</span></div>
            <div class="tech-item"><span class="tech-name">Web Speech API</span><span class="tech-desc">Dialogue transcription</span></div>
            <div class="tech-item"><span class="tech-name">IndexedDB</span><span class="tech-desc">Local world/video storage</span></div>
            <div class="tech-item"><span class="tech-name">ES Modules</span><span class="tech-desc">No build step needed</span></div>
            <div class="tech-item"><span class="tech-name">Canvas API</span><span class="tech-desc">Pixel-level frame analysis</span></div>
            <div class="tech-item"><span class="tech-name">PWA</span><span class="tech-desc">Offline + installable</span></div>
            <div class="tech-item"><span class="tech-name">Importmap</span><span class="tech-desc">CDN package resolution</span></div>
            <div class="tech-item"><span class="tech-name">Service Worker</span><span class="tech-desc">Offline caching</span></div>
            <div class="tech-item"><span class="tech-name">K-Means</span><span class="tech-desc">Dominant color extraction</span></div>
            <div class="tech-item"><span class="tech-name">k-d Tree</span><span class="tech-desc">Spatial scene layout</span></div>
          </div>
        </div>

        <div class="about-section">
          <h2>📋 MVP Roadmap</h2>
          <ul class="roadmap-list">
            <li class="done">✅ Landing page with drag-and-drop video upload</li>
            <li class="done">✅ Babylon.js 3D renderer with WebGPU</li>
            <li class="done">✅ Progressive pipeline with real-time progress</li>
            <li class="done">✅ WASD + mouse/touch controls</li>
            <li class="done">✅ Real video frame extraction</li>
            <li class="done">✅ Scene analysis (shots, colors, motion)</li>
            <li class="done">✅ Audio VAD + speech transcription</li>
            <li class="done">✅ 3D world reconstruction from video data</li>
            <li class="done">✅ World builder with Babylon.js meshes</li>
            <li class="done">✅ PWA — install on phone, offline caching</li>
            <li class="done">✅ My Worlds gallery with IndexedDB</li>
            <li class="done">✅ Video Library</li>
            <li class="done">✅ Settings page</li>
            <li>⬜ Cloud AI workers (Python + PyTorch)</li>
            <li>⬜ Real object detection (YOLO/transformers.js)</li>
            <li>⬜ 3D Gaussian Splatting rendering</li>
            <li>⬜ Character animation extraction</li>
            <li>⬜ Multiplayer support</li>
          </ul>
        </div>

        <div class="about-section credits">
          <h2>❤️ Credits</h2>
          <p>Built with <a href="https://shakespeare.diy" target="_blank">Shakespeare</a> — the AI-powered website builder.</p>
          <p>3D Engine: <a href="https://babylonjs.com" target="_blank">Babylon.js</a></p>
          <p>3D Physics: <a href="https://github.com/dimforge/rapier" target="_blank">Rapier</a></p>
          <p>Font/UI: System UI, Inter</p>
          <br />
          <a href="https://github.com/kuslords23/Gamewave.git" target="_blank" class="btn-primary">
            <span>📦 View on GitHub</span>
          </a>
          <a href="https://shakespeare.diy/clone?url=https%3A%2F%2Fgithub.com%2Fkuslords23%2FGamewave.git" target="_blank" class="btn-secondary" style="margin-left:0.5rem">
            <img src="https://shakespeare.diy/badge.svg" alt="Edit with Shakespeare" style="height:1em;vertical-align:middle" />
            Edit with Shakespeare
          </a>
        </div>

        <div class="about-footer">
          <p>KUS WORLD ENGINE v0.1 — MIT License</p>
          <p>Vibed with <a href="https://shakespeare.diy" target="_blank">Shakespeare</a></p>
        </div>
      </div>
    `;
  }
}

export default AboutPage;
export { AboutPage };