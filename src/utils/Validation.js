import { Helpers } from './Helpers.js';

export class ValidationService {
    #dataStore;

    /**
     * @param {import('../data/DataStore.js').DataStore} dataStore
     */
    constructor(dataStore) {
        this.#dataStore = dataStore;
    }

    toggle() {
        const errorsDiv = document.getElementById('validationErrors');
        const icon = document.getElementById('validation-collapse-icon');
        if (!errorsDiv || !icon) return;

        const isCollapsed = errorsDiv.classList.toggle('collapsed');
        icon.textContent = isCollapsed ? '▶' : '▼';
    }

    /** Run all validation rules and return an array of error objects. */
    validate() {
        const errors = [];
        const d = this.#dataStore.data;
        const sd = this.#dataStore.getCurrentSchedule();
        const scheduleQuarter = sd.quarter;

        // Build map of all scheduled entries by timeslot
        const timeslotMap = {};
        const scheduledCourseIds = new Set();

        for (const classroomId in d.schedule) {
            const classroom = d.classrooms.find(c => c.id === classroomId);
            const roomNumber = classroom ? classroom.roomNumber : 'Unknown';

            for (const day in d.schedule[classroomId]) {
                for (const time in d.schedule[classroomId][day]) {
                    const slotData = d.schedule[classroomId][day][time];
                    const courses = Array.isArray(slotData) ? slotData : (slotData ? [slotData] : []);

                    courses.forEach(item => {
                        scheduledCourseIds.add(item.courseId);
                        const key = `${day}|${time}`;
                        if (!timeslotMap[key]) timeslotMap[key] = [];
                        timeslotMap[key].push({
                            courseId: item.courseId,
                            classroomId,
                            roomNumber,
                            modality: item.modality,
                            section: item.section || '',
                        });
                    });
                }
            }
        }

        // Instructor conflicts
        this._checkInstructorConflicts(timeslotMap, sd, errors);

        // Cohort/quarter conflicts
        this._checkCohortConflicts(timeslotMap, errors);

        // Missing program
        scheduledCourseIds.forEach(courseId => {
            const course = d.courseCatalog.find(c => c.id === courseId);
            if (course && !course.programId) {
                errors.push({
                    type: 'program',
                    message: `<strong>${Helpers.getCourseDisplayName(course, d.programs)}</strong> is not assigned to a program`,
                });
            }
        });

        // Quarter availability
        if (scheduleQuarter) {
            scheduledCourseIds.forEach(courseId => {
                const course = d.courseCatalog.find(c => c.id === courseId);
                if (course && course.quartersOffered && course.quartersOffered.length > 0) {
                    if (!course.quartersOffered.includes(scheduleQuarter)) {
                        errors.push({
                            type: 'quarter',
                            message: `<strong>${Helpers.getCourseDisplayName(course, d.programs)}</strong> is not offered in <strong>${scheduleQuarter}</strong> quarter (offered: ${course.quartersOffered.join(', ')})`,
                        });
                    }
                }
            });
        }

        // Missing quarter
        if (!scheduleQuarter) {
            errors.push({
                type: 'quarter',
                message: `<strong>Schedule "${d.currentSchedule}"</strong> does not have a quarter assigned. Please select a quarter.`,
            });
        }

        return errors;
    }

