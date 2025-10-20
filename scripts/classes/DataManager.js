import { MODULE_ID, FLAG_KEYS, DATA_VERSION } from '../constants.js';

export class DataManager {
  constructor() {
    this.data = null;
    this.defaultData = null;
    this.customData = {};
    this.defaultOverrides = {};
    this.deletedDefaultActions = new Set();
    this.modifiedActions = new Set();
    this.mainCategories = [];
    this.defaultIndexMap = new Map();
    this.defaultActionCounts = new Map();
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
    const storedOverrides = game.settings.get(MODULE_ID, FLAG_KEYS.DEFAULT_OVERRIDES);
    const storedDeleted = game.settings.get(MODULE_ID, FLAG_KEYS.DELETED_DEFAULT_ACTIONS);

    if (!storedDefaultData || storedVersion !== DATA_VERSION) {
      await this.initializeDefaultData({
        customData: storedCustomData,
        defaultOverrides: storedOverrides,
        deletedDefaultActions: storedDeleted,
        modifiedActions: storedModified
      });
    } else {
      this.defaultData = storedDefaultData;
      this.customData = storedCustomData || {};
      this.defaultOverrides = storedOverrides || {};
      this.deletedDefaultActions = new Set(storedDeleted || []);
      this.modifiedActions = new Set(storedModified || []);
    }

    await this.migrateFromLocalStorage();
  }

