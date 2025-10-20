import { DataManager } from './DataManager.js';
import { normalizeNotesEntries } from './ContentRenderer.js';

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
    const notesContext = this._getNotesContext(action.notes);

    context.action = {
      name: action.name || '',
      ref: action.ref || '',
      notesSummary: notesContext.summary,
      notesSections: notesContext.sections,
      description: action.description || '',
      tags: action.tags ? action.tags.join(', ') : ''
    };

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const element = this.element;

    const formElement = element.querySelector('#grc-action-form');
    formElement.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleSave(event.currentTarget);
    });

    element.querySelector('#grc-action-cancel-btn').addEventListener('click', () => {
      this.close();
    });

    this._initializeNotesSectionControls(formElement);
  }

  async handleSave(form) {
    const formData = new FormData(form);
    const newAction = {
      name: formData.get('name'),
      ref: formData.get('ref'),
      notes: this._buildNotesPayload(formData),
      description: formData.get('description'),
      tags: (formData.get('tags') || '').split(',').map(tag => tag.trim()).filter(tag => tag !== '')
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

  _getNotesContext(notes) {
    const defaultContext = { summary: '', sections: [] };

    if (!notes) {
      return defaultContext;
    }

    if (typeof notes === 'string') {
      return { summary: notes, sections: [] };
    }

    if (typeof notes === 'object' && !Array.isArray(notes)) {
      const summary = typeof notes.summary === 'string' ? notes.summary : '';
      const sections = Array.isArray(notes.sections)
        ? notes.sections
            .map((section) => this._normalizeSection(section))
            .filter((section) => section.title || section.text)
        : [];

      if (summary || sections.length) {
        return { summary, sections };
      }
    }

    const entries = normalizeNotesEntries(notes);
    if (!entries.length) {
      return defaultContext;
    }

    const summaryEntry = entries.find((entry) => entry.isSummary);
    let summary = '';
    if (summaryEntry) {
      summary = summaryEntry.text || summaryEntry.title || '';
    } else if (entries.length === 1 && !entries[0].title) {
      summary = entries[0].text;
    }

    const sections = entries
      .filter((entry) => entry !== summaryEntry)
      .map((entry) => ({ title: entry.title, text: entry.text }))
      .filter((section) => section.title || section.text);

    return { summary, sections };
  }

  _normalizeSection(section) {
    if (!section) {
      return { title: '', text: '' };
    }

    if (typeof section === 'string') {
      return { title: '', text: section };
    }

    return {
      title: typeof section.title === 'string' ? section.title : '',
      text: typeof section.text === 'string' ? section.text : ''
    };
  }

  _buildNotesPayload(formData) {
    const summary = (formData.get('notesSummary') || '').trim();
    const sectionsMap = new Map();

    for (const [key, value] of formData.entries()) {
      const match = key.match(/^notesSections\[(\d+)\]\[(title|text)\]$/);
      if (!match) continue;

      const index = Number(match[1]);
      if (!sectionsMap.has(index)) {
        sectionsMap.set(index, { title: '', text: '' });
      }

      sectionsMap.get(index)[match[2]] = (value || '').trim();
    }

    const sections = Array.from(sectionsMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, section]) => section)
      .filter((section) => section.title || section.text);

    if (!summary && sections.length === 0) {
      return '';
    }

    return {
      summary,
      sections
    };
  }

  _initializeNotesSectionControls(formElement) {
    const sectionsContainer = formElement.querySelector('#grc-notes-sections');
    const addButton = formElement.querySelector('#grc-add-note-section');
    if (!sectionsContainer || !addButton) {
      return;
    }

    const existingIndices = Array.from(sectionsContainer.querySelectorAll('.grc-note-section'))
      .map((section) => Number(section.dataset.index))
      .filter((index) => !Number.isNaN(index));
    let nextIndex = existingIndices.length ? Math.max(...existingIndices) + 1 : 0;

    const bindRemove = (sectionElement) => {
      const removeButton = sectionElement.querySelector('.grc-remove-section');
      if (!removeButton) return;
      removeButton.addEventListener('click', () => {
        sectionElement.remove();
      });
    };

    Array.from(sectionsContainer.querySelectorAll('.grc-note-section')).forEach(bindRemove);

    if (!sectionsContainer.querySelector('.grc-note-section')) {
      const sectionElement = this._createNotesSectionElement(nextIndex);
      nextIndex += 1;
      sectionsContainer.appendChild(sectionElement);
      bindRemove(sectionElement);
    }

    addButton.addEventListener('click', () => {
      const sectionElement = this._createNotesSectionElement(nextIndex);
      nextIndex += 1;
      sectionsContainer.appendChild(sectionElement);
      bindRemove(sectionElement);
    });
  }

  _createNotesSectionElement(index) {
    const sectionElement = document.createElement('div');
    sectionElement.classList.add('grc-note-section');
    sectionElement.dataset.index = index;
    sectionElement.innerHTML = `
      <div class="grc-note-section-header">
        <input type="text" name="notesSections[${index}][title]" placeholder="Section title" />
        <button type="button" class="grc-remove-section" data-index="${index}">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      <textarea name="notesSections[${index}][text]" rows="3" placeholder="Section details"></textarea>
    `;
    return sectionElement;
  }
}

