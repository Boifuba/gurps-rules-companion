import { DataManager } from './DataManager.js';

export class ActionFormApplication extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  constructor(dataManager, onSave, category, subcategory, existingAction = null, actionIndex = null, source = 'custom', options = {}) {
    super(options);
    this.dataManager = dataManager;
    this.onSave = onSave;
    this.category = category;
    this.subcategory = subcategory;
    this.existingAction = existingAction;
    this.actionIndex = actionIndex;
    this.source = source;
    this.isEdit = existingAction !== null;
  }

  static DEFAULT_OPTIONS = {
    id: "gurps-rules-companion-action-form",
    classes: ["gurps-rules-companion", "grc-action-form-modal"],
    tag: "div",
    window: {
      title: "Action Form",
      icon: "fas fa-edit",
      minimizable: false,
      resizable: true
    },
    position: {
      width: 500,
      height: 600,
    }
  };

  static PARTS = {
    main: {
      template: "modules/gurps-rules-companion/templates/action-form-application.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const action = this.existingAction || {};

    context.isEdit = this.isEdit;
    context.title = this.isEdit ? 'Edit Action' : 'Add New Action';
    context.action = {
      name: action.name || '',
      ref: action.ref || '',
      notes: action.notes || '',
      description: action.description || '',
      tags: action.tags ? action.tags.join(', ') : ''
    };

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const element = this.element;

    element.querySelector('#grc-action-form').addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleSave(event.currentTarget);
    });

    element.querySelector('#grc-action-cancel-btn').addEventListener('click', () => {
      this.close();
    });
  }

  async handleSave(form) {
    const formData = new FormData(form);
    const newAction = {
      name: formData.get('name'),
      ref: formData.get('ref'),
      notes: formData.get('notes'),
      description: formData.get('description'),
      tags: formData.get('tags').split(',').map(tag => tag.trim()).filter(tag => tag !== '')
    };

    try {
      if (this.isEdit) {
        if (this.source === 'default') {
          await this.dataManager.updateDefaultAction(this.category, this.subcategory, this.actionIndex, newAction);
        } else {
          await this.dataManager.updateCustomAction(this.category, this.subcategory, this.actionIndex, newAction);
        }
      } else {
        await this.dataManager.addCustomAction(this.category, this.subcategory, newAction);
      }

      this.onSave(this.dataManager.customData);
      this.close();
    } catch (error) {
      console.error('ActionFormApplication: Error saving action', error);
      ui.notifications.error('Failed to save action');
    }
  }

  static show(dataManager, onSave, category, subcategory, existingAction = null, actionIndex = null, source = 'custom') {
    const app = new ActionFormApplication(dataManager, onSave, category, subcategory, existingAction, actionIndex, source);
    app.render(true);
  }
}

