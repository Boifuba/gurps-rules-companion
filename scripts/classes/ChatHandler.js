import { normalizeNotesEntries } from './ContentRenderer.js';

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
   * Apply PDF link formatting
   * @param {string} text - Raw text
   * @returns {string} Text with PDF links wrapped
   */
  processPdfLinks(text) {
    if (this.contentRenderer && typeof this.contentRenderer.processPdfLinks === 'function') {
      return this.contentRenderer.processPdfLinks(text);
    }

    if (!text) return text;
    return text.replace(/\[PDF:\s*([^\]]+)\]/g, '<span class="pdflink" data-original-pageref="$1">$1</span>');
  }

  /**
   * Build structured notes content for chat
   * @param {Object} action - The action object
   * @returns {string} HTML string for chat notes
   */
  buildNotesForChat(action) {
    const entries = normalizeNotesEntries(action.notes);
    const movementValue = action.movement;
    if (movementValue && movementValue !== 'none' && movementValue !== 'no') {
      const movementText = typeof movementValue === 'string' ? movementValue.trim() : String(movementValue).trim();
      if (movementText) {
        entries.unshift({ title: 'Movement', text: movementText });
      }
    }

    const notesHtml = entries
      .map((entry) => {
        const classes = ['grc-note-entry'];
        if (entry.isSummary) classes.push('grc-note-summary');

        const titleHtml = entry.title
          ? `<div class="grc-note-title">${this.processPdfLinks(entry.title)}</div>`
          : '';
        const textHtml = entry.text
          ? `<div class="grc-note-text">${this.processPdfLinks(entry.text)}</div>`
          : '';

        if (!titleHtml && !textHtml) return '';
        return `<div class="${classes.join(' ')}">${titleHtml}${textHtml}</div>`;
      })
      .filter(Boolean)
      .join('');

    if (!notesHtml) return '';
    return `<div class="grc-chat-notes-list">${notesHtml}</div>`;
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
      <div class="grc-chat-message">
        <h3 class="grc-chat-title">${action.name}</h3>
        <div class="grc-chat-category"><strong>Category:</strong> ${this.formatCategoryName(category)}</div>
        <div class="grc-chat-field"><strong>Attack:</strong> ${action.attack ? 'Yes' : 'No'}</div>
        <div class="grc-chat-field"><strong>Defenses:</strong> ${defenses}</div>
        ${action.ref ? `<div class="grc-chat-field"><strong>Reference:</strong> ${action.ref}</div>` : ''}
        ${notesContent ? `<div class="grc-chat-notes"><strong>Notes:</strong>${notesContent}</div>` : ''}
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
