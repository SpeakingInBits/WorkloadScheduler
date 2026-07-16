/**
 * Pure utility helpers — all methods are static so they can be used
 * without instantiation and are easy to unit test in isolation.
 */
export class Helpers {
    /**
     * Build the courseInstructors map key for a (courseId, section) pair.
     * @param {string} courseId
     * @param {string} section
     * @returns {string}
     */
    static getCourseInstructorKey(courseId, section) {
        return section ? `${courseId}::${section}` : courseId;
    }

    /**
     * Normalise a raw `courseInstructors[key]` value into an array of
     * `{ instructorId, credits }` assignment entries.
     *
     * Accepts every historical shape:
     *   - a bare instructor id string (legacy single-instructor)
     *   - an array of id strings and/or `{ instructorId, credits }` objects
     *   - null / undefined (no assignment)
     *
     * A `credits` of null means "unspecified" — callers fall back to the
     * course's total credits (which is correct for a lone instructor).
     * @param {*} value
     * @returns {Array<{ instructorId: string, credits: number|null }>}
     */
    static normalizeInstructorAssignments(value) {
        const toEntry = (item) => {
            if (typeof item === 'string') {
                return item ? { instructorId: item, credits: null } : null;
            }
            if (item && item.instructorId) {
                const c = item.credits;
                const credits = (c === null || c === undefined || c === '') ? null : Number(c);
                return { instructorId: item.instructorId, credits: Number.isNaN(credits) ? null : credits };
            }
            return null;
        };

        if (Array.isArray(value)) return value.map(toEntry).filter(Boolean);
        const single = toEntry(value);
        return single ? [single] : [];
    }

    /**
     * Return the normalised instructor assignments for a (course, section)
     * pair in the given schedule.
     * @param {object} scheduleData  — the current per-schedule data object
     * @param {string} courseId
     * @param {string} section
     * @returns {Array<{ instructorId: string, credits: number|null }>}
     */
    static getInstructorAssignments(scheduleData, courseId, section) {
        const key = Helpers.getCourseInstructorKey(courseId, section);
        return Helpers.normalizeInstructorAssignments(scheduleData.courseInstructors[key]);
    }

    /**
     * The "primary" instructor id for a (course, section) pair — the first
     * assignment — used for grid colouring. Returns null when unassigned.
     * @param {object} scheduleData
     * @param {string} courseId
     * @param {string} section
     * @returns {string|null}
     */
    static getPrimaryInstructorId(scheduleData, courseId, section) {
        const assignments = Helpers.getInstructorAssignments(scheduleData, courseId, section);
        return assignments.length > 0 ? assignments[0].instructorId : null;
    }

    /**
     * Format a (possibly fractional) credit value for display: at most two
     * decimal places, trailing zeros stripped (3 → "3", 2.5 → "2.5").
     * @param {number} value
     * @returns {string}
     */
    static formatCredits(value) {
        const n = Number(value) || 0;
        return parseFloat(n.toFixed(2)).toString();
    }

    /**
     * Build a human-readable display name: "PROGRAM NUMBER - Name" or fallback.
     * @param {object|null} course
     * @param {Array} programs  — the global programs array
     * @returns {string}
     */
    static getCourseDisplayName(course, programs) {
        if (!course) return 'Unknown';
        const program = programs.find(p => p.id === course.programId);
        const prefix = program
            ? `${program.name} ${course.courseNumber || ''}`.trim()
            : (course.courseNumber || '');
        if (prefix && course.name) return `${prefix} - ${course.name}`;
        if (prefix) return prefix;
        return course.name || 'Unnamed Course';
    }

    /**
     * Return a catalog course object merged with the instructor assignment
     * from the current schedule.
     * @param {string} courseId
     * @param {string} section
     * @param {Array}  courseCatalog
     * @param {object} scheduleData   — the current per-schedule data object
     * @returns {object|null}
     */
    static getCourseWithInstructor(courseId, section, courseCatalog, scheduleData) {
        const course = courseCatalog.find(c => c.id === courseId);
        if (!course) return null;
        const key = Helpers.getCourseInstructorKey(courseId, section);
        return { ...course, instructorId: scheduleData.courseInstructors[key] || null };
    }

    /**
     * Parse "HH:MM" → minutes since midnight.
     * @param {string} timeStr
     * @returns {number}
     */
    static parseTime(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    /**
     * Parse "HH:MM-HH:MM" → { start, end } in minutes since midnight.
     * @param {string} timeslot
     * @returns {{ start: number, end: number }}
     */
    static parseTimeRange(timeslot) {
        const [start, end] = timeslot.split('-');
        return { start: Helpers.parseTime(start), end: Helpers.parseTime(end) };
    }

    /**
     * Return true when two "HH:MM-HH:MM" ranges overlap
     * (exclusive of touching endpoints).
     * @param {string} ts1
     * @param {string} ts2
     * @returns {boolean}
     */
    static timesOverlap(ts1, ts2) {
        const r1 = Helpers.parseTimeRange(ts1);
        const r2 = Helpers.parseTimeRange(ts2);
        return r1.start < r2.end && r2.start < r1.end;
    }

    /**
     * Return every pair of timeslots from a sorted array that overlap each other.
     * @param {string[]} timeslots
     * @returns {Array<[string, string]>}
     */
    static findOverlappingTimeslots(timeslots) {
        const pairs = [];
        for (let i = 0; i < timeslots.length; i++) {
            for (let j = i + 1; j < timeslots.length; j++) {
                if (Helpers.timesOverlap(timeslots[i], timeslots[j])) {
                    pairs.push([timeslots[i], timeslots[j]]);
                }
            }
        }
        return pairs;
    }
}
