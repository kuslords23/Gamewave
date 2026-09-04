/**
 * KUS WORLD ENGINE — Storage Manager (IndexedDB)
 *
 * Persists worlds, video metadata, and settings in the browser.
 * Uses IndexedDB via a simple Promise-based wrapper.
 */

class StorageManager {
  static instance = null;
  static DB_NAME = 'KusWorldEngine';
  static DB_VERSION = 1;

  constructor() {
    this.db = null;
  }

  static getInstance() {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  /**
   * Open the database and create object stores
   */
  async open() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(StorageManager.DB_NAME, StorageManager.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Worlds store — keyed by world ID
        if (!db.objectStoreNames.contains('worlds')) {
          const store = db.createObjectStore('worlds', { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }

        // Videos store — keyed by video ID
        if (!db.objectStoreNames.contains('videos')) {
          const store = db.createObjectStore('videos', { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('processedAt', 'processedAt', { unique: false });
        }

        // Settings store — single key-value
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject(new Error(`IndexedDB error: ${event.target.error}`));
      };
    });
  }

  /* ════════════════════════════════════
     WORLDS CRUD
     ════════════════════════════════════ */

  /**
   * Save a world to the database
   */
  async saveWorld(world) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('worlds', 'readwrite');
      const store = tx.objectStore('worlds');
      const data = {
        ...world,
        savedAt: new Date().toISOString(),
      };
      // Strip large binary data
      if (data.sceneGraph?.nodes) {
        data.sceneGraph.nodes = data.sceneGraph.nodes.map(n => ({
          ...n,
          // Keep metadata but remove any huge data blobs
          ...(n.metadata ? { metadata: n.metadata } : {}),
        }));
      }
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Load all saved worlds
   */
  async loadWorlds() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('worlds', 'readonly');
      const store = tx.objectStore('worlds');
      const index = store.index('createdAt');
      const request = index.openCursor(null, 'prev'); // newest first

      const worlds = [];
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          worlds.push(cursor.value);
          cursor.continue();
        } else {
          resolve(worlds);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Load a single world by ID
   */
  async loadWorld(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('worlds', 'readonly');
      const store = tx.objectStore('worlds');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a world by ID
   */
  async deleteWorld(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('worlds', 'readwrite');
      const store = tx.objectStore('worlds');
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /* ════════════════════════════════════
     VIDEOS CRUD
     ════════════════════════════════════ */

  /**
   * Save video metadata
   */
  async saveVideo(videoData) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('videos', 'readwrite');
      const store = tx.objectStore('videos');
      const data = {
        ...videoData,
        processedAt: videoData.processedAt || new Date().toISOString(),
      };
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Load all saved videos
   */
  async loadVideos() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('videos', 'readonly');
      const store = tx.objectStore('videos');
      const index = store.index('processedAt');
      const request = index.openCursor(null, 'prev');

      const videos = [];
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          videos.push(cursor.value);
          cursor.continue();
        } else {
          resolve(videos);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a video by ID
   */
  async deleteVideo(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('videos', 'readwrite');
      const store = tx.objectStore('videos');
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /* ════════════════════════════════════
     SETTINGS
     ════════════════════════════════════ */

  /**
   * Get all settings as a plain object
   */
  async getSettings() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const request = store.getAll();

      request.onsuccess = (event) => {
        const entries = event.target.result || [];
        const settings = {};
        entries.forEach(e => { settings[e.key] = e.value; });
        resolve(settings);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a single setting
   */
  async getSetting(key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save a setting
   */
  async saveSetting(key, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const request = store.put({ key, value, updatedAt: new Date().toISOString() });
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save multiple settings at once
   */
  async saveSettings(settingsObj) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const now = new Date().toISOString();

      for (const [key, value] of Object.entries(settingsObj)) {
        store.put({ key, value, updatedAt: now });
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get default settings
   */
  getDefaults() {
    return {
      frameRate: 6,
      maxFrames: 300,
      maxWidth: 640,
      enableWebGPU: true,
      antialias: true,
      adaptiveQuality: true,
      showFps: true,
      extractionQuality: 'balanced', // 'fast' | 'balanced' | 'quality'
      autoSaveWorlds: true,
    };
  }
}

export default StorageManager;
export { StorageManager };