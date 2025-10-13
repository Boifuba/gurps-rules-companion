import { ActionsManagerApp } from './classes/ActionsManagerApp.js';

/**
 * Main module initialization
 */
Hooks.once('init', () => {
  console.log('GURPS Rules Companion | Initializing module');

  game.actionsManager = {
    ActionsManagerApp
  };
});

/**
 * Register module controls after Foundry is ready
 */
Hooks.once('ready', () => {
  console.log('GURPS Rules Companion | Module ready');

  game.actionsManager.open = () => {
    ActionsManagerApp.show();
  };

  ui.notifications.info('GURPS Rules Companion loaded. Use game.actionsManager.open() to open the interface.');
});

/**
 * Add button to scene controls (optional)
 */
Hooks.on('getSceneControlButtons', (controls) => {
  if (!game.user.isGM) return;

  const tokenControls = controls.find(c => c.name === 'token');
  if (tokenControls) {
    tokenControls.tools.push({
      name: 'actions-manager',
      title: 'GURPS Rules Companion',
      icon: 'fas fa-list-check',
      button: true,
      onClick: () => ActionsManagerApp.show()
    });
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
