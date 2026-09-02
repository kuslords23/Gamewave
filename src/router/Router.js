/**
 * KUS WORLD ENGINE — Hash Router
 *
 * Lightweight client-side hash-based router.
 * Routes: #home, #worlds, #library, #settings, #about
 * Also handles transitions between app modes (landing vs game).
 */

class Router {
  static instance = null;

  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.prevRoute = null;
    this._onHashChange = this._onHashChange.bind(this);
  }

  static getInstance() {
    if (!Router.instance) {
      Router.instance = new Router();
    }
    return Router.instance;
  }

  /**
   * Register a route handler
   * @param {string} hash - e.g. 'home', 'worlds', 'settings'
   * @param {Function} handler - async (params) => void
   */
  register(hash, handler) {
    this.routes.set(hash, handler);
  }

  /**
   * Start listening for hash changes
   */
  start() {
    window.addEventListener('hashchange', this._onHashChange);
    // Handle initial hash
    const hash = location.hash?.slice(1) || 'home';
    this._navigateTo(hash, true);
  }

  /**
   * Stop listening
   */
  stop() {
    window.removeEventListener('hashchange', this._onHashChange);
  }

  /**
   * Programmatically navigate to a route
   */
  navigate(hash, params = {}) {
    location.hash = `#${hash}`;
    // Store params in sessionStorage for the route handler
    if (Object.keys(params).length > 0) {
      sessionStorage.setItem('routeParams', JSON.stringify(params));
    }
  }

  /**
   * Get current route
   */
  getCurrentRoute() {
    return this.currentRoute;
  }

  /**
   * Go back to previous route
   */
  back() {
    if (this.prevRoute) {
      this.navigate(this.prevRoute);
    } else {
      this.navigate('home');
    }
  }

  /**
   * Handle hash change event
   */
  _onHashChange() {
    const hash = location.hash?.slice(1) || 'home';
    this._navigateTo(hash);
  }

  /**
   * Execute a route
   */
  async _navigateTo(hash, initial = false) {
    // Parse hash and params
    let route = hash;
    let params = {};

    // Check for stored params from navigate()
    const storedParams = sessionStorage.getItem('routeParams');
    if (storedParams) {
      try {
        params = JSON.parse(storedParams);
      } catch {}
      sessionStorage.removeItem('routeParams');
    }

    const handler = this.routes.get(route);
    if (!handler) {
      console.warn(`Route not found: #${route}, redirecting to home`);
      if (!initial) location.hash = '#home';
      return;
    }

    this.prevRoute = this.currentRoute;
    this.currentRoute = route;

    try {
      await handler(params);
    } catch (err) {
      console.error(`Route error (#${route}):`, err);
    }
  }
}

export default Router;
export { Router };