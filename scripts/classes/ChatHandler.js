/**
 * ChatHandler - Manages sending action information to FoundryVTT chat
 */
export class ChatHandler {
  constructor() {
    this.contentRenderer = null;
  }

  /**
   * Set the content renderer to use for formatting
   * @param {ContentRenderer} renderer - The content renderer instance
   */
  setRenderer(renderer) {
    this.contentRenderer = renderer;
  }

  /**
   * Send an action to chat
   * @param {Object} action - The action object to send
   * @param {string} category - The category name
   */
  async sendToChat(action, category) {
    if (!action) {
      ui.notifications.warn('No action selected to send to chat');
      return;
    }

    const content = this.formatActionForChat(action, category);

    try {
      await ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker(),
        content: content,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER
      });

      ui.notifications.info(`${action.name} sent to chat`);
    } catch (error) {
      console.error('ChatHandler: Error sending to chat', error);
      ui.notifications.error('Failed to send action to chat');
    }
  }

  /**
   * Build notes content including movement information
   * @param {Object} action - The action object
   * @returns {string} Combined notes text
   */
  buildNotesForChat(action) {
    let notesContent = '';

    if (action.movement && action.movement !== 'none') {
      notesContent += `Movement: ${action.movement}`;
    }

    if (action.notes) {
      if (notesContent) notesContent += '<br><br>';
      notesContent += action.notes;
    }

    return notesContent;
  }

  /**
   * Format action data for chat display
   * @param {Object} action - The action object
   * @param {string} category - The category name
   * @returns {string} Formatted HTML for chat
   */
  formatActionForChat(action, category) {
    const defenses = this.formatDefenses(action.defenses);
    const notesContent = this.buildNotesForChat(action);

    return `
      <div class="am-chat-message">
        <h3 class="am-chat-title">${action.name}</h3>
        <div class="am-chat-category"><strong>Category:</strong> ${this.formatCategoryName(category)}</div>
        <div class="am-chat-field"><strong>Attack:</strong> ${action.attack ? 'Yes' : 'No'}</div>
        <div class="am-chat-field"><strong>Defenses:</strong> ${defenses}</div>
        ${notesContent ? `<div class="am-chat-notes"><strong>Notes:</strong> ${notesContent}</div>` : ''}
      </div>
    `;
  }

  /**
   * Format defenses for display
   * @param {Object} defenses - The defenses object
   * @returns {string} Formatted defenses
   */
  formatDefenses(defenses) {
    if (!defenses) return 'None';
    const activeDefenses = Object.entries(defenses)
      .filter(([key, value]) => value === true)
      .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1));
    return activeDefenses.length > 0 ? activeDefenses.join(', ') : 'None';
  }

  /**
   * Format category name for display
   * @param {string} category - The category name
   * @returns {string} Formatted category name
   */
  formatCategoryName(category) {
    return category
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
}
