/**
 * TabManager - Manages tab selection and state
 */
export class TabManager {
  constructor(categories) {
    this.categories = categories;
    this.activeTab = categories[0] || null;
    this.listeners = [];
  }

  /**
   * Set the active tab
   * @param {string} category - The category to activate
   */
  setActiveTab(category) {
    if (this.categories.includes(category)) {
      this.activeTab = category;
      this.notifyListeners();
    }
  }

  /**
   * Get the currently active tab
   * @returns {string} The active tab category
   */
  getActiveTab() {
    return this.activeTab;
  }

  /**
   * Get all categories
   * @returns {Array<string>} Array of category names
   */
  getCategories() {
    return this.categories;
  }

  /**
   * Check if a category is active
   * @param {string} category - The category to check
   * @returns {boolean} True if active
   */
  isActive(category) {
    return this.activeTab === category;
  }

  /**
   * Register a listener for tab changes
   * @param {Function} callback - Callback function to execute on tab change
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Notify all listeners of tab change
   */
  notifyListeners() {
    this.listeners.forEach(callback => callback(this.activeTab));
  }
}
