import { Config } from '../config.js';

export class TimeslotManager {
    #dataStore;
    #onUpdate;

    /**
     * @param {import('../data/DataStore.js').DataStore} dataStore
     * @param {{ render: () => void, renderTimeslotManager: () => void }} callbacks
     */
    constructor(dataStore, callbacks) {
        this.#dataStore = dataStore;
        this.#onUpdate = callbacks;
    }

    add(day, startTime, endTime) {
        const sd = this.#dataStore.getCurrentSchedule();
        const timeslot = `${startTime}-${endTime}`;
        if (!sd.timeslots[day]) sd.timeslots[day] = [];
        if (!sd.timeslots[day].includes(timeslot)) {
            sd.timeslots[day].push(timeslot);
            sd.timeslots[day].sort();
            this.#dataStore.save();
            this.#onUpdate.render();
        }
    }

    remove(day, timeslot) {
        const sd = this.#dataStore.getCurrentSchedule();
        if (!sd.timeslots[day]) return;

        // Remove scheduled data for this timeslot across all classrooms
        sd.classrooms.forEach(classroom => {
            if (sd.schedule[classroom.id]?.[day]?.[timeslot]) {
                delete sd.schedule[classroom.id][day][timeslot];
            }
        });

        sd.timeslots[day] = sd.timeslots[day].filter(t => t !== timeslot);
        this.#dataStore.save();
        this.#onUpdate.render();
    }

    edit(day, oldTimeslot, newStart, newEnd) {
        const sd = this.#dataStore.getCurrentSchedule();
        const newTimeslot = `${newStart}-${newEnd}`;
        if (oldTimeslot === newTimeslot) return;

        if (newStart >= newEnd) {
            alert('End time must be after start time');
            this.#onUpdate.render();
            return;
        }

        if (sd.timeslots[day].includes(newTimeslot)) {
            alert('This timeslot already exists');
            this.#onUpdate.render();
            return;
        }

        const idx = (sd.timeslots[day] || []).indexOf(oldTimeslot);
        if (idx >= 0) {
            sd.timeslots[day][idx] = newTimeslot;
            sd.timeslots[day].sort();
        }

        // Migrate schedule data for all classrooms
        sd.classrooms.forEach(classroom => {
            if (sd.schedule[classroom.id]?.[day]?.[oldTimeslot]) {
                sd.schedule[classroom.id][day][newTimeslot] = sd.schedule[classroom.id][day][oldTimeslot];
                delete sd.schedule[classroom.id][day][oldTimeslot];
            }
        });

        this.#dataStore.save();
        this.#onUpdate.render();
    }

    copyToAllDays(sourceDay) {
        const sd = this.#dataStore.getCurrentSchedule();
        if (!sd.timeslots[sourceDay]) return;
        const timeslots = [...sd.timeslots[sourceDay]];
        Config.DAYS.filter(d => d !== 'Arranged').forEach(day => {
            if (day !== sourceDay) sd.timeslots[day] = [...timeslots];
        });
        this.#dataStore.save();
        this.#onUpdate.render();
    }

    addFromForm(day) {
        const startInput = document.getElementById(`shared-startTime-${day}`);
        const endInput = document.getElementById(`shared-endTime-${day}`);
        const startTime = startInput?.value;
        const endTime = endInput?.value;

        if (startTime && endTime) {
            if (startTime >= endTime) {
                alert('End time must be after start time');
                return;
            }
            this.add(day, startTime, endTime);
        }
    }

    togglePanel() {
        const sd = this.#dataStore.getCurrentSchedule();
        sd.timeslotManagerExpanded = !(sd.timeslotManagerExpanded !== false);
        this.#dataStore.save();
        this.#onUpdate.renderTimeslotManager();
    }
}
