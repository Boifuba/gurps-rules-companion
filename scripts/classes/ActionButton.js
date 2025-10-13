/**
 * ActionButton - Represents a single action button
 */
export class ActionButton {
  constructor(action, category, index, subcategory = null) {
    this.action = action;
    this.category = category;
    this.index = index;
    this.subcategory = subcategory;
    this.isSelected = false;
  }

  /**
   * Get the action name
   * @returns {string} The action name
   */
  getName() {
    return this.action.name;
  }

  /**
   * Get the full action data
   * @returns {Object} The action object
   */
  getAction() {
    return this.action;
  }

  /**
   * Check if the action is marked as special
   * @returns {boolean} True if special
   */
  isSpecial() {
    return this.action.special === true;
  }

  /**
   * Get the category this action belongs to
   * @returns {string} The category name
   */
  getCategory() {
    return this.category;
  }

  /**
   * Get the index of this action
   * @returns {number} The action index
   */
  getIndex() {
    return this.index;
  }

  /**
   * Set the selected state
   * @param {boolean} selected - Whether the button is selected
   */
  setSelected(selected) {
    this.isSelected = selected;
  }

  /**
   * Check if the button is selected
   * @returns {boolean} True if selected
   */
  getSelected() {
    return this.isSelected;
  }

  /**
   * Generate a unique identifier for this button
   * @returns {string} Unique button ID
   */
  getId() {
    if (this.subcategory) {
      return `action-${this.category}-${this.subcategory}-${this.index}`;
    }
    return `action-${this.category}-${this.index}`;
  }

  getSubcategory() {
    return this.subcategory;
  }
}
