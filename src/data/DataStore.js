import { Config } from '../config.js';

/**
 * DataStore — owns all application state and localStorage persistence.
 *
 * Export the singleton `dataStore` for use across the app.
 * Export the class `DataStore` for test instantiation.
 */
export class DataStore {
    #data;

    constructor() {
        this.#data = {
            programs: [],          // GLOBAL — shared across all schedules
            courseCatalog: [],     // GLOBAL — shared across all schedules
            instructors: [],       // GLOBAL — shared across all schedules
            schedules: {},
            currentSchedule: Config.DEFAULT_SCHEDULE,
            collapsedSections: {},
            instructorFilter: [],
            programFilter: '',
        };

        // Initialize the default schedule
        this.#data.schedules[Config.DEFAULT_SCHEDULE] = this.createEmptySchedule();

        // Backward-compatible virtual properties that delegate to the current schedule
        const self = this;
        Object.defineProperties(this.#data, {
            classrooms: {
                get() { return self.getCurrentSchedule().classrooms; },
                set(v) { self.getCurrentSchedule().classrooms = v; },
                configurable: true,
            },
            schedule: {
                get() { return self.getCurrentSchedule().schedule; },
                set(v) { self.getCurrentSchedule().schedule = v; },
                configurable: true,
            },
        });
    }

    /** Expose the data object (read/write). */
    get data() {
        return this.#data;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Schedule shape factories
    // ─────────────────────────────────────────────────────────────────────────

    /** Create a blank per-schedule data object. */
    createEmptySchedule(quarter = '') {
        const timeslots = {};
        Config.DAYS.filter(d => d !== 'Arranged').forEach(day => { timeslots[day] = []; });
        return { quarter, courseInstructors: {}, classrooms: [], schedule: {}, timeslots };
    }

    /**
     * Return the current schedule's data, auto-initialising any missing fields.
     * @returns {object}
     */
    getCurrentSchedule() {
        const d = this.#data;
        if (!d.schedules[d.currentSchedule]) {
            d.schedules[d.currentSchedule] = this.createEmptySchedule();
        }
        const sd = d.schedules[d.currentSchedule];
        if (!sd.courseInstructors) sd.courseInstructors = {};
        if (!sd.classrooms) sd.classrooms = [];
        if (!sd.schedule) sd.schedule = {};
        if (sd.quarter === undefined) sd.quarter = '';
        if (!sd.timeslots) {
            sd.timeslots = {};
            Config.DAYS.filter(day => day !== 'Arranged').forEach(day => { sd.timeslots[day] = []; });
        }
        return sd;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Persistence
    // ─────────────────────────────────────────────────────────────────────────

    save() {
        localStorage.setItem(Config.STORAGE_KEY, JSON.stringify(this.#data));
    }

    /** Load from localStorage and run multi-version migrations. */
    load() {
        const saved = localStorage.getItem(Config.STORAGE_KEY);
        if (!saved) return;

        try {
            const loaded = JSON.parse(saved);
            const d = this.#data;

            if (loaded.programs !== undefined && loaded.courseCatalog !== undefined) {
                // Current format (v3+ localStorage)
                d.programs = loaded.programs || [];
                d.courseCatalog = loaded.courseCatalog || [];
                d.schedules = loaded.schedules || {};
                d.currentSchedule = loaded.currentSchedule || Config.DEFAULT_SCHEDULE;
                d.collapsedSections = loaded.collapsedSections || {};
                d.instructorFilter = loaded.instructorFilter || [];
                d.programFilter = loaded.programFilter || '';
            } else if (loaded.schedules && typeof loaded.schedules === 'object' && loaded.currentSchedule) {
                // Old multi-schedule format (no programs/courseCatalog)
                d.programs = [];
                d.courseCatalog = [];
                d.schedules = loaded.schedules;
                d.currentSchedule = loaded.currentSchedule;
                d.collapsedSections = loaded.collapsedSections || {};
                d.instructorFilter = loaded.instructorFilter || [];
                d.programFilter = '';
                this._migrateLegacyCoursesToCatalog();
            } else if (loaded.instructors || loaded.courses || loaded.classrooms || loaded.schedule) {
                // Old single-schedule format
                d.programs = [];
                d.courseCatalog = [];
                d.collapsedSections = loaded.collapsedSections || {};
                d.instructorFilter = loaded.instructorFilter || [];
                d.programFilter = '';
                this._migrateSingleSchedule(loaded);
            } else {
                console.warn('Unrecognised data format — initialising with default schedule');
                return;
            }

            // Merge global instructors from per-schedule data if needed
            if (loaded.instructors && Array.isArray(loaded.instructors)) {
                d.instructors = loaded.instructors;
            } else {
                const globalInstructors = [];
                const seenIds = new Set();
                Object.values(d.schedules).forEach(sd => {
                    if (sd.instructors && Array.isArray(sd.instructors)) {
                        sd.instructors.forEach(instr => {
                            if (!seenIds.has(instr.id)) {
                                seenIds.add(instr.id);
                                globalInstructors.push(instr);
                            }
                        });
                        delete sd.instructors;
                    }
                });
                d.instructors = globalInstructors;
            }

            // Ensure global defaults
            if (!d.programs) d.programs = [];
            if (!d.courseCatalog) d.courseCatalog = [];
            if (!d.instructors) d.instructors = [];
            if (!d.collapsedSections) d.collapsedSections = {};
            if (!d.instructorFilter) d.instructorFilter = [];
            if (!d.schedules) d.schedules = {};
            if (!d.currentSchedule) d.currentSchedule = Config.DEFAULT_SCHEDULE;
            if (d.programFilter === undefined) d.programFilter = '';

            // Ensure currentSchedule exists
            if (!d.schedules[d.currentSchedule]) {
                const first = Object.keys(d.schedules)[0];
                if (first) {
                    d.currentSchedule = first;
                } else {
                    d.schedules[Config.DEFAULT_SCHEDULE] = this.createEmptySchedule();
                    d.currentSchedule = Config.DEFAULT_SCHEDULE;
                }
            }

            // Ensure catalog entries have all fields
            d.courseCatalog.forEach(course => {
                if (!course.programId) course.programId = null;
                if (!course.courseNumber) course.courseNumber = '';
                if (!course.quartersOffered) course.quartersOffered = [];
            });

            // Per-schedule migrations
            Object.values(d.schedules).forEach(sd => this._migrateScheduleData(sd));

            // Ensure instructors have colors
            d.instructors.forEach(instr => {
                if (!instr.color) instr.color = Config.DEFAULT_COLOR;
            });

            this.save();
        } catch (e) {
            console.error('Error loading data:', e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Migration helpers (private by convention)
    // ─────────────────────────────────────────────────────────────────────────

    _migrateLegacyCoursesToCatalog() {
        const d = this.#data;
        const courseMap = {};
        Object.keys(d.schedules).forEach(name => {
            const sd = d.schedules[name];
            if (sd.courses && Array.isArray(sd.courses)) {
                sd.courses.forEach(course => {
                    if (!courseMap[course.id]) {
                        const { instructorId, ...catalogCourse } = course;
                        catalogCourse.programId = null;
                        catalogCourse.courseNumber = '';
                        catalogCourse.quartersOffered = [];
                        courseMap[course.id] = catalogCourse;
                    }
                    if (!sd.courseInstructors) sd.courseInstructors = {};
                    if (course.instructorId) sd.courseInstructors[course.id] = course.instructorId;
                });
                delete sd.courses;
            }
            if (!sd.quarter) sd.quarter = '';
            if (!sd.courseInstructors) sd.courseInstructors = {};
        });
        d.courseCatalog = Object.values(courseMap);
    }

    _migrateSingleSchedule(loaded) {
        const d = this.#data;
        const courses = loaded.courses || [];
        const courseInstructors = {};
        courses.forEach(course => {
            const { instructorId, ...catalogCourse } = course;
            catalogCourse.programId = null;
            catalogCourse.courseNumber = '';
            catalogCourse.quartersOffered = [];
            d.courseCatalog.push(catalogCourse);
            if (instructorId) courseInstructors[course.id] = instructorId;
        });
        d.schedules = {
            [Config.DEFAULT_SCHEDULE]: {
                quarter: '',
                instructors: loaded.instructors || [],
                courseInstructors,
                classrooms: loaded.classrooms || [],
                schedule: loaded.schedule || {},
            },
        };
        d.currentSchedule = Config.DEFAULT_SCHEDULE;
    }

    _migrateScheduleData(sd) {
        if (!sd.courseInstructors) sd.courseInstructors = {};
        if (!sd.classrooms) sd.classrooms = [];
        if (!sd.schedule) sd.schedule = {};
        if (sd.quarter === undefined) sd.quarter = '';
        delete sd.instructors;

        // Old per-schedule courses array → global catalog
        if (sd.courses) {
            sd.courses.forEach(course => {
                if (course.instructorId) sd.courseInstructors[course.id] = course.instructorId;
                if (!this.#data.courseCatalog.find(c => c.id === course.id)) {
                    const { instructorId, ...catalogCourse } = course;
                    catalogCourse.programId = null;
                    catalogCourse.courseNumber = '';
                    catalogCourse.quartersOffered = [];
                    this.#data.courseCatalog.push(catalogCourse);
                }
            });
            delete sd.courses;
        }

        // Ensure schedule-level timeslots exist
        if (!sd.timeslots) {
            sd.timeslots = {};
            Config.DAYS.filter(d => d !== 'Arranged').forEach(day => { sd.timeslots[day] = []; });
        }

        // Classroom data migration
        (sd.classrooms || []).forEach(classroom => {
            if (Array.isArray(classroom.timeslots)) {
                const old = [...classroom.timeslots];
                classroom.timeslots = {};
                Config.DAYS.forEach(day => { classroom.timeslots[day] = [...old]; });
            }
            if (classroom.timeslots && typeof classroom.timeslots === 'object') {
                Config.DAYS.filter(d => d !== 'Arranged').forEach(day => {
                    (classroom.timeslots[day] || []).forEach(ts => {
                        if (!sd.timeslots[day].includes(ts)) sd.timeslots[day].push(ts);
                    });
                });
            }
            delete classroom.timeslots;
            delete classroom.timeslotFormExpanded;

            if (!sd.schedule[classroom.id]) {
                sd.schedule[classroom.id] = {};
                Config.DAYS.forEach(day => { sd.schedule[classroom.id][day] = {}; });
            }

            Config.DAYS.forEach(day => {
                if (sd.schedule[classroom.id][day]) {
                    Object.keys(sd.schedule[classroom.id][day]).forEach(time => {
                        const value = sd.schedule[classroom.id][day][time];
                        if (typeof value === 'string') {
                            sd.schedule[classroom.id][day][time] = [{ courseId: value, modality: 'in-person', section: '' }];
                        } else if (value && !Array.isArray(value) && value.courseId) {
                            if (value.section === undefined) value.section = '';
                            sd.schedule[classroom.id][day][time] = [value];
                        } else if (Array.isArray(value)) {
                            value.forEach(item => { if (item && item.section === undefined) item.section = ''; });
                        }
                    });
                }
            });
        });

        // Sort schedule-level timeslots
        Config.DAYS.filter(d => d !== 'Arranged').forEach(day => {
            if (sd.timeslots[day]) sd.timeslots[day].sort();
        });
    }
}

/** Application-wide singleton instance. */
export const dataStore = new DataStore();
