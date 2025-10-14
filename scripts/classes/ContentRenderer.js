import { ICON_URLS } from '../constants.js';

/**
 * ContentRenderer - Handles rendering of action content details
 */
export class ContentRenderer {
  constructor() {
    this.currentAction = null;
  }

  /**
   * Set the current action to display
   * @param {Object} action - The action object to render
   */
  setAction(action) {
    this.currentAction = action;
  }

  /**
   * Get the current action
   * @returns {Object|null} The current action
   */
  getAction() {
    return this.currentAction;
  }

  /**
   * Clear the current action
   */
  clear() {
    this.currentAction = null;
  }

  /**
   * Create icon HTML with active/inactive state
   * @param {string} iconType - The type of icon (attack, dodge, block, parry, movement)
   * @param {boolean} isActive - Whether the icon is active
   * @returns {string} HTML for the icon
   */
  createIcon(iconType, isActive) {
    const iconUrl = ICON_URLS[iconType];
    const activeClass = isActive ? 'grc-icon-active' : 'grc-icon-inactive';
    return `<img src="${iconUrl}" alt="${iconType}" class="grc-icon ${activeClass}" />`;
  }

  /**
   * Create defenses icons HTML
   * @param {Object} defenses - The defenses object
   * @returns {string} HTML for defense icons
   */
  createDefensesIcons(defenses) {
    if (!defenses) {
      return `
        ${this.createIcon('dodge', false)}
        ${this.createIcon('block', false)}
        ${this.createIcon('parry', false)}
      `;
    }
    return `
      ${this.createIcon('dodge', defenses.dodge === true)}
      ${this.createIcon('block', defenses.block === true)}
      ${this.createIcon('parry', defenses.parry === true)}
    `;
  }

  /**
   * Check if action is special
   * @param {Object} action - The action object
   * @returns {boolean} True if special
   */
  isSpecialAction(action) {
    return action.special === true;
  }

  /**
   * Process text to wrap [PDF: XXX] in span with pdflink class
   * @param {string} text - The text to process
   * @returns {string} Processed text with PDF links wrapped
   */
  processPdfLinks(text) {
    if (!text) return text;
    return text.replace(/\[PDF:\s*([^\]]+)\]/g, '<span class="pdflink" data-original-pageref="$1">$1</span>');
  }

  /**
   * Setup click handlers for PDF links
   */
  setupPdfLinkHandlers() {
    $(document).off('click', '.pdflink');
    $(document).on('click', '.pdflink', (event) => {
      event.preventDefault();
      const element = $(event.target);
      const pageref = element.data('original-pageref');
      if (pageref && typeof GURPS !== 'undefined' && GURPS.executeOTF) {
        GURPS.executeOTF(`[PDF:${pageref}]`);
      }
    });
  }


  /**
   * Generate HTML for special action
   * @param {Object} action - The action object
   * @returns {string} HTML string
   */
  renderSpecialHTML(action) {
    return `
      <div id="grc-content-display" class="grc-special-content">
        <div id="grc-content-body">
          ${action.ref ? `
          <div id="grc-content-field">
            <span id="grc-content-label">Reference:</span>
            <span id="grc-content-value">${this.processPdfLinks(action.ref)}</span>
          </div>
          ` : ''}
          ${action.notes ? `
          <div id="grc-content-field-notes">
            <span id="grc-content-label">Description:</span>
            <p id="grc-content-notes">${this.processPdfLinks(action.notes)}</p>
          </div>
          ` : ''}
        </div>
        <div id="grc-content-footer">
          <button id="grc-send-chat-btn" type="button">
            <i class="fas fa-comment"></i> Send to Chat
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Generate HTML for normal action
   * @param {Object} action - The action object
   * @returns {string} HTML string
   */
  renderNormalHTML(action) {
    return `
      <div id="grc-content-display">
        <div id="grc-content-body">
          <div id="grc-icons-row">
            ${this.createIcon('attack', action.attack === true)}
            ${this.createDefensesIcons(action.defenses)}
            ${this.createIcon('movement', action.movement && action.movement !== 'none')}
          </div>
          ${action.movement && action.movement !== 'none' && action.movement !== 'no' ? `
          <div id="grc-content-field">
            <span id="grc-content-label">Movement:</span>
            <span id="grc-content-value">${action.movement}</span>
          </div>
          ` : ''}
          ${action.ref ? `
          <div id="grc-content-field">
            <span id="grc-content-label">Reference:</span>
            <span id="grc-content-value">${this.processPdfLinks(action.ref)}</span>
          </div>
          ` : ''}
          ${action.notes ? `
          <div id="grc-content-field-notes">
            <span id="grc-content-label">Description:</span>
            <p id="grc-content-notes">${this.processPdfLinks(action.notes)}</p>
          </div>
          ` : ''}
        </div>
        <div id="grc-content-footer">
          <button id="grc-send-chat-btn" type="button">
            <i class="fas fa-comment"></i> Send to Chat
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Generate HTML for the action content
   * @returns {string} HTML string
   */
  renderHTML() {
    if (!this.currentAction) {
      return '<div id="grc-content-empty">Select an action to view details</div>';
    }

    const action = this.currentAction;

    if (this.isSpecialAction(action)) {
      return this.renderSpecialHTML(action);
    } else {
      return this.renderNormalHTML(action);
    }
  }
}
