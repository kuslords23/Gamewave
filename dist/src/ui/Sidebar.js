/**
 * KUS WORLD ENGINE — Sidebar Navigation
 *
 * Persistent sidebar with links to all pages.
 * Shows/hides based on current state (hidden during gameplay).
 */

class Sidebar {
  constructor() {
    this.el = document.getElementById('sidebar');
    this.toggleBtn = document.getElementById('sidebarToggle');
    this._setupListeners();
  }

  _setupListeners() {
    // Toggle sidebar on mobile
    this.toggleBtn?.addEventListener('click', () => {
      this.el.classList.toggle('open');
    });
  }

  /**
   * Update the active nav item based on current route
   */
  setActive(route) {
    this.el?.querySelectorAll('.nav-item').forEach(item => {
      const href = item.getAttribute('href') || '';
      const itemRoute = href.replace('#', '');
      item.classList.toggle('active', itemRoute === route);
    });
    // Close on mobile after navigation
    this.el?.classList.remove('open');
  }

  /**
   * Show or hide the sidebar
   */
  setVisible(visible) {
    this.el?.classList.toggle('hidden', !visible);
  }

  /**
   * Check if sidebar is visible
   */
  isVisible() {
    return this.el && !this.el.classList.contains('hidden');
  }
}

export default Sidebar;
export { Sidebar };