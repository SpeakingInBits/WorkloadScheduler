import { Config } from '../config.js';

export class UIStateController {
    #dataStore;
    #onRenderSchedule;   // () => void
    #onRenderCourses;    // () => void

    /**
     * @param {import('../data/DataStore.js').DataStore} dataStore
     * @param {{ renderSchedule: () => void, renderCourses: () => void }} callbacks
     */
    constructor(dataStore, callbacks) {
        this.#dataStore = dataStore;
        this.#onRenderSchedule = callbacks.renderSchedule;
        this.#onRenderCourses = callbacks.renderCourses;
    }

    toggleSection(sectionName) {
        const section = document.getElementById(`${sectionName}-section`);
        const icon = document.getElementById(`${sectionName}-icon`);
        if (!section || !icon) return;

        const isCollapsed = section.style.display === 'none';
        section.style.display = isCollapsed ? 'block' : 'none';
        icon.textContent = isCollapsed ? '▼' : '▶';

        const d = this.#dataStore.data;
        if (!d.collapsedSections) d.collapsedSections = {};
        d.collapsedSections[sectionName] = !isCollapsed;
        this.#dataStore.save();
    }

    toggleInstructorFilter(e) {
        e.stopPropagation();
        const filterList = document.getElementById('instructorFilterList');
        filterList.style.display = filterList.style.display === 'none' ? 'block' : 'none';
    }

    updateInstructorFilter(instructorId, checked) {
        const d = this.#dataStore.data;
        if (!d.instructorFilter) d.instructorFilter = [];
        if (checked) {
            if (!d.instructorFilter.includes(instructorId)) {
                d.instructorFilter.push(instructorId);
            }
        } else {
            d.instructorFilter = d.instructorFilter.filter(id => id !== instructorId);
        }
        this.#dataStore.save();
        this.#onRenderSchedule();
    }

    updateProgramFilter() {
        const select = document.getElementById('programFilterSelect');
        this.#dataStore.data.programFilter = select ? select.value : '';
        this.#dataStore.save();
        this.#onRenderCourses();
    }

    toggleQuartersOffered(event, context) {
        event.stopPropagation();
        event.preventDefault();
        const listId = context === 'edit' ? 'editQuartersOfferedList' : 'quartersOfferedList';
        const list = document.getElementById(listId);
        if (list) {
            list.style.display = list.style.display === 'none' ? 'block' : 'none';
        }
    }

    getQuartersOfferedFromCheckboxes(context) {
        const prefix = context === 'edit' ? 'qo-edit-' : 'qo-add-';
        const quarters = [];
        Config.QUARTERS.forEach(q => {
            const cb = document.getElementById(prefix + q.toLowerCase());
            if (cb && cb.checked) quarters.push(q);
        });
        return quarters;
    }

    setQuartersOfferedCheckboxes(context, quartersOffered) {
        const prefix = context === 'edit' ? 'qo-edit-' : 'qo-add-';
        Config.QUARTERS.forEach(q => {
            const cb = document.getElementById(prefix + q.toLowerCase());
            if (cb) cb.checked = (quartersOffered || []).includes(q);
        });
    }

    restoreCollapsedSections() {
        const d = this.#dataStore.data;
        if (!d.collapsedSections) return;
        Object.keys(d.collapsedSections).forEach(sectionName => {
            const isCollapsed = d.collapsedSections[sectionName];
            const section = document.getElementById(`${sectionName}-section`);
            const icon = document.getElementById(`${sectionName}-icon`);
            if (section && icon) {
                section.style.display = isCollapsed ? 'none' : 'block';
                icon.textContent = isCollapsed ? '▶' : '▼';
            }
        });
    }
}
