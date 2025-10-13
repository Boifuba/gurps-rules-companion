import { DataManager } from './DataManager.js';
import { AccordionManager } from './AccordionManager.js';
import { ActionButton } from './ActionButton.js';
import { ContentRenderer } from './ContentRenderer.js';
import { ChatHandler } from './ChatHandler.js';

export class ActionsManagerApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  constructor(options = {}) {
    super(options);

    this.dataManager = new DataManager();
    this.accordionManager = new AccordionManager();
    this.contentRenderer = new ContentRenderer();
    this.chatHandler = new ChatHandler();
    this.actionButtons = new Map();
    this.currentSelectedButton = null;
    this.currentMainCategory = null;
    this.currentSubcategory = null;

    this.chatHandler.setRenderer(this.contentRenderer);
  }

  static DEFAULT_OPTIONS = {
    id: "actions-manager-app",
    classes: ["actions-manager"],
    tag: "div",
    window: {
      title: "ACTIONS_MANAGER.Title",
      icon: "fas fa-list-check",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 900,
    }
  };

  static PARTS = {
    main: {
      template: "modules/gurps-rules-companion/templates/actions-manager-app.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    if (!this.dataManager.data) {
      await this.dataManager.loadData();
      this.setupAccordionListener();
    }

    const mainCategories = this.dataManager.getMainCategories();
    this.actionButtons.clear();

    context.column1Categories = mainCategories.map(category => ({
      id: category,
      name: this.dataManager.formatCategoryName(category),
      isSelected: this.accordionManager.isSelectedColumn1(category)
    }));

    const selectedMainCategory = this.accordionManager.getSelectedColumn1();
    this.currentMainCategory = selectedMainCategory;

    if (selectedMainCategory) {
      const hasSubcategories = this.dataManager.hasSubcategories(selectedMainCategory);

      if (hasSubcategories) {
        const subcategories = this.dataManager.getSubcategories(selectedMainCategory);
        context.column2Title = this.dataManager.formatCategoryName(selectedMainCategory);
        context.column2Items = subcategories.map(subcategory => {
          const actions = this.dataManager.getActionsForSubcategory(selectedMainCategory, subcategory);
          const isExpanded = this.accordionManager.isExpandedColumn2(subcategory);

          const buttons = actions.map((action, index) => {
            const button = new ActionButton(action, selectedMainCategory, index, subcategory);
            this.actionButtons.set(button.getId(), button);
            return {
              id: button.getId(),
              name: button.getName(),
              isSelected: button.getSelected()
            };
          });

          return {
            id: subcategory,
            name: this.dataManager.formatCategoryName(subcategory),
            isExpanded: isExpanded,
            actions: buttons
          };
        });
      } else {
        const actions = this.dataManager.getActionsForMainCategory(selectedMainCategory);
        context.column2Title = this.dataManager.formatCategoryName(selectedMainCategory);
        context.column2DirectActions = actions.map((action, index) => {
          const button = new ActionButton(action, selectedMainCategory, index);
          this.actionButtons.set(button.getId(), button);
          return {
            id: button.getId(),
            name: button.getName(),
            isSelected: button.getSelected()
          };
        });
      }
    } else {
      context.column2Title = 'Select a category';
    }

    const currentAction = this.contentRenderer.getAction();
    context.column3Title = currentAction ? currentAction.name : 'Details';
    context.contentHTML = this.contentRenderer.renderHTML();

    return context;
  }

  setupAccordionListener() {
    this.accordionManager.addListener(() => {
      this.render();
    });
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const element = this.element;
    if (!element) return;

    element.querySelectorAll('[data-column1-button]').forEach(button => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const category = button.dataset.column1Button;
        this.accordionManager.selectColumn1Button(category);
      });
    });

    element.querySelectorAll('[data-column2-header]').forEach(header => {
      header.addEventListener('click', (event) => {
        event.preventDefault();
        const subcategory = header.dataset.column2Header;
        this.accordionManager.toggleColumn2(subcategory);
      });
    });

    element.querySelectorAll('[data-action-id]').forEach(button => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const actionId = button.dataset.actionId;
        this.handleActionButtonClick(actionId);
      });
    });

    element.querySelectorAll('[data-direct-action-id]').forEach(button => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const actionId = button.dataset.directActionId;
        this.handleActionButtonClick(actionId);
      });
    });

    const chatButton = element.querySelector('#am-send-chat-btn');
    if (chatButton) {
      chatButton.addEventListener('click', (event) => {
        event.preventDefault();
        this.handleSendToChat();
      });
    }
  }

  handleActionButtonClick(actionId) {
    const button = this.actionButtons.get(actionId);
    if (!button) return;

    if (this.currentSelectedButton) {
      this.currentSelectedButton.setSelected(false);
    }

    button.setSelected(true);
    this.currentSelectedButton = button;
    this.contentRenderer.setAction(button.getAction());

    this.render();
  }

  handleSendToChat() {
    if (!this.currentSelectedButton) {
      ui.notifications.warn('Please select an action first');
      return;
    }

    const action = this.currentSelectedButton.getAction();
    const category = this.currentSelectedButton.getCategory();
    this.chatHandler.sendToChat(action, category);
  }

  static async show() {
    const app = new ActionsManagerApp();
    app.render(true);
  }
}
