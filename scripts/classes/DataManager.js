import { MODULE_ID, FLAG_KEYS, DATA_VERSION } from '../constants.js';

export class DataManager {
  constructor() {
    this.data = null;
    this.defaultData = null;
    this.customData = {};
    this.modifiedActions = new Set();
    this.mainCategories = [];
    this.originalDefaultData = null;
  }

  async loadData() {
    try {
      await this.initializeFromFlags();
      this.mergeData();
      return this.data;
    } catch (error) {
      console.error('DataManager: Error loading data', error);
      ui.notifications.error('Failed to load actions data');
      return null;
    }
  }

  async initializeFromFlags() {
    const storedVersion = game.settings.get(MODULE_ID, FLAG_KEYS.DATA_VERSION);
    const storedDefaultData = game.settings.get(MODULE_ID, FLAG_KEYS.DEFAULT_DATA);
    const storedCustomData = game.settings.get(MODULE_ID, FLAG_KEYS.CUSTOM_DATA);
    const storedModified = game.settings.get(MODULE_ID, FLAG_KEYS.MODIFIED_ACTIONS);

    if (!storedDefaultData || storedVersion !== DATA_VERSION) {
      await this.initializeDefaultData();
    } else {
      this.defaultData = storedDefaultData;
      this.customData = storedCustomData || {};
      this.modifiedActions = new Set(storedModified || []);
    }

    await this.migrateFromLocalStorage();
  }

