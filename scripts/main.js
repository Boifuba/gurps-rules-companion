import { ActionsManagerApp } from './classes/ActionsManagerApp.js';
import { MODULE_ID } from './constants.js';

/**
 * Register all module settings in the game settings menu
 */
function registerModuleSettings() {
  // game.settings.register(MODULE_ID, 'moduleEnabled', {
  //   name: 'Enable GURPS Rules Companion',
  //   hint: 'Toggle the module on or off',
  //   scope: 'world',
  //   config: true,
  //   type: Boolean,
  //   default: true,
  //   restricted: true,
  //   requiresReload: true
  // });

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
Hooks.once('init', () => {
  console.log('GURPS Rules Companion | Initializing module');

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