    _checkInstructorConflicts(timeslotMap, sd, errors) {
        const d = this.#dataStore.data;

        // Group all entries by day (skip Arranged)
        const dayEntries = {};
        for (const key in timeslotMap) {
            const [day, time] = key.split('|');
            if (day === 'Arranged') continue;
            if (!dayEntries[day]) dayEntries[day] = [];
            timeslotMap[key].forEach(entry => {
                dayEntries[day].push({ ...entry, time });
            });
        }

        for (const day in dayEntries) {
            const entries = dayEntries[day];

            const instructorEntries = {};
            entries.forEach(entry => {
                const course = d.courseCatalog.find(c => c.id === entry.courseId);
                const instrKey = Helpers.getCourseInstructorKey(entry.courseId, entry.section);
                const instructorId = sd.courseInstructors[instrKey] || null;
                if (course && instructorId) {
                    if (!instructorEntries[instructorId]) instructorEntries[instructorId] = [];
                    const sectionSuffix = entry.section ? ` \u00a7${entry.section}` : '';
                    instructorEntries[instructorId].push({
                        ...entry,
                        courseName: Helpers.getCourseDisplayName(course, d.programs) + sectionSuffix,
                    });
                }
            });

            for (const instructorId in instructorEntries) {
                const instrSlots = instructorEntries[instructorId];
                if (instrSlots.length < 2) continue;

                const reportedPairs = new Set();
                for (let i = 0; i < instrSlots.length; i++) {
                    for (let j = i + 1; j < instrSlots.length; j++) {
                        const a = instrSlots[i];
                        const b = instrSlots[j];

                        if (!Helpers.timesOverlap(a.time, b.time)) continue;

                        const keyA = Helpers.getCourseInstructorKey(a.courseId, a.section);
                        const keyB = Helpers.getCourseInstructorKey(b.courseId, b.section);
                        if (keyA === keyB) continue;

                        const pairKey = [keyA, keyB].sort().join('|||');
                        if (reportedPairs.has(pairKey)) continue;
                        reportedPairs.add(pairKey);

                        const instructor = d.instructors.find(i => i.id === instructorId);
                        const instructorName = instructor ? instructor.name : 'Unknown';
                        const timeDesc = a.time === b.time ? a.time : `${a.time} / ${b.time}`;
                        errors.push({
                            type: 'instructor',
                            message: `<strong>${instructorName}</strong> has overlapping classes on <strong>${day} ${timeDesc}</strong>: ${a.courseName} (Room ${a.roomNumber}) and ${b.courseName} (Room ${b.roomNumber})`,
                        });
                    }
                }
            }
        }
    }

    _checkCohortConflicts(timeslotMap, errors) {
        const d = this.#dataStore.data;

        const dayEntries = {};
        for (const key in timeslotMap) {
            const [day, time] = key.split('|');
            if (day === 'Arranged') continue;
            if (!dayEntries[day]) dayEntries[day] = [];
            timeslotMap[key].forEach(entry => {
                dayEntries[day].push({ ...entry, time });
            });
        }

        for (const day in dayEntries) {
            const entries = dayEntries[day];

            const cohortEntries = {};
            entries.forEach(entry => {
                const course = d.courseCatalog.find(c => c.id === entry.courseId);
                if (course && course.quarterTaken) {
                    const qKey = course.quarterTaken.trim().toUpperCase();
                    if (!cohortEntries[qKey]) cohortEntries[qKey] = [];
                    cohortEntries[qKey].push({
                        ...entry,
                        courseName: Helpers.getCourseDisplayName(course, d.programs),
                        quarterTaken: course.quarterTaken,
                    });
                }
            });

            for (const qKey in cohortEntries) {
                const group = cohortEntries[qKey];
                if (group.length < 2) continue;

                const reportedPairs = new Set();
                for (let i = 0; i < group.length; i++) {
                    for (let j = i + 1; j < group.length; j++) {
                        const a = group[i];
                        const b = group[j];

                        if (!Helpers.timesOverlap(a.time, b.time)) continue;
                        if (a.courseId === b.courseId) continue;

                        const pairKey = [a.courseId, b.courseId].sort().join('|||');
                        if (reportedPairs.has(pairKey)) continue;
                        reportedPairs.add(pairKey);

                        const timeDesc = a.time === b.time ? a.time : `${a.time} / ${b.time}`;
                        errors.push({
                            type: 'cohort',
                            message: `<strong>Cohort ${a.quarterTaken}</strong> has overlapping classes on <strong>${day} ${timeDesc}</strong>: ${a.courseName} (Room ${a.roomNumber}) and ${b.courseName} (Room ${b.roomNumber})`,
                        });
                    }
                }
            }
        }
    }
}
