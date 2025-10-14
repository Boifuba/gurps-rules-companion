export class AccordionManager {
  constructor() {
    this.expandedColumn2 = new Set();
    this.selectedColumn1 = null;
    this.selectedColumn2 = null;
    this.listeners = [];
  }

  selectColumn1Button(category) {
    this.selectedColumn1 = category;
    this.expandedColumn2.clear();
    this.selectedColumn2 = null;
    this.notifyListeners();
  }

  toggleColumn2(subcategory) {
    if (this.expandedColumn2.has(subcategory)) {
      this.expandedColumn2.delete(subcategory);
    } else {
      this.expandedColumn2.add(subcategory);
      this.selectedColumn2 = subcategory;
    }
    this.notifyListeners();
  }

  selectColumn1(category) {
    this.selectedColumn1 = category;
    this.expandedColumn2.clear();
    this.selectedColumn2 = null;
    this.notifyListeners();
  }

  selectColumn2(subcategory) {
    this.selectedColumn2 = subcategory;
    this.notifyListeners();
  }

  isSelectedColumn1(category) {
    return this.selectedColumn1 === category;
  }

  isExpandedColumn2(subcategory) {
    return this.expandedColumn2.has(subcategory);
  }

  getSelectedColumn1() {
    return this.selectedColumn1;
  }

  getSelectedColumn2() {
    return this.selectedColumn2;
  }

  clearColumn2() {
    this.expandedColumn2.clear();
    this.selectedColumn2 = null;
  }

  clearAll() {
    this.expandedColumn2.clear();
    this.selectedColumn1 = null;
    this.selectedColumn2 = null;
  }

  reset() {
    this.clearAll();
    this.notifyListeners();
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  notifyListeners() {
    this.listeners.forEach(callback => callback());
  }
}