  async initializeDefaultData() {
    try {
      const response = await fetch('modules/gurps-rules-companion/data.json');
      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.statusText}`);
      }
      const jsonData = await response.json();
      this.originalDefaultData = JSON.parse(JSON.stringify(jsonData));
      this.defaultData = jsonData;
      this.customData = {};
      this.modifiedActions = new Set();

      await this.saveToFlags();
      await game.settings.set(MODULE_ID, FLAG_KEYS.DATA_VERSION, DATA_VERSION);

      console.log('DataManager: Initialized default data from JSON');
    } catch (error) {
      console.error('DataManager: Error initializing default data', error);
      throw error;
    }
  }

  async migrateFromLocalStorage() {
    if (!game.user) return;

    try {
      const storageKey = `gurps-rules-companion-custom-data-${game.user.id}`;
      const stored = localStorage.getItem(storageKey);

      if (stored && Object.keys(this.customData).length === 0) {
        const oldCustomData = JSON.parse(stored);
        this.customData = oldCustomData;
        await this.saveToFlags();
        localStorage.removeItem(storageKey);
        console.log('DataManager: Migrated data from localStorage to flags');
      }
    } catch (error) {
      console.error('DataManager: Error migrating from localStorage', error);
    }
  }

  async saveToFlags() {
    try {
      await game.settings.set(MODULE_ID, FLAG_KEYS.DEFAULT_DATA, this.defaultData);
      await game.settings.set(MODULE_ID, FLAG_KEYS.CUSTOM_DATA, this.customData);
      await game.settings.set(MODULE_ID, FLAG_KEYS.MODIFIED_ACTIONS, Array.from(this.modifiedActions));
      console.log('DataManager: Data saved to flags');
    } catch (error) {
      console.error('DataManager: Error saving to flags', error);
      throw error;
    }
  }

  isActionModified(mainCategory, subcategory, actionIndex) {
    const key = subcategory
      ? `${mainCategory}:${subcategory}:${actionIndex}`
      : `${mainCategory}:${actionIndex}`;
    return this.modifiedActions.has(key);
  }

  markActionAsModified(mainCategory, subcategory, actionIndex) {
    const key = subcategory
      ? `${mainCategory}:${subcategory}:${actionIndex}`
      : `${mainCategory}:${actionIndex}`;
    this.modifiedActions.add(key);
  }

  unmarkActionAsModified(mainCategory, subcategory, actionIndex) {
    const key = subcategory
      ? `${mainCategory}:${subcategory}:${actionIndex}`
      : `${mainCategory}:${actionIndex}`;
    this.modifiedActions.delete(key);
  }

  mergeData() {
    this.data = JSON.parse(JSON.stringify(this.defaultData));

    Object.keys(this.customData).forEach(category => {
      if (!this.data[category]) {
        this.data[category] = this.customData[category];
      } else {
        const isDefaultArray = Array.isArray(this.data[category]);
        const isCustomArray = Array.isArray(this.customData[category]);

        if (isDefaultArray && isCustomArray) {
          this.data[category] = [...this.data[category], ...this.customData[category]];
        } else if (!isDefaultArray && !isCustomArray) {
          Object.keys(this.customData[category]).forEach(subcategory => {
            if (!this.data[category][subcategory]) {
              this.data[category][subcategory] = this.customData[category][subcategory];
            } else {
              this.data[category][subcategory] = [
                ...this.data[category][subcategory],
                ...this.customData[category][subcategory]
              ];
            }
          });
        } else if (isDefaultArray && !isCustomArray) {
          const existingActions = this.data[category];
          this.data[category] = { ...this.customData[category] };
          this.data[category]['default'] = existingActions;
        } else if (!isDefaultArray && isCustomArray) {
          this.data[category]['custom'] = this.customData[category];
        }
      }
    });

    this.mainCategories = Object.keys(this.data);
  }

  async setCustomData(customData) {
    this.customData = customData;
    await this.saveToFlags();
    this.mergeData();
  }

  async updateDefaultAction(mainCategory, subcategory, actionIndex, updatedAction) {
    if (subcategory) {
      if (!this.defaultData[mainCategory] || !this.defaultData[mainCategory][subcategory]) {
        throw new Error('Invalid category or subcategory');
      }
      this.defaultData[mainCategory][subcategory][actionIndex] = updatedAction;
    } else {
      if (!this.defaultData[mainCategory] || !Array.isArray(this.defaultData[mainCategory])) {
        throw new Error('Invalid category');
      }
      this.defaultData[mainCategory][actionIndex] = updatedAction;
    }

    this.markActionAsModified(mainCategory, subcategory, actionIndex);
    await this.saveToFlags();
    this.mergeData();
  }

  async deleteDefaultAction(mainCategory, subcategory, actionIndex) {
    if (subcategory) {
      if (!this.defaultData[mainCategory] || !this.defaultData[mainCategory][subcategory]) {
        throw new Error('Invalid category or subcategory');
      }
      this.defaultData[mainCategory][subcategory].splice(actionIndex, 1);
      if (this.defaultData[mainCategory][subcategory].length === 0) {
        delete this.defaultData[mainCategory][subcategory];
      }
    } else {
      if (!this.defaultData[mainCategory] || !Array.isArray(this.defaultData[mainCategory])) {
        throw new Error('Invalid category');
      }
      this.defaultData[mainCategory].splice(actionIndex, 1);
      if (this.defaultData[mainCategory].length === 0) {
        delete this.defaultData[mainCategory];
      }
    }

    this.unmarkActionAsModified(mainCategory, subcategory, actionIndex);
    await this.saveToFlags();
    this.mergeData();
  }

  async addCustomAction(mainCategory, subcategory, action) {
    if (subcategory) {
      if (!this.customData[mainCategory]) {
        this.customData[mainCategory] = {};
      }
      if (!this.customData[mainCategory][subcategory]) {
        this.customData[mainCategory][subcategory] = [];
      }
      this.customData[mainCategory][subcategory].push(action);
    } else {
      if (!this.customData[mainCategory]) {
        this.customData[mainCategory] = [];
      }
      this.customData[mainCategory].push(action);
    }

    await this.saveToFlags();
    this.mergeData();
  }

  async updateCustomAction(mainCategory, subcategory, actionIndex, updatedAction) {
    if (subcategory) {
      if (!this.customData[mainCategory] || !this.customData[mainCategory][subcategory]) {
        throw new Error('Invalid category or subcategory');
      }
      this.customData[mainCategory][subcategory][actionIndex] = updatedAction;
    } else {
      if (!this.customData[mainCategory] || !Array.isArray(this.customData[mainCategory])) {
        throw new Error('Invalid category');
      }
      this.customData[mainCategory][actionIndex] = updatedAction;
    }

    await this.saveToFlags();
    this.mergeData();
  }

  async deleteCustomAction(mainCategory, subcategory, actionIndex) {
    if (subcategory) {
      if (!this.customData[mainCategory] || !this.customData[mainCategory][subcategory]) {
        throw new Error('Invalid category or subcategory');
      }
      this.customData[mainCategory][subcategory].splice(actionIndex, 1);
      if (this.customData[mainCategory][subcategory].length === 0) {
        delete this.customData[mainCategory][subcategory];
      }
    } else {
      if (!this.customData[mainCategory] || !Array.isArray(this.customData[mainCategory])) {
        throw new Error('Invalid category');
      }
      this.customData[mainCategory].splice(actionIndex, 1);
      if (this.customData[mainCategory].length === 0) {
        delete this.customData[mainCategory];
      }
    }

    await this.saveToFlags();
    this.mergeData();
  }

  async resetToDefaults() {
    try {
      const response = await fetch('modules/gurps-rules-companion/data.json');
      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.statusText}`);
      }
      const jsonData = await response.json();
      this.defaultData = jsonData;
      this.customData = {};
      this.modifiedActions = new Set();

      await this.saveToFlags();
      this.mergeData();

      ui.notifications.info('All data has been reset to defaults');
    } catch (error) {
      console.error('DataManager: Error resetting to defaults', error);
      ui.notifications.error('Failed to reset to defaults');
      throw error;
    }
  }

  async resetCustomData() {
    this.customData = {};
    await this.saveToFlags();
    this.mergeData();
    ui.notifications.info('Custom data has been reset');
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
    const action = actions[index] || null;

    if (action) {
      return {
        ...action,
        isModified: this.isActionModified(mainCategory, subcategory, index)
      };
    }

    return null;
  }

  getActionSource(mainCategory, subcategory, index) {
    if (subcategory) {
      const defaultActions = this.defaultData?.[mainCategory]?.[subcategory] || [];
      if (index < defaultActions.length) {
        return 'default';
      }
      return 'custom';
    } else {
      const defaultActions = this.defaultData?.[mainCategory] || [];
      if (Array.isArray(defaultActions) && index < defaultActions.length) {
        return 'default';
      }
      return 'custom';
    }
  }

  async exportAllData() {
    return {
      version: DATA_VERSION,
      defaultData: this.defaultData,
      customData: this.customData,
      modifiedActions: Array.from(this.modifiedActions)
    };
  }

  async importAllData(importedData) {
    if (importedData.version !== DATA_VERSION) {
      ui.notifications.warn('Imported data version mismatch. Proceeding with caution.');
    }

    this.defaultData = importedData.defaultData || this.defaultData;
    this.customData = importedData.customData || {};
    this.modifiedActions = new Set(importedData.modifiedActions || []);

    await this.saveToFlags();
    this.mergeData();
    ui.notifications.info('Data imported successfully');
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
