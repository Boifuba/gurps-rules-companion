let ActionsManagerApp;
let MODULE_ID, FLAG_KEYS;

class ImportCustomActionsDialog extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: 'Import Actions Data',
      id: 'import-custom-actions',
      template: 'templates/empty.html',
      width: 400
    });
  }

  async _updateObject(event, formData) {}

  render() {
    if (!game.user.isGM) {
      ui.notifications.warn('Only the GM can import actions data');
      return this;
    }

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
          title: 'Import Actions Data',
          content: '<p><strong>Warning:</strong> This will replace ALL current data with the imported data. Continue?</p>',
          yes: async () => {
            try {
              await game.settings.set(MODULE_ID, FLAG_KEYS.DEFAULT_DATA, data.defaultData || {});
              await game.settings.set(MODULE_ID, FLAG_KEYS.CUSTOM_DATA, data.customData || {});
              await game.settings.set(MODULE_ID, FLAG_KEYS.MODIFIED_ACTIONS, data.modifiedActions || []);
              await game.settings.set(MODULE_ID, FLAG_KEYS.DATA_VERSION, data.version || '');
              ui.notifications.info('Actions data imported successfully. Please reload.');
              setTimeout(() => window.location.reload(), 1000);
            } catch (error) {
              console.error('Error saving imported data:', error);
              ui.notifications.error('Failed to save imported data');
            }
          }
        });
      } catch (error) {
        console.error('Error importing file:', error);
        ui.notifications.error('Failed to import file. Please check the JSON format.');
      }
    };

    input.click();
    return this;
  }
}

class ExportCustomActionsDialog extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: 'Export Actions Data',
      id: 'export-custom-actions',
      template: 'templates/empty.html',
      width: 400
    });
  }

  async _updateObject(event, formData) {}

  render() {
    if (!game.user.isGM) {
      ui.notifications.warn('Only the GM can export actions data');
      return this;
    }

    try {
      const defaultData = game.settings.get(MODULE_ID, FLAG_KEYS.DEFAULT_DATA);
      const customData = game.settings.get(MODULE_ID, FLAG_KEYS.CUSTOM_DATA);
      const modifiedActions = game.settings.get(MODULE_ID, FLAG_KEYS.MODIFIED_ACTIONS);
      const version = game.settings.get(MODULE_ID, FLAG_KEYS.DATA_VERSION);

      const exportData = {
        version: version,
        defaultData: defaultData,
        customData: customData,
        modifiedActions: modifiedActions
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gurps-actions-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      ui.notifications.info('Actions data exported successfully');
    } catch (error) {
      console.error('Error exporting actions data:', error);
      ui.notifications.error('Failed to export actions data');
    }

    return this;
  }
}

/**
 * Register all module settings in the game settings menu
 */
function registerModuleSettings() {
  game.settings.register(MODULE_ID, FLAG_KEYS.DEFAULT_DATA, {
    name: 'Default Actions Data',
    scope: 'world',
    config: false,
    type: Object,
    default: null
  });

  game.settings.register(MODULE_ID, FLAG_KEYS.CUSTOM_DATA, {
    name: 'Custom Actions Data',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, FLAG_KEYS.MODIFIED_ACTIONS, {
    name: 'Modified Actions',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  game.settings.register(MODULE_ID, FLAG_KEYS.DATA_VERSION, {
    name: 'Data Version',
    scope: 'world',
    config: false,
    type: String,
    default: ''
  });

  game.settings.register(MODULE_ID, 'showSceneButton', {
    name: game.i18n.localize('GURPS_RULES_COMPANION.settings.showSceneButton.name'),
    hint: game.i18n.localize('GURPS_RULES_COMPANION.settings.showSceneButton.hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    restricted: true,
    requiresReload: true
  });

  game.settings.registerMenu(MODULE_ID, 'importCustomActions', {
    name: 'Import Actions Data',
    label: 'Import JSON',
    hint: 'Import all actions data from a JSON file (GM only)',
    icon: 'fas fa-file-import',
    type: ImportCustomActionsDialog,
    restricted: true
  });

  game.settings.registerMenu(MODULE_ID, 'exportCustomActions', {
    name: 'Export Actions Data',
    label: 'Export JSON',
    hint: 'Export all actions data to a JSON file (GM only)',
    icon: 'fas fa-file-export',
    type: ExportCustomActionsDialog,
    restricted: true
  });
}

/**
 * Enable the module
 */
function enableModule() {
  game.settings.set(MODULE_ID, 'moduleEnabled', true);
  ui.notifications.info(game.i18n.localize('GURPS_RULES_COMPANION.notifications.moduleEnabled'));
}

/**
 * Disable the module
 */
function disableModule() {
  game.settings.set(MODULE_ID, 'moduleEnabled', false);
  ui.notifications.info(game.i18n.localize('GURPS_RULES_COMPANION.notifications.moduleDisabled'));
}

/**
 * Main module initialization
 */
Hooks.once('init', async () => {
  console.log('GURPS Rules Companion | Initializing module');

  // Dynamic imports to avoid "Unexpected token 'import'" error in non-ES module environments
  ({ ActionsManagerApp } = await import('./classes/ActionsManagerApp.js'));
  ({ MODULE_ID, FLAG_KEYS } = await import('./constants.js'));

  registerModuleSettings();

  game.gurpsRulesCompanion = {
    ActionsManagerApp
  };
});

/**
 * Register module controls after Foundry is ready
 */
Hooks.once('ready', () => {
  console.log('GURPS Rules Companion | Module ready');

  game.gurpsRulesCompanion.open = () => {
    ActionsManagerApp.show();
  };

  ui.notifications.info(game.i18n.localize('GURPS_RULES_COMPANION.notifications.moduleLoaded'));
});

/**
 * Add button to scene controls (only visible to GMs)
 */
Hooks.on('getSceneControlButtons', (controls) => {
  const tokenControls = controls.tokens;

  if (tokenControls && tokenControls.tools) {
    tokenControls.tools['gurps-rules-companion'] = {
      name: 'gurps-rules-companion',
      title: 'GURPS Rules Companion',
      icon: 'fa-solid fa-scale-balanced',
      button: true,
      onClick: () => ActionsManagerApp.show(),
      visible: game.user.isGM && game.settings.get(MODULE_ID, 'showSceneButton')
    };
  }
});

/**
 * Register chat command
 */
Hooks.on('chatMessage', (chatLog, message, chatData) => {
  if (message === '/grc') {
    ActionsManagerApp.show();
    return false;
  }
  return true;
});
