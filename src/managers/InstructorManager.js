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
                const hasAssignments = Object.values(sd.courseInstructors).some(value =>
                    Helpers.normalizeInstructorAssignments(value).some(a => a.instructorId === id)
                );
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

        // Collect all unique (courseId, section) pairs that are in the grid.
        const scheduledPairs = new Map(); // key -> { courseId, section }
        for (const classroomId in d.schedule) {
            for (const day in d.schedule[classroomId]) {
                for (const time in d.schedule[classroomId][day]) {
                    const slotData = d.schedule[classroomId][day][time];
                    const items = Array.isArray(slotData) ? slotData : (slotData ? [slotData] : []);
                    items.forEach(item => {
                        const section = item.section || '';
                        const key = Helpers.getCourseInstructorKey(item.courseId, section);
                        scheduledPairs.set(key, { courseId: item.courseId, section });
                    });
                }
            }
        }

        // Sum this instructor's credit share across each unique scheduled pair.
        let total = 0;
        scheduledPairs.forEach(({ courseId, section }) => {
            const course = d.courseCatalog.find(c => c.id === courseId);
            if (!course) return;
            const assignment = Helpers.getInstructorAssignments(sd, courseId, section)
                .find(a => a.instructorId === instructorId);
            if (assignment) {
                total += assignment.credits == null ? course.credits : assignment.credits;
            }
        });
        return total;
    }
}
