import { Config } from '../config.js';

export class ScheduleManager {
    #dataStore;
    #onUpdate;

    /**
     * @param {import('../data/DataStore.js').DataStore} dataStore
     * @param {{ render: () => void, renderValidationSummary: () => void }} callbacks
     */
    constructor(dataStore, callbacks) {
        this.#dataStore = dataStore;
        this.#onUpdate = callbacks;
    }

    renderSelector() {
        const select = document.getElementById('scheduleSelect');
        if (!select) return;

        const d = this.#dataStore.data;
        const names = Object.keys(d.schedules);
        select.innerHTML = names.map(name =>
            `<option value="${name}" ${name === d.currentSchedule ? 'selected' : ''}>${name}</option>`
        ).join('');

        const quarterSelect = document.getElementById('scheduleQuarter');
        if (quarterSelect) {
            quarterSelect.value = this.#dataStore.getCurrentSchedule().quarter || '';
        }
    }

    switchTo() {
        const select = document.getElementById('scheduleSelect');
        this.#dataStore.data.currentSchedule = select.value;
        this.#dataStore.save();
        this.renderSelector();
        this.#onUpdate.render();
    }

    create() {
        const d = this.#dataStore.data;
        const name = prompt('Enter name for new schedule:');
        if (!name || !name.trim()) return;

        const scheduleName = name.trim();
        if (d.schedules[scheduleName]) {
            alert('A schedule with this name already exists.');
            return;
        }

        let quarter = '';
        while (!quarter) {
            const input = prompt('Select quarter for this schedule (Fall, Winter, Spring, Summer):');
            if (input === null) return;
            const match = Config.QUARTERS.find(q => q.toLowerCase() === input.trim().toLowerCase());
            if (match) {
                quarter = match;
            } else {
                alert('Please enter a valid quarter: Fall, Winter, Spring, or Summer');
            }
        }

        const copyExisting = confirm(
            `Would you like to copy the current schedule "${d.currentSchedule}" to the new schedule?\n\nClick OK to copy, or Cancel to start with an empty schedule.`
        );

        if (copyExisting) {
            const current = this.#dataStore.getCurrentSchedule();
            d.schedules[scheduleName] = {
                quarter,
                courseInstructors: JSON.parse(JSON.stringify(current.courseInstructors || {})),
                classrooms: JSON.parse(JSON.stringify(current.classrooms || [])),
                schedule: JSON.parse(JSON.stringify(current.schedule || {})),
                timeslots: JSON.parse(JSON.stringify(current.timeslots || {})),
            };
        } else {
            d.schedules[scheduleName] = this.#dataStore.createEmptySchedule(quarter);
        }

        d.currentSchedule = scheduleName;
        this.#dataStore.save();
        this.renderSelector();
        this.#onUpdate.render();
    }

    rename() {
        const d = this.#dataStore.data;
        const oldName = d.currentSchedule;
        const newName = prompt('Enter new name for schedule:', oldName);
        if (!newName || !newName.trim() || newName.trim() === oldName) return;

        const scheduleName = newName.trim();
        if (d.schedules[scheduleName]) {
            alert('A schedule with this name already exists.');
            return;
        }

        d.schedules[scheduleName] = d.schedules[oldName];
        delete d.schedules[oldName];
        d.currentSchedule = scheduleName;
        this.#dataStore.save();
        this.renderSelector();
        this.#onUpdate.render();
    }

    deleteCurrent() {
        const d = this.#dataStore.data;
        if (Object.keys(d.schedules).length === 1) {
            alert('Cannot delete the last schedule.');
            return;
        }
        if (!confirm(`Delete schedule "${d.currentSchedule}"?`)) return;

        delete d.schedules[d.currentSchedule];
        d.currentSchedule = Object.keys(d.schedules)[0];
        this.#dataStore.save();
        this.renderSelector();
        this.#onUpdate.render();
    }

    updateQuarter() {
        const quarterSelect = document.getElementById('scheduleQuarter');
        if (quarterSelect) {
            this.#dataStore.getCurrentSchedule().quarter = quarterSelect.value;
            this.#dataStore.save();
            this.#onUpdate.renderValidationSummary();
        }
    }
}
