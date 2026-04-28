import { Config } from '../config.js';

export class CourseManager {
    #dataStore;
    #uiState;
    #onUpdate;

    /**
     * @param {import('../data/DataStore.js').DataStore} dataStore
     * @param {import('../ui/UIStateController.js').UIStateController} uiState
     * @param {() => void} onUpdate
     */
    constructor(dataStore, uiState, onUpdate) {
        this.#dataStore = dataStore;
        this.#uiState = uiState;
        this.#onUpdate = onUpdate;
    }

    add() {
        const programSelect = document.getElementById('courseProgram');
        const numberInput = document.getElementById('courseNumber');
        const nameInput = document.getElementById('courseName');
        const creditsInput = document.getElementById('courseCredits');
        const quarterInput = document.getElementById('courseQuarterTaken');

        const credits = parseInt(creditsInput.value);
        if (!credits) return;

        const quartersOffered = this.#uiState.getQuartersOfferedFromCheckboxes('add');

        this.#dataStore.data.courseCatalog.push({
            id: Date.now().toString(),
            name: nameInput.value.trim() || '',
            credits,
            programId: programSelect.value || null,
            courseNumber: numberInput.value.trim() || '',
            quarterTaken: (quarterInput ? quarterInput.value.trim() : '') || null,
            quartersOffered,
        });

        nameInput.value = '';
        creditsInput.value = '';
        if (numberInput) numberInput.value = '';
        if (programSelect) programSelect.value = '';
        if (quarterInput) quarterInput.value = '';
        this.#uiState.setQuartersOfferedCheckboxes('add', []);
        this.#dataStore.save();
        this.#onUpdate();
    }

    remove(id) {
        const d = this.#dataStore.data;
        // Remove from schedule grid in ALL schedules
        Object.keys(d.schedules).forEach(scheduleName => {
            const sd = d.schedules[scheduleName];
            if (sd.schedule) {
                Object.keys(sd.schedule).forEach(classroomId => {
                    Config.DAYS.forEach(day => {
                        if (sd.schedule[classroomId][day]) {
                            Object.keys(sd.schedule[classroomId][day]).forEach(time => {
                                const slotData = sd.schedule[classroomId][day][time];
                                if (Array.isArray(slotData)) {
                                    sd.schedule[classroomId][day][time] = slotData.filter(item => item.courseId !== id);
                                    if (sd.schedule[classroomId][day][time].length === 0) {
                                        delete sd.schedule[classroomId][day][time];
                                    }
                                } else if (slotData && slotData.courseId === id) {
                                    delete sd.schedule[classroomId][day][time];
                                }
                            });
                        }
                    });
                });
            }
            // Remove instructor assignments (including section-based keys)
            if (sd.courseInstructors) {
                Object.keys(sd.courseInstructors).forEach(key => {
                    if (key === id || key.startsWith(id + '::')) {
                        delete sd.courseInstructors[key];
                    }
                });
            }
        });

        d.courseCatalog = d.courseCatalog.filter(c => c.id !== id);
        this.#dataStore.save();
        this.#onUpdate();
    }

    /** Check if a course is scheduled anywhere in the current schedule. */
    isScheduled(courseId) {
        const schedule = this.#dataStore.data.schedule;
        for (const classroomId in schedule) {
            for (const day in schedule[classroomId]) {
                for (const time in schedule[classroomId][day]) {
                    const slotData = schedule[classroomId][day][time];
                    if (Array.isArray(slotData)) {
                        if (slotData.some(item => item.courseId === courseId)) return true;
                    } else if (slotData && slotData.courseId === courseId) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /** Check if a timeslot already has ≥2 in-person courses (conflict). */
    hasInPersonConflict(day, timeslot) {
        const schedule = this.#dataStore.data.schedule;
        let count = 0;
        for (const classroomId in schedule) {
            const slotData = schedule[classroomId]?.[day]?.[timeslot];
            if (slotData) {
                if (Array.isArray(slotData)) {
                    count += slotData.filter(item => item.modality === 'in-person').length;
                } else if (slotData.modality === 'in-person') {
                    count++;
                }
                if (count >= 2) return true;
            }
        }
        return false;
    }
}
