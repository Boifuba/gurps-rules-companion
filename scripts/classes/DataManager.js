export class DataManager {
  constructor() {
    this.data = null;
    this.mainCategories = [];
  }

  async loadData() {
    try {
      const response = await fetch('modules/gurps-rules-companion/data.json');
      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.statusText}`);
      }
      this.data = await response.json();
      this.mainCategories = Object.keys(this.data);
      return this.data;
    } catch (error) {
      console.error('DataManager: Error loading data', error);
      ui.notifications.error('Failed to load actions data');
      return null;
    }
  }

  getMainCategories() {
    return this.mainCategories;
  }

  getSubcategories(mainCategory) {
    if (!this.data || !this.data[mainCategory]) {
      return [];
    }

    const categoryData = this.data[mainCategory];

    if (Array.isArray(categoryData)) {
      return [];
    }

    if (typeof categoryData === 'object') {
      return Object.keys(categoryData);
    }

    return [];
  }

  getActionsForSubcategory(mainCategory, subcategory) {
    if (!this.data || !this.data[mainCategory]) {
      return [];
    }

    const categoryData = this.data[mainCategory];

    if (typeof categoryData === 'object' && !Array.isArray(categoryData)) {
      return categoryData[subcategory] || [];
    }

    return [];
  }

  getActionsForMainCategory(mainCategory) {
    if (!this.data || !this.data[mainCategory]) {
      return [];
    }

    const categoryData = this.data[mainCategory];

    if (Array.isArray(categoryData)) {
      return categoryData;
    }

    return [];
  }

  getAction(mainCategory, subcategory, index) {
    const actions = subcategory
      ? this.getActionsForSubcategory(mainCategory, subcategory)
      : this.getActionsForMainCategory(mainCategory);
    return actions[index] || null;
  }

  formatCategoryName(category) {
    return category
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  hasSubcategories(mainCategory) {
    if (!this.data || !this.data[mainCategory]) {
      return false;
    }
    const categoryData = this.data[mainCategory];
    return typeof categoryData === 'object' && !Array.isArray(categoryData);
  }
}