  async initializeDefaultData({ customData = {}, defaultOverrides = {}, deletedDefaultActions = [], modifiedActions = [] } = {}) {
    try {
      const response = await fetch('modules/gurps-rules-companion/data.json');
      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.statusText}`);
      }
      const jsonData = await response.json();
      this.defaultData = jsonData;
      this.customData = customData || {};
      this.defaultOverrides = defaultOverrides || {};
      this.deletedDefaultActions = new Set(deletedDefaultActions || []);
      this.modifiedActions = new Set(modifiedActions || []);

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
      await game.settings.set(MODULE_ID, FLAG_KEYS.DEFAULT_OVERRIDES, this.defaultOverrides);
      await game.settings.set(MODULE_ID, FLAG_KEYS.DELETED_DEFAULT_ACTIONS, Array.from(this.deletedDefaultActions));
      await game.settings.set(MODULE_ID, FLAG_KEYS.MODIFIED_ACTIONS, Array.from(this.modifiedActions));
      console.log('DataManager: Data saved to flags');
    } catch (error) {
      console.error('DataManager: Error saving to flags', error);
      throw error;
    }
  }

  _deepClone(data) {
    return data === undefined ? data : JSON.parse(JSON.stringify(data));
  }

  _buildActionKey(mainCategory, subcategory, index) {
    return subcategory
      ? `${mainCategory}:${subcategory}:${index}`
      : `${mainCategory}:${index}`;
  }

  _buildIndexKey(mainCategory, subcategory) {
    return subcategory ? `${mainCategory}::${subcategory}` : mainCategory;
  }

  _getOverrideContainer(mainCategory, subcategory, { create = false } = {}) {
    if (subcategory) {
      if (!this.defaultOverrides[mainCategory]) {
        if (!create) return undefined;
        this.defaultOverrides[mainCategory] = {};
      }
      if (!this.defaultOverrides[mainCategory][subcategory]) {
        if (!create) return undefined;
        this.defaultOverrides[mainCategory][subcategory] = {};
      }
      return this.defaultOverrides[mainCategory][subcategory];
    }

    if (!this.defaultOverrides[mainCategory]) {
      if (!create) return undefined;
      this.defaultOverrides[mainCategory] = {};
    }
    return this.defaultOverrides[mainCategory];
  }

  _cleanupOverrideContainer(mainCategory, subcategory) {
    if (subcategory) {
      const categoryContainer = this.defaultOverrides[mainCategory];
      if (!categoryContainer) return;
      const subContainer = categoryContainer[subcategory];
      if (subContainer && Object.keys(subContainer).length === 0) {
        delete categoryContainer[subcategory];
      }
      if (Object.keys(categoryContainer).length === 0) {
        delete this.defaultOverrides[mainCategory];
      }
      return;
    }

    const container = this.defaultOverrides[mainCategory];
    if (container && Object.keys(container).length === 0) {
      delete this.defaultOverrides[mainCategory];
    }
  }

  _applyDefaultArrays(mainCategory, subcategory, actionsArray) {
    if (!Array.isArray(actionsArray)) {
      return actionsArray;
    }

    const overrides = this._getOverrideContainer(mainCategory, subcategory) || {};
    const indexKey = this._buildIndexKey(mainCategory, subcategory);
    const resultingActions = [];
    const indexMap = [];

    actionsArray.forEach((action, originalIndex) => {
      const actionKey = this._buildActionKey(mainCategory, subcategory, originalIndex);
      if (this.deletedDefaultActions.has(actionKey)) {
        return;
      }

      const override = overrides[originalIndex];
      const finalAction = override ? this._deepClone(override) : this._deepClone(action);
      resultingActions.push(finalAction);
      indexMap.push(originalIndex);
    });

    this.defaultIndexMap.set(indexKey, indexMap);
    this.defaultActionCounts.set(indexKey, resultingActions.length);

    return resultingActions;
  }

  isActionModified(mainCategory, subcategory, actionIndex) {
    const originalIndex = this.getOriginalDefaultIndex(mainCategory, subcategory, actionIndex);
    if (originalIndex === null) {
      return false;
    }
    const key = this._buildActionKey(mainCategory, subcategory, originalIndex);
    return this.modifiedActions.has(key);
  }

  markActionAsModified(mainCategory, subcategory, actionIndex, { originalIndex = false } = {}) {
    const original = originalIndex
      ? actionIndex
      : this.getOriginalDefaultIndex(mainCategory, subcategory, actionIndex);

    if (original === null) {
      return;
    }

    const key = this._buildActionKey(mainCategory, subcategory, original);
    this.modifiedActions.add(key);
  }

  unmarkActionAsModified(mainCategory, subcategory, actionIndex, { originalIndex = false } = {}) {
    const original = originalIndex
      ? actionIndex
      : this.getOriginalDefaultIndex(mainCategory, subcategory, actionIndex);

    if (original === null) {
      return;
    }

    const key = this._buildActionKey(mainCategory, subcategory, original);
    this.modifiedActions.delete(key);
  }

  mergeData() {
    this.defaultIndexMap = new Map();
    this.defaultActionCounts = new Map();

    const baseData = this._deepClone(this.defaultData) || {};

    Object.keys(baseData).forEach(category => {
      const categoryData = baseData[category];

      if (Array.isArray(categoryData)) {
        baseData[category] = this._applyDefaultArrays(category, null, categoryData);
      } else if (typeof categoryData === 'object' && categoryData !== null) {
        Object.keys(categoryData).forEach(subcategory => {
          const subData = categoryData[subcategory];
          if (Array.isArray(subData)) {
            categoryData[subcategory] = this._applyDefaultArrays(category, subcategory, subData);
          }
        });
      }
    });

    this.data = baseData;

    Object.keys(this.customData).forEach(category => {
      const customCategory = this.customData[category];
      const existing = this.data[category];

      if (existing === undefined) {
        this.data[category] = this._deepClone(customCategory);

        if (Array.isArray(customCategory)) {
          this.defaultActionCounts.set(this._buildIndexKey(category, null), 0);
          this.defaultIndexMap.set(this._buildIndexKey(category, null), []);
        } else if (typeof customCategory === 'object' && customCategory !== null) {
          Object.keys(customCategory).forEach(subcategory => {
            const key = this._buildIndexKey(category, subcategory);
            this.defaultActionCounts.set(key, 0);
            this.defaultIndexMap.set(key, []);
          });
        }
        return;
      }

      const isExistingArray = Array.isArray(existing);
      const isCustomArray = Array.isArray(customCategory);

      if (isExistingArray && isCustomArray) {
        this.data[category] = [...existing, ...this._deepClone(customCategory)];
      } else if (!isExistingArray && !isCustomArray) {
        Object.keys(customCategory).forEach(subcategory => {
          const existingSub = existing[subcategory];
          const customSub = customCategory[subcategory];
          const key = this._buildIndexKey(category, subcategory);

          if (!existingSub) {
            existing[subcategory] = this._deepClone(customSub);
            this.defaultActionCounts.set(key, 0);
            this.defaultIndexMap.set(key, []);
          } else if (Array.isArray(existingSub) && Array.isArray(customSub)) {
            existing[subcategory] = [...existingSub, ...this._deepClone(customSub)];
          }
        });
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
    const originalIndex = this.getOriginalDefaultIndex(mainCategory, subcategory, actionIndex);
    if (originalIndex === null) {
      throw new Error('Invalid action index');
    }

    const overrides = this._getOverrideContainer(mainCategory, subcategory, { create: true });
    overrides[originalIndex] = this._deepClone(updatedAction);

    this.markActionAsModified(mainCategory, subcategory, originalIndex, { originalIndex: true });
    await this.saveToFlags();
    this.mergeData();
  }

  async deleteDefaultAction(mainCategory, subcategory, actionIndex) {
    const originalIndex = this.getOriginalDefaultIndex(mainCategory, subcategory, actionIndex);
    if (originalIndex === null) {
      throw new Error('Invalid action index');
    }

    const actionKey = this._buildActionKey(mainCategory, subcategory, originalIndex);
    this.deletedDefaultActions.add(actionKey);

    const overrides = this._getOverrideContainer(mainCategory, subcategory);
    if (overrides && overrides[originalIndex]) {
      delete overrides[originalIndex];
      this._cleanupOverrideContainer(mainCategory, subcategory);
    }

    this.unmarkActionAsModified(mainCategory, subcategory, originalIndex, { originalIndex: true });
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

  async deleteAction(mainCategory, subcategory, actionIndex, source) {
    if (source === 'default') {
      await this.deleteDefaultAction(mainCategory, subcategory, actionIndex);
    } else {
      await this.deleteCustomAction(mainCategory, subcategory, actionIndex);
    }
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
      this.defaultOverrides = {};
      this.deletedDefaultActions = new Set();
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
        ...this._deepClone(action),
        isModified: this.isActionModified(mainCategory, subcategory, index)
      };
    }

    return null;
  }

  getActionSource(mainCategory, subcategory, index) {
    const key = this._buildIndexKey(mainCategory, subcategory);
    const defaultCount = this.defaultActionCounts.get(key) ?? 0;
    return index < defaultCount ? 'default' : 'custom';
  }

  getDefaultActions(mainCategory, subcategory) {
    const actions = subcategory
      ? this.getActionsForSubcategory(mainCategory, subcategory)
      : this.getActionsForMainCategory(mainCategory);
    const key = this._buildIndexKey(mainCategory, subcategory);
    const defaultCount = this.defaultActionCounts.get(key) ?? 0;
    return actions.slice(0, defaultCount);
  }

  getCustomActions(mainCategory, subcategory) {
    const actions = subcategory
      ? this.getActionsForSubcategory(mainCategory, subcategory)
      : this.getActionsForMainCategory(mainCategory);
    const key = this._buildIndexKey(mainCategory, subcategory);
    const defaultCount = this.defaultActionCounts.get(key) ?? 0;
    return actions.slice(defaultCount);
  }

  getOriginalDefaultIndex(mainCategory, subcategory, actionIndex) {
    const key = this._buildIndexKey(mainCategory, subcategory);
    const mapping = this.defaultIndexMap.get(key);
    if (!mapping) {
      return null;
    }

    const displayIndex = Number(actionIndex);
    if (Number.isNaN(displayIndex)) {
      return null;
    }

    return mapping[displayIndex] ?? null;
  }

  async exportAllData() {
    return {
      version: DATA_VERSION,
      defaultData: this.defaultData,
      customData: this.customData,
      defaultOverrides: this.defaultOverrides,
      deletedDefaultActions: Array.from(this.deletedDefaultActions),
      modifiedActions: Array.from(this.modifiedActions)
    };
  }

  async importAllData(importedData) {
    if (importedData.version !== DATA_VERSION) {
      ui.notifications.warn('Imported data version mismatch. Proceeding with caution.');
    }

    this.defaultData = importedData.defaultData || this.defaultData;
    this.customData = importedData.customData || {};
    this.defaultOverrides = importedData.defaultOverrides || {};
    this.deletedDefaultActions = new Set(importedData.deletedDefaultActions || []);
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
