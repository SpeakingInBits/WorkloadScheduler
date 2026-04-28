export class ScheduleGridManager {
    #dataStore;
    #onUpdate;

    /**
     * @param {import('../data/DataStore.js').DataStore} dataStore
     * @param {() => void} onUpdate
     */
    constructor(dataStore, onUpdate) {
        this.#dataStore = dataStore;
        this.#onUpdate = onUpdate;
    }

    schedule(classroomId, day, time, courseId, modality, section) {
        const d = this.#dataStore.data;
        if (!d.schedule[classroomId]) d.schedule[classroomId] = {};
        if (!d.schedule[classroomId][day]) d.schedule[classroomId][day] = {};
        if (!d.schedule[classroomId][day][time]) d.schedule[classroomId][day][time] = [];

        d.schedule[classroomId][day][time].push({
            courseId,
            modality: modality || 'in-person',
            section: section || '',
        });
        this.#dataStore.save();
        this.#onUpdate();
    }

    unschedule(classroomId, day, time, courseIndex) {
        const d = this.#dataStore.data;
        if (!d.schedule[classroomId]?.[day]?.[time]) return;

        if (courseIndex !== undefined) {
            d.schedule[classroomId][day][time].splice(courseIndex, 1);
            if (d.schedule[classroomId][day][time].length === 0) {
                delete d.schedule[classroomId][day][time];
            }
        } else {
            delete d.schedule[classroomId][day][time];
        }
        this.#dataStore.save();
        this.#onUpdate();
    }
}
