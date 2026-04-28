import { Config } from '../config.js';
import { Helpers } from '../utils/Helpers.js';

export class InstructorManager {
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

    add() {
        const nameInput = document.getElementById('instructorName');
        const name = nameInput.value.trim();
        if (!name) return;

        this.#dataStore.data.instructors.push({
            id: Date.now().toString(),
            name,
            color: Config.DEFAULT_COLOR,
        });
        nameInput.value = '';
        this.#dataStore.save();
        this.#onUpdate();
    }

    remove(id) {
        const d = this.#dataStore.data;
        // Check ALL schedules for assignments (instructors are global)
        for (const [scheduleName, sd] of Object.entries(d.schedules)) {
            if (sd.courseInstructors) {
                const hasAssignments = Object.values(sd.courseInstructors).some(iId => iId === id);
                if (hasAssignments) {
                    alert(`Cannot delete instructor with assigned courses in schedule "${scheduleName}". Unassign them first.`);
                    return;
                }
            }
        }
        d.instructors = d.instructors.filter(i => i.id !== id);
        this.#dataStore.save();
        this.#onUpdate();
    }

    /** Calculate total scheduled credits for an instructor in the current schedule. */
    getWorkload(instructorId) {
        const d = this.#dataStore.data;
        const sd = this.#dataStore.getCurrentSchedule();

        // Collect all unique (courseId, section) keys that are in the grid
        const scheduledPairs = new Set();
        for (const classroomId in d.schedule) {
            for (const day in d.schedule[classroomId]) {
                for (const time in d.schedule[classroomId][day]) {
                    const slotData = d.schedule[classroomId][day][time];
                    const items = Array.isArray(slotData) ? slotData : (slotData ? [slotData] : []);
                    items.forEach(item => {
                        scheduledPairs.add(Helpers.getCourseInstructorKey(item.courseId, item.section));
                    });
                }
            }
        }

        // Sum credits for unique pairs assigned to this instructor
        let total = 0;
        scheduledPairs.forEach(key => {
            if (sd.courseInstructors[key] === instructorId) {
                const courseId = key.includes('::') ? key.split('::')[0] : key;
                const course = d.courseCatalog.find(c => c.id === courseId);
                if (course) total += course.credits;
            }
        });
        return total;
    }
}
