export class SettingsModal {
  constructor(dataManager, onSave) {
    this.dataManager = dataManager;
    this.onSave = onSave;
    this.currentCategory = '';
    this.currentSubcategory = '';
  }

  checkGMPermission() {
    if (!game.user.isGM) {
      ui.notifications.warn('Only the GM can edit actions');
      return false;
    }
    return true;
  }

  show() {
    if (!this.checkGMPermission()) {
      return;
    }
    this.render();
  }

  render() {
    const dialog = new Dialog({
      title: 'Manage Custom Actions',
      content: this.getContent(),
      buttons: {
        add: {
          icon: '<i class="fas fa-plus"></i>',
          label: 'Add Action',
          callback: (html) => this.handleAdd(html)
        },
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: 'Save',
          callback: (html) => this.handleSave(html)
        }
      },
      default: 'save',
      render: (html) => this.attachListeners(html)
    }, {
      width: 800,
      height: 600,
      classes: ['grc-settings-modal']
    });

    dialog.render(true);
  }

  getContent() {
    const mainCategories = this.dataManager.getMainCategories();
    const allCategories = [...mainCategories];

    Object.keys(this.dataManager.customData).forEach(cat => {
      if (!allCategories.includes(cat)) {
        allCategories.push(cat);
      }
    });

    let html = `
      <div class="grc-settings-container">
        <div class="grc-settings-section">
          <h3>Manage Actions</h3>
          <p>Edit default actions or add custom ones. Modified default actions are marked with a star. Changes are saved globally for all players.</p>
        </div>

        <div class="grc-settings-section">
          <div class="grc-settings-row">
            <label>Category:</label>
            <select id="grc-category-select" class="grc-select">
              <option value="">-- Select Category --</option>
              ${allCategories.map(cat => `
                <option value="${cat}">${this.dataManager.formatCategoryName(cat)}</option>
              `).join('')}
              <option value="__new__">+ Create New Category</option>
            </select>
          </div>

          <div id="grc-new-category-row" class="grc-settings-row" style="display: none;">
            <label>New Category Name:</label>
            <input type="text" id="grc-new-category-input" class="grc-input" placeholder="e.g., myCustomCategory" />
          </div>

          <div id="grc-subcategory-row" class="grc-settings-row" style="display: none;">
            <label>Subcategory (optional):</label>
            <select id="grc-subcategory-select" class="grc-select">
              <option value="">-- Direct Actions --</option>
            </select>
            <input type="text" id="grc-new-subcategory-input" class="grc-input" placeholder="Or type new subcategory" style="margin-top: 8px;" />
          </div>
        </div>

        <div class="grc-settings-section">
          <h4>Actions in Selected Category</h4>
          <div id="grc-actions-list" class="grc-actions-list">
            <p class="grc-empty-message">Select a category to view actions</p>
          </div>
        </div>

        <div class="grc-settings-section">
          <button id="grc-reset-custom" type="button" class="grc-btn-reset">
            <i class="fas fa-eraser"></i> Reset Custom Actions
          </button>
          <button id="grc-reset-all" type="button" class="grc-btn-reset-all">
            <i class="fas fa-undo"></i> Reset All to Defaults
          </button>
        </div>
      </div>
    `;

    return html;
  }

  attachListeners(html) {
    const categorySelect = html.find('#grc-category-select');
    const newCategoryRow = html.find('#grc-new-category-row');
    const subcategoryRow = html.find('#grc-subcategory-row');
    const subcategorySelect = html.find('#grc-subcategory-select');
    const actionsList = html.find('#grc-actions-list');

    categorySelect.on('change', (e) => {
      const value = e.target.value;

      if (value === '__new__') {
        newCategoryRow.show();
        subcategoryRow.hide();
        actionsList.html('<p class="grc-empty-message">Create a new category first</p>');
      } else if (value) {
        newCategoryRow.hide();
        subcategoryRow.show();
        this.updateSubcategoryOptions(html, value);
        this.updateActionsList(html, value);
      } else {
        newCategoryRow.hide();
        subcategoryRow.hide();
        actionsList.html('<p class="grc-empty-message">Select a category to view actions</p>');
      }
    });

    subcategorySelect.on('change', (e) => {
      const category = categorySelect.val();
      const subcategory = e.target.value;
      if (category) {
        this.updateActionsList(html, category, subcategory);
      }
    });

    this.attachActionListeners(html);
  }

  attachActionListeners(html) {
    html.find('.grc-action-edit').on('click', (e) => {
      const index = $(e.currentTarget).data('index');
      const source = $(e.currentTarget).data('source');
      this.editAction(html, index, source);
    });

    html.find('.grc-action-delete').on('click', (e) => {
      const index = $(e.currentTarget).data('index');
      const source = $(e.currentTarget).data('source');
      this.deleteAction(html, index, source);
    });

    html.find('#grc-reset-custom').on('click', (e) => {
      this.handleResetCustom();
    });

    html.find('#grc-reset-all').on('click', (e) => {
      this.handleResetAll();
    });
  }

  updateSubcategoryOptions(html, category) {
    const subcategorySelect = html.find('#grc-subcategory-select');
    const hasSubcategories = this.dataManager.hasSubcategories(category);

    subcategorySelect.empty();
    subcategorySelect.append('<option value="">-- Direct Actions --</option>');

    if (hasSubcategories) {
      const subcategories = this.dataManager.getSubcategories(category);
      subcategories.forEach(sub => {
        subcategorySelect.append(`<option value="${sub}">${this.dataManager.formatCategoryName(sub)}</option>`);
      });
    }

    if (this.customData[category] && typeof this.customData[category] === 'object' && !Array.isArray(this.customData[category])) {
      Object.keys(this.customData[category]).forEach(sub => {
        if (!subcategorySelect.find(`option[value="${sub}"]`).length) {
          subcategorySelect.append(`<option value="${sub}">${this.dataManager.formatCategoryName(sub)}</option>`);
        }
      });
    }
  }

  updateActionsList(html, category, subcategory = '') {
    const actionsList = html.find('#grc-actions-list');
    this.currentCategory = category;
    this.currentSubcategory = subcategory;

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
      actionsList.html('<p class="grc-empty-message">No actions yet. Click "Add Action" to create one.</p>');
      return;
    }

    let html_content = '<div class="grc-actions-items">';

    if (defaultActions.length > 0) {
      html_content += '<h5 class="grc-section-title">Default Actions</h5>';
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

    actionsList.html(html_content);
    this.attachActionListeners(html);
  }

  handleAdd(html) {
    const category = html.find('#grc-category-select').val();
    const newCategoryInput = html.find('#grc-new-category-input').val().trim();
    const subcategory = html.find('#grc-subcategory-select').val();
    const newSubcategoryInput = html.find('#grc-new-subcategory-input').val().trim();

    let finalCategory = category;
    let finalSubcategory = subcategory;

    if (category === '__new__') {
      if (!newCategoryInput) {
        ui.notifications.warn('Please enter a new category name');
        return false;
      }
      finalCategory = newCategoryInput;
    } else if (!category) {
      ui.notifications.warn('Please select a category');
      return false;
    }

    if (newSubcategoryInput) {
      finalSubcategory = newSubcategoryInput;
    }

    this.showActionForm(finalCategory, finalSubcategory);
    return false;
  }

  showActionForm(category, subcategory = '', existingAction = null, actionIndex = null, source = 'custom') {
    const isEdit = existingAction !== null;

    const formDialog = new Dialog({
      title: isEdit ? 'Edit Action' : 'Add New Action',
      content: `
        <form class="grc-action-form">
          <div class="form-group">
            <label>Action Name:</label>
            <input type="text" name="name" value="${isEdit ? existingAction.name : ''}" placeholder="e.g., Quick Draw" required />
          </div>
          <div class="form-group">
            <label>Reference:</label>
            <input type="text" name="ref" value="${isEdit ? (existingAction.ref || '') : ''}" placeholder="e.g., B123 or MA45" />
          </div>
          <div class="form-group">
            <label>Notes:</label>
            <textarea name="notes" rows="4">${isEdit ? (existingAction.notes || '') : ''}</textarea>
          </div>
          <div class="form-group">
            <label>Attack:</label>
            <input type="checkbox" name="attack" ${isEdit && existingAction.attack ? 'checked' : ''} />
          </div>
          <div class="form-group">
            <label>Movement:</label>
            <input type="checkbox" name="movement" ${isEdit && existingAction.movement ? 'checked' : ''} />
          </div>
          <div class="form-group">
            <label>Dodge:</label>
            <input type="checkbox" name="defense_dodge" ${isEdit && existingAction.defenses?.dodge ? 'checked' : ''} />
          </div>
          <div class="form-group">
            <label>Block:</label>
            <input type="checkbox" name="defense_block" ${isEdit && existingAction.defenses?.block ? 'checked' : ''} />
          </div>
          <div class="form-group">
            <label>Parry:</label>
            <input type="checkbox" name="defense_parry" ${isEdit && existingAction.defenses?.parry ? 'checked' : ''} />
          </div>
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-check"></i>',
          label: 'Save',
          callback: (html) => {
            const formData = new FormData(html.find('form')[0]);
            const action = {
              name: formData.get('name'),
              ref: formData.get('ref') || undefined,
              notes: formData.get('notes') || undefined,
              attack: formData.get('attack') === 'on',
              movement: formData.get('movement') === 'on',
              defenses: {
                dodge: formData.get('defense_dodge') === 'on',
                block: formData.get('defense_block') === 'on',
                parry: formData.get('defense_parry') === 'on'
              }
            };

            if (!action.name) {
              ui.notifications.warn('Action name is required');
              return false;
            }

            this.saveAction(category, subcategory, action, actionIndex, source);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: 'Cancel'
        }
      },
      default: 'save'
    }, {
      width: 500
    });

    formDialog.render(true);
  }

  async saveAction(category, subcategory, action, actionIndex = null, source = 'custom') {
    try {
      if (source === 'default') {
        if (actionIndex !== null) {
          await this.dataManager.updateDefaultAction(category, subcategory, actionIndex, action);
        } else {
          await this.dataManager.addCustomAction(category, subcategory, action);
        }
      } else {
        if (actionIndex !== null) {
          await this.dataManager.updateCustomAction(category, subcategory, actionIndex, action);
        } else {
          await this.dataManager.addCustomAction(category, subcategory, action);
        }
      }

      ui.notifications.info(`Action ${actionIndex !== null ? 'updated' : 'added'} successfully`);
      if (this.onSave) {
        this.onSave(this.dataManager.customData);
      }
      this.show();
    } catch (error) {
      console.error('Error saving action:', error);
      ui.notifications.error('Failed to save action');
    }
  }

  editAction(html, index, source) {
    const category = html.find('#grc-category-select').val();
    const subcategory = html.find('#grc-subcategory-select').val();

    let action;
    if (source === 'default') {
      if (subcategory) {
        action = this.dataManager.defaultData[category][subcategory][index];
      } else {
        action = this.dataManager.defaultData[category][index];
      }
    } else {
      if (subcategory) {
        action = this.dataManager.customData[category][subcategory][index];
      } else {
        action = this.dataManager.customData[category][index];
      }
    }

    this.showActionForm(category, subcategory, action, index, source);
  }

  deleteAction(html, index, source) {
    const category = html.find('#grc-category-select').val();
    const subcategory = html.find('#grc-subcategory-select').val();

    Dialog.confirm({
      title: 'Delete Action',
      content: '<p>Are you sure you want to delete this action?</p>',
      yes: async () => {
        try {
          if (source === 'default') {
            await this.dataManager.deleteDefaultAction(category, subcategory, index);
          } else {
            await this.dataManager.deleteCustomAction(category, subcategory, index);
          }
          ui.notifications.info('Action deleted');
          if (this.onSave) {
            this.onSave(this.dataManager.customData);
          }
          this.show();
        } catch (error) {
          console.error('Error deleting action:', error);
          ui.notifications.error('Failed to delete action');
        }
      }
    });
  }

  async handleSave(html) {
    ui.notifications.info('Changes are saved automatically');
  }

  async handleResetCustom() {
    Dialog.confirm({
      title: 'Reset Custom Actions',
      content: '<p>This will delete all custom actions but keep modified default actions. Continue?</p>',
      yes: async () => {
        await this.dataManager.resetCustomData();
        if (this.onSave) {
          this.onSave(this.dataManager.customData);
        }
        this.show();
      }
    });
  }

  async handleResetAll() {
    Dialog.confirm({
      title: 'Reset All to Defaults',
      content: '<p><strong>Warning:</strong> This will delete ALL custom actions and reset ALL modified actions to their original state. This cannot be undone. Continue?</p>',
      yes: async () => {
        await this.dataManager.resetToDefaults();
        if (this.onSave) {
          this.onSave(this.dataManager.customData);
        }
        this.show();
      }
    });
  }

  async handleExport() {
    const exportData = await this.dataManager.exportAllData();
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gurps-actions-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    ui.notifications.info('Actions exported');
  }

  handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        Dialog.confirm({
          title: 'Import Actions',
          content: '<p><strong>Warning:</strong> This will replace ALL current data with the imported data. Continue?</p>',
          yes: async () => {
            await this.dataManager.importAllData(data);
            if (this.onSave) {
              this.onSave(this.dataManager.customData);
            }
            this.show();
          }
        });
      } catch (error) {
        console.error('Error importing file:', error);
        ui.notifications.error('Failed to import file. Please check the JSON format.');
      }
    };

    input.click();
  }

}
