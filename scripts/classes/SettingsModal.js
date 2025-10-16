import { DataManager } from './DataManager.js';
import { ActionFormApplication } from './ActionFormApplication.js';

export class SettingsModal extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  constructor(dataManager, onSave, options = {}) {
    super(options);
    this.dataManager = dataManager;
    this.onSave = onSave;
    this._state = {
      currentCategory: '',
      currentSubcategory: '',
      newCategoryInput: '',
      newSubcategoryInput: '',
      actionsListHTML: '',
      actionsListMessage: 'Select a category to view actions'
    };
  }

  _setState(newState) {
    Object.assign(this._state, newState);
    // this.render(); // Removido para evitar loop infinito
  }

  static DEFAULT_OPTIONS = {
    id: "gurps-rules-companion-settings-modal",
    classes: ["gurps-rules-companion", "grc-settings-modal"],
    tag: "div",
    window: {
      title: "Manage Custom Actions",
      icon: "fas fa-cog",
      minimizable: false,
      resizable: true
    },
    position: {
      width: 800,
      height: 600,
    }
  };

  static PARTS = {
    main: {
      template: "modules/gurps-rules-companion/templates/settings-modal.hbs"
    }
  };

  /**
   * Static method to show the application
   * @param {DataManager} dataManager
   * @param {Function} onSave
   */
  static show(dataManager, onSave) {
    if (!game.user.isGM) {
      ui.notifications.warn('Only the GM can edit actions');
      return;
    }
    const app = new SettingsModal(dataManager, onSave);
    app.render(true);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const mainCategories = this.dataManager.getMainCategories();
    const allCategories = [...mainCategories];

    Object.keys(this.dataManager.customData).forEach(cat => {
      if (!allCategories.includes(cat)) {
        allCategories.push(cat);
      }
    });

    context.allCategories = allCategories.map(cat => ({
      id: cat,
      name: this.dataManager.formatCategoryName(cat),
      isSelected: cat === this._state.currentCategory
    }));

    context.isNewCategory = this._state.currentCategory === '__new__';
    context.newCategoryInput = this._state.newCategoryInput;

    context.isSubcategoryVisible = this._state.currentCategory && this._state.currentCategory !== '__new__';
    context.subcategories = [];
    context.newSubcategoryInput = this._state.newSubcategoryInput;

    if (context.isSubcategoryVisible) {
      context.subcategories = this.getSubcategoryOptions(this._state.currentCategory).map(sub => ({
        id: sub,
        name: this.dataManager.formatCategoryName(sub),
        isSelected: sub === this._state.currentSubcategory
      }));
    }

    context.actionsListHTML = this._state.actionsListHTML;
    context.actionsListMessage = this._state.actionsListMessage;

    return context;
  }

  getSubcategoryOptions(category) {
    const subcategories = [];
    const hasSubcategories = this.dataManager.hasSubcategories(category);

    if (hasSubcategories) {
      subcategories.push(...this.dataManager.getSubcategories(category));
    }

    if (this.dataManager.customData[category] && typeof this.dataManager.customData[category] === 'object' && !Array.isArray(this.dataManager.customData[category])) {
      Object.keys(this.dataManager.customData[category]).forEach(sub => {
        if (!subcategories.includes(sub)) {
          subcategories.push(sub);
        }
      });
    }
    return subcategories;
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const element = this.element;
    if (!element) return;

    const categorySelect = element.querySelector('#grc-category-select');
    const subcategorySelect = element.querySelector('#grc-subcategory-select');
    const newCategoryInput = element.querySelector('#grc-new-category-input');
    const newSubcategoryInput = element.querySelector('#grc-new-subcategory-input');
    
    categorySelect.addEventListener('change', (e) => this.handleCategoryChange(e.target.value));
    subcategorySelect.addEventListener('change', (e) => this.handleSubcategoryChange(e.target.value));
    newCategoryInput.addEventListener('input', (e) => this._setState({ newCategoryInput: e.target.value }));
    newSubcategoryInput.addEventListener('input', (e) => this._setState({ newSubcategoryInput: e.target.value }));

    this.attachActionListeners(element);

    // Initial load of actions list if a category is already selected
    if (this._state.currentCategory && this._state.currentCategory !== '__new__') {
      this.updateActionsList();
    }
  }

  handleCategoryChange(value) {
    this._setState({
      currentCategory: value,
      currentSubcategory: '',
      actionsListHTML: '',
      actionsListMessage: 'Select a category to view actions'
    });

    if (value === '__new__') {
      this._setState({ actionsListMessage: 'Create a new category first' });
    } else if (value) {
      this.updateActionsList();
      this.render();
    }
  }
  handleSubcategoryChange(value) {    this._setState({ currentSubcategory: value });    this.updateActionsList();    this.render();  }  attachActionListeners(element) {
    const actionsList = element.querySelector('#grc-actions-list');
    const addActionButton = element.querySelector('#grc-add-action-btn');

    actionsList.addEventListener('click', (e) => {
      const target = e.target.closest('.grc-action-edit, .grc-action-delete');
      if (!target) return;

      const index = target.dataset.index;
      const source = target.dataset.source;

      if (target.classList.contains('grc-action-edit')) {
        this.editAction(index, source);
      } else if (target.classList.contains('grc-action-delete')) {
        this.deleteAction(index, source);
      }
    });

    addActionButton.addEventListener('click', () => this.handleAdd());
  }

  updateActionsList() {
    const category = this._state.currentCategory;
    const subcategory = this._state.currentSubcategory;

    let defaultActions = [];
    let customActions = [];

    if (subcategory) {
      defaultActions = this.dataManager.defaultData?.[category]?.[subcategory] || [];
      customActions = this.dataManager.customData?.[category]?.[subcategory] || [];
    } else {
      const defaultData = this.dataManager.defaultData?.[category];
      if (Array.isArray(defaultData)) {
        defaultActions = defaultData;
      }
      const customData = this.dataManager.customData?.[category];
      if (Array.isArray(customData)) {
        customActions = customData;
      }
    }

    if (defaultActions.length === 0 && customActions.length === 0) {
      this._setState({
        actionsListHTML: '',
        actionsListMessage: 'No actions yet. Click "Add Action" to create one.'
      });
      return;
    }

    let html_content = '<div class="grc-actions-items">';

    if (defaultActions.length > 0) {
      // html_content += '<h5 class="grc-section-title">Default Actions</h5>';
      defaultActions.forEach((action, index) => {
        const isModified = this.dataManager.isActionModified(category, subcategory, index);
        html_content += `
          <div class="grc-action-item ${isModified ? 'grc-action-modified' : ''}">
            <div class="grc-action-item-name">
              ${isModified ? '<i class="fas fa-star" title="Modified"></i> ' : ''}${action.name}
            </div>
            <div class="grc-action-item-buttons">
              <button class="grc-action-edit" data-index="${index}" data-source="default" type="button" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
              <button class="grc-action-delete" data-index="${index}" data-source="default" type="button" title="Delete">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      });
    }

    if (customActions.length > 0) {
      html_content += '<h5 class="grc-section-title">Custom Actions</h5>';
      customActions.forEach((action, index) => {
        html_content += `
          <div class="grc-action-item grc-action-custom">
            <div class="grc-action-item-name">
              <i class="fas fa-plus-circle" title="Custom"></i> ${action.name}
            </div>
            <div class="grc-action-item-buttons">
              <button class="grc-action-edit" data-index="${index}" data-source="custom" type="button" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
              <button class="grc-action-delete" data-index="${index}" data-source="custom" type="button" title="Delete">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      });
    }

    html_content += '</div>';

    this._setState({
      actionsListHTML: html_content,
      actionsListMessage: ''
    });
  }

  handleAdd() {
    const category = this._state.currentCategory;
    const newCategoryInput = this._state.newCategoryInput.trim();
    const subcategory = this._state.currentSubcategory;
    const newSubcategoryInput = this._state.newSubcategoryInput.trim();

    let finalCategory = category;
    let finalSubcategory = subcategory;

    if (category === '__new__') {
      if (!newCategoryInput) {
        ui.notifications.warn('Please enter a new category name');
        return;
      }
      finalCategory = newCategoryInput;
    } else if (!category) {
      ui.notifications.warn('Please select a category');
      return;
    }

    if (newSubcategoryInput) {
      finalSubcategory = newSubcategoryInput;
    }

    ActionFormApplication.show(
      this.dataManager,
      (customData) => {
        this.dataManager.setCustomData(customData);
        this.updateActionsList();
        this.render();
      },
      finalCategory,
      finalSubcategory
    );
  }



  editAction(index, source) {
    const category = this._state.currentCategory;
    const subcategory = this._state.currentSubcategory;
    const action = this.dataManager.getAction(category, subcategory, index, source);

    ActionFormApplication.show(
      this.dataManager,
      (customData) => {
        this.dataManager.setCustomData(customData);
        this.updateActionsList();
        this.render();
      },
      category,
      subcategory,
      action,
      index,
      source
    );
  }

  deleteAction(index, source) {
    const category = this._state.currentCategory;
    const subcategory = this._state.currentSubcategory;

    Dialog.confirm({
      title: 'Delete Action',
      content: '<p>Are you sure you want to delete this action?</p>',
      yes: () => {
        this.dataManager.deleteAction(category, subcategory, index, source);
        this.onSave(this.dataManager.customData);
        this.updateActionsList();
      },
      no: () => {},
      defaultYes: false
    });
  }


}