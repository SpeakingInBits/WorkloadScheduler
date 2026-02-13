const Config = Object.freeze({
    DAYS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Arranged'],
    QUARTERS: ['Fall', 'Winter', 'Spring', 'Summer'],
    MODALITY_ICONS: Object.freeze({ 'in-person': '🏫', 'online': '💻', 'hybrid': '🔄' }),
    STORAGE_KEY: 'workloadSchedulerData',
    DEFAULT_COLOR: '#3498db',
    DEFAULT_SCHEDULE: 'Default Schedule'
});

const DataStore = {
    data: {
        programs: [],                 // GLOBAL — shared across all schedules
        courseCatalog: [],            // GLOBAL — shared across all schedules
        instructors: [],              // GLOBAL — shared across all schedules
        schedules: {},
        currentSchedule: Config.DEFAULT_SCHEDULE,
        collapsedSections: {},
        instructorFilter: [],
        programFilter: ''
    },

    /** Create a blank per-schedule data object */
    createEmptySchedule(quarter) {
        return {
            quarter: quarter || '',
            courseInstructors: {},
            classrooms: [],
            schedule: {}
        };
    },

    /** Get the current schedule's data, auto-initializing if missing */
    getCurrentSchedule() {
        const d = this.data;
        if (!d.schedules[d.currentSchedule]) {
            d.schedules[d.currentSchedule] = this.createEmptySchedule();
        }
        const sd = d.schedules[d.currentSchedule];
        if (!sd.courseInstructors) sd.courseInstructors = {};
        if (!sd.classrooms) sd.classrooms = [];
        if (!sd.schedule) sd.schedule = {};
        if (sd.quarter === undefined) sd.quarter = '';
        return sd;
    },

    /** Persist to localStorage */
    save() {
        localStorage.setItem(Config.STORAGE_KEY, JSON.stringify(this.data));
    },

    /** Load from localStorage with multi-version migration */
    load() {
        const saved = localStorage.getItem(Config.STORAGE_KEY);
        if (!saved) return;

        try {
            const loaded = JSON.parse(saved);
            const d = this.data;

            // ── Detect format and populate base data ──
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
                console.warn('Unrecognized data format, initializing with default schedule');
                return;
            }

            // ── Migrate per-schedule instructors to global ──
            if (loaded.instructors && Array.isArray(loaded.instructors)) {
                // Already has global instructors (new format)
                d.instructors = loaded.instructors;
            } else {
                // Merge from per-schedule data and deduplicate by ID
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

            // ── Ensure global defaults ──
            if (!d.programs) d.programs = [];
            if (!d.courseCatalog) d.courseCatalog = [];
            if (!d.instructors) d.instructors = [];
            if (!d.collapsedSections) d.collapsedSections = {};
            if (!d.instructorFilter) d.instructorFilter = [];
            if (!d.schedules) d.schedules = {};
            if (!d.currentSchedule) d.currentSchedule = Config.DEFAULT_SCHEDULE;
            if (d.programFilter === undefined) d.programFilter = '';

            // ── Ensure currentSchedule exists ──
            if (!d.schedules[d.currentSchedule]) {
                const first = Object.keys(d.schedules)[0];
                if (first) {
                    d.currentSchedule = first;
                } else {
                    d.schedules[Config.DEFAULT_SCHEDULE] = this.createEmptySchedule();
                    d.currentSchedule = Config.DEFAULT_SCHEDULE;
                }
            }

            // ── Ensure catalog entries have all fields ──
            d.courseCatalog.forEach(course => {
                if (!course.programId) course.programId = null;
                if (!course.courseNumber) course.courseNumber = '';
                if (!course.quartersOffered) course.quartersOffered = [];
            });

            // ── Per-schedule migrations ──
            Object.values(d.schedules).forEach(sd => {
                this._migrateScheduleData(sd);
            });

            // ── Ensure instructors have colors ──
            d.instructors.forEach(instr => {
                if (!instr.color) instr.color = Config.DEFAULT_COLOR;
            });

            this.save();
        } catch (e) {
            console.error('Error loading data:', e);
        }
    },

    /** Migrate old per-schedule courses arrays into global catalog */
    _migrateLegacyCoursesToCatalog() {
        const d = this.data;
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
                    if (course.instructorId) {
                        sd.courseInstructors[course.id] = course.instructorId;
                    }
                });
                delete sd.courses;
            }
            if (!sd.quarter) sd.quarter = '';
            if (!sd.courseInstructors) sd.courseInstructors = {};
        });
        d.courseCatalog = Object.values(courseMap);
    },

    /** Migrate old single-schedule format to multi-schedule */
    _migrateSingleSchedule(loaded) {
        const d = this.data;
        const courses = loaded.courses || [];
        const courseInstructors = {};
        courses.forEach(course => {
            const { instructorId, ...catalogCourse } = course;
            catalogCourse.programId = null;
            catalogCourse.courseNumber = '';
            catalogCourse.quartersOffered = [];
            d.courseCatalog.push(catalogCourse);
            if (instructorId) {
                courseInstructors[course.id] = instructorId;
            }
        });
        d.schedules = {
            [Config.DEFAULT_SCHEDULE]: {
                quarter: '',
                instructors: loaded.instructors || [],
                courseInstructors: courseInstructors,
                classrooms: loaded.classrooms || [],
                schedule: loaded.schedule || {}
            }
        };
        d.currentSchedule = Config.DEFAULT_SCHEDULE;
    },

    /** Migrate per-schedule data structures to current format */
    _migrateScheduleData(sd) {
        if (!sd.courseInstructors) sd.courseInstructors = {};
        if (!sd.classrooms) sd.classrooms = [];
        if (!sd.schedule) sd.schedule = {};
        if (sd.quarter === undefined) sd.quarter = '';

        // Remove already-migrated instructors from schedule data
        delete sd.instructors;

        // Old courses array → catalog
        if (sd.courses) {
            if (!sd.courseInstructors) sd.courseInstructors = {};
            sd.courses.forEach(course => {
                if (course.instructorId) {
                    sd.courseInstructors[course.id] = course.instructorId;
                }
                if (!this.data.courseCatalog.find(c => c.id === course.id)) {
                    const { instructorId, ...catalogCourse } = course;
                    catalogCourse.programId = null;
                    catalogCourse.courseNumber = '';
                    catalogCourse.quartersOffered = [];
                    this.data.courseCatalog.push(catalogCourse);
                }
            });
            delete sd.courses;
        }

        // Classroom data migration
        (sd.classrooms || []).forEach(classroom => {
            // Array timeslots → per-day timeslots
            if (Array.isArray(classroom.timeslots)) {
                const old = [...classroom.timeslots];
                classroom.timeslots = {};
                Config.DAYS.forEach(day => { classroom.timeslots[day] = [...old]; });
            }
            if (!classroom.timeslots || typeof classroom.timeslots !== 'object') {
                classroom.timeslots = {};
            }
            Config.DAYS.forEach(day => {
                if (!classroom.timeslots[day]) classroom.timeslots[day] = [];
            });
            if (classroom.timeslotFormExpanded === undefined) {
                classroom.timeslotFormExpanded = true;
            }

            // Ensure schedule grid exists for classroom
            if (!sd.schedule[classroom.id]) {
                sd.schedule[classroom.id] = {};
                Config.DAYS.forEach(day => { sd.schedule[classroom.id][day] = {}; });
            }

            // Migrate old schedule formats
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
                            value.forEach(item => {
                                if (item && item.section === undefined) item.section = '';
                            });
                        }
                    });
                }
            });
        });
    }
};

// Initialize default schedule
DataStore.data.schedules[Config.DEFAULT_SCHEDULE] = DataStore.createEmptySchedule();

// Backward-compatible accessors: data.classrooms and data.schedule
// delegate to the current schedule (non-enumerable so JSON.stringify ignores them)
Object.defineProperties(DataStore.data, {
    classrooms: {
        get() { return DataStore.getCurrentSchedule().classrooms; },
        set(v) { DataStore.getCurrentSchedule().classrooms = v; },
        configurable: true
    },
    schedule: {
        get() { return DataStore.getCurrentSchedule().schedule; },
        set(v) { DataStore.getCurrentSchedule().schedule = v; },
        configurable: true
    }
});

// Convenience alias
const appData = DataStore.data;

const Helpers = {
    /** Build courseInstructors key for a (courseId, section) pair */
    getCourseInstructorKey(courseId, section) {
        return section ? `${courseId}::${section}` : courseId;
    },

    /** Get display name: "PROGRAM NUMBER - Name" or fallback */
    getCourseDisplayName(course) {
        if (!course) return 'Unknown';
        const program = appData.programs.find(p => p.id === course.programId);
        const prefix = program
            ? `${program.name} ${course.courseNumber || ''}`.trim()
            : (course.courseNumber || '');
        if (prefix && course.name) return `${prefix} - ${course.name}`;
        if (prefix) return prefix;
        return course.name || 'Unnamed Course';
    },

    /** Get catalog course merged with instructor from current schedule */
    getCourseWithInstructor(courseId, section) {
        const course = appData.courseCatalog.find(c => c.id === courseId);
        if (!course) return null;
        const sd = DataStore.getCurrentSchedule();
        const key = this.getCourseInstructorKey(courseId, section);
        return { ...course, instructorId: sd.courseInstructors[key] || null };
    }
};

const ScheduleManager = {
    renderSelector() {
        const select = document.getElementById('scheduleSelect');
        if (!select) return;

        const names = Object.keys(appData.schedules);
        select.innerHTML = names.map(name =>
            `<option value="${name}" ${name === appData.currentSchedule ? 'selected' : ''}>${name}</option>`
        ).join('');

        const quarterSelect = document.getElementById('scheduleQuarter');
        if (quarterSelect) {
            quarterSelect.value = DataStore.getCurrentSchedule().quarter || '';
        }
    },

    switchTo() {
        const select = document.getElementById('scheduleSelect');
        appData.currentSchedule = select.value;
        DataStore.save();
        this.renderSelector();
        Renderer.render();
    },

    create() {
        const name = prompt('Enter name for new schedule:');
        if (!name || !name.trim()) return;

        const scheduleName = name.trim();
        if (appData.schedules[scheduleName]) {
            alert('A schedule with this name already exists.');
            return;
        }

        // Ask for quarter
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
            `Would you like to copy the current schedule "${appData.currentSchedule}" to the new schedule?\n\nClick OK to copy, or Cancel to start with an empty schedule.`
        );

        if (copyExisting) {
            const current = DataStore.getCurrentSchedule();
            appData.schedules[scheduleName] = {
                quarter: quarter,
                courseInstructors: JSON.parse(JSON.stringify(current.courseInstructors || {})),
                classrooms: JSON.parse(JSON.stringify(current.classrooms || [])),
                schedule: JSON.parse(JSON.stringify(current.schedule || {}))
            };
        } else {
            appData.schedules[scheduleName] = DataStore.createEmptySchedule(quarter);
        }

        appData.currentSchedule = scheduleName;
        DataStore.save();
        this.renderSelector();
        Renderer.render();
    },

    rename() {
        const oldName = appData.currentSchedule;
        const newName = prompt('Enter new name for schedule:', oldName);
        if (!newName || !newName.trim() || newName.trim() === oldName) return;

        const scheduleName = newName.trim();
        if (appData.schedules[scheduleName]) {
            alert('A schedule with this name already exists.');
            return;
        }

        appData.schedules[scheduleName] = appData.schedules[oldName];
        delete appData.schedules[oldName];
        appData.currentSchedule = scheduleName;
        DataStore.save();
        this.renderSelector();
        Renderer.render();
    },

    deleteCurrent() {
        if (Object.keys(appData.schedules).length === 1) {
            alert('Cannot delete the last schedule.');
            return;
        }
        if (!confirm(`Delete schedule "${appData.currentSchedule}"?`)) return;

        delete appData.schedules[appData.currentSchedule];
        appData.currentSchedule = Object.keys(appData.schedules)[0];
        DataStore.save();
        this.renderSelector();
        Renderer.render();
    },

    updateQuarter() {
        const quarterSelect = document.getElementById('scheduleQuarter');
        if (quarterSelect) {
            DataStore.getCurrentSchedule().quarter = quarterSelect.value;
            DataStore.save();
            Renderer.renderValidationSummary();
        }
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  UI STATE — Collapsible sections, filters, dropdowns
// ─────────────────────────────────────────────────────────────────────────────

const UIState = {
    toggleSection(sectionName) {
        const section = document.getElementById(`${sectionName}-section`);
        const icon = document.getElementById(`${sectionName}-icon`);
        if (!section || !icon) return;

        const isCollapsed = section.style.display === 'none';
        section.style.display = isCollapsed ? 'block' : 'none';
        icon.textContent = isCollapsed ? '▼' : '▶';

        if (!appData.collapsedSections) appData.collapsedSections = {};
        appData.collapsedSections[sectionName] = !isCollapsed;
        DataStore.save();
    },

    toggleInstructorFilter(e) {
        e.stopPropagation();
        const filterList = document.getElementById('instructorFilterList');
        filterList.style.display = filterList.style.display === 'none' ? 'block' : 'none';
    },

    updateInstructorFilter(instructorId, checked) {
        if (!appData.instructorFilter) appData.instructorFilter = [];
        if (checked) {
            if (!appData.instructorFilter.includes(instructorId)) {
                appData.instructorFilter.push(instructorId);
            }
        } else {
            appData.instructorFilter = appData.instructorFilter.filter(id => id !== instructorId);
        }
        DataStore.save();
        Renderer.renderSchedule();
    },

    updateProgramFilter() {
        const select = document.getElementById('programFilterSelect');
        appData.programFilter = select ? select.value : '';
        DataStore.save();
        Renderer.renderCourses();
    },

    toggleQuartersOffered(event, context) {
        event.stopPropagation();
        event.preventDefault();
        const listId = context === 'edit' ? 'editQuartersOfferedList' : 'quartersOfferedList';
        const list = document.getElementById(listId);
        if (list) {
            list.style.display = list.style.display === 'none' ? 'block' : 'none';
        }
    },

    getQuartersOfferedFromCheckboxes(context) {
        const prefix = context === 'edit' ? 'qo-edit-' : 'qo-add-';
        const quarters = [];
        Config.QUARTERS.forEach(q => {
            const cb = document.getElementById(prefix + q.toLowerCase());
            if (cb && cb.checked) quarters.push(q);
        });
        return quarters;
    },

    setQuartersOfferedCheckboxes(context, quartersOffered) {
        const prefix = context === 'edit' ? 'qo-edit-' : 'qo-add-';
        Config.QUARTERS.forEach(q => {
            const cb = document.getElementById(prefix + q.toLowerCase());
            if (cb) cb.checked = (quartersOffered || []).includes(q);
        });
    },

    restoreCollapsedSections() {
        if (!appData.collapsedSections) return;
        Object.keys(appData.collapsedSections).forEach(sectionName => {
            const isCollapsed = appData.collapsedSections[sectionName];
            const section = document.getElementById(`${sectionName}-section`);
            const icon = document.getElementById(`${sectionName}-icon`);
            if (section && icon) {
                section.style.display = isCollapsed ? 'none' : 'block';
                icon.textContent = isCollapsed ? '▶' : '▼';
            }
        });
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  PROGRAM MANAGER — Program CRUD
// ─────────────────────────────────────────────────────────────────────────────

const ProgramManager = {
    add() {
        const nameInput = document.getElementById('programName');
        const name = nameInput.value.trim();
        if (!name) return;

        appData.programs.push({ id: Date.now().toString(), name });
        nameInput.value = '';
        DataStore.save();
        Renderer.render();
    },

    remove(id) {
        const hasCourses = appData.courseCatalog.some(c => c.programId === id);
        if (hasCourses) {
            alert('Cannot delete program with assigned courses. Reassign or delete the courses first.');
            return;
        }
        appData.programs = appData.programs.filter(p => p.id !== id);
        DataStore.save();
        Renderer.render();
    },

    showEditPrompt(id) {
        const program = appData.programs.find(p => p.id === id);
        if (!program) return;
        const newName = prompt('Enter new name for program:', program.name);
        if (newName && newName.trim()) {
            program.name = newName.trim();
            DataStore.save();
            Renderer.render();
        }
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  INSTRUCTOR MANAGER — Instructor CRUD and workload
// ─────────────────────────────────────────────────────────────────────────────

const InstructorManager = {
    add() {
        const nameInput = document.getElementById('instructorName');
        const name = nameInput.value.trim();
        if (!name) return;

        appData.instructors.push({
            id: Date.now().toString(),
            name,
            color: Config.DEFAULT_COLOR
        });
        nameInput.value = '';
        DataStore.save();
        Renderer.render();
    },

    remove(id) {
        // Check ALL schedules for assignments (instructors are global)
        for (const [scheduleName, sd] of Object.entries(appData.schedules)) {
            if (sd.courseInstructors) {
                const hasAssignments = Object.values(sd.courseInstructors).some(iId => iId === id);
                if (hasAssignments) {
                    alert(`Cannot delete instructor with assigned courses in schedule "${scheduleName}". Unassign them first.`);
                    return;
                }
            }
        }
        appData.instructors = appData.instructors.filter(i => i.id !== id);
        DataStore.save();
        Renderer.render();
    },

    /** Calculate total scheduled credits for an instructor in the current schedule */
    getWorkload(instructorId) {
        const sd = DataStore.getCurrentSchedule();
        // Collect all scheduled (courseId, section) pairs
        const scheduledPairs = new Set();
        for (const classroomId in appData.schedule) {
            for (const day in appData.schedule[classroomId]) {
                for (const time in appData.schedule[classroomId][day]) {
                    const slotData = appData.schedule[classroomId][day][time];
                    const items = Array.isArray(slotData) ? slotData : (slotData ? [slotData] : []);
                    items.forEach(item => {
                        scheduledPairs.add(Helpers.getCourseInstructorKey(item.courseId, item.section));
                    });
                }
            }
        }
        // Sum credits for unique (courseId, section) assigned to this instructor
        let total = 0;
        scheduledPairs.forEach(key => {
            if (sd.courseInstructors[key] === instructorId) {
                const courseId = key.includes('::') ? key.split('::')[0] : key;
                const course = appData.courseCatalog.find(c => c.id === courseId);
                if (course) total += course.credits;
            }
        });
        return total;
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  COURSE MANAGER — Course catalog CRUD and scheduling queries
// ─────────────────────────────────────────────────────────────────────────────

const CourseManager = {
    add() {
        const programSelect = document.getElementById('courseProgram');
        const numberInput = document.getElementById('courseNumber');
        const nameInput = document.getElementById('courseName');
        const creditsInput = document.getElementById('courseCredits');
        const quarterInput = document.getElementById('courseQuarterTaken');

        const credits = parseInt(creditsInput.value);
        if (!credits) return;

        const quartersOffered = UIState.getQuartersOfferedFromCheckboxes('add');

        appData.courseCatalog.push({
            id: Date.now().toString(),
            name: nameInput.value.trim() || '',
            credits,
            programId: programSelect.value || null,
            courseNumber: numberInput.value.trim() || '',
            quarterTaken: (quarterInput ? quarterInput.value.trim() : '') || null,
            quartersOffered
        });

        nameInput.value = '';
        creditsInput.value = '';
        if (numberInput) numberInput.value = '';
        if (programSelect) programSelect.value = '';
        if (quarterInput) quarterInput.value = '';
        UIState.setQuartersOfferedCheckboxes('add', []);
        DataStore.save();
        Renderer.render();
    },

    remove(id) {
        // Remove from schedule grid in ALL schedules
        Object.keys(appData.schedules).forEach(scheduleName => {
            const sd = appData.schedules[scheduleName];
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

        appData.courseCatalog = appData.courseCatalog.filter(c => c.id !== id);
        DataStore.save();
        Renderer.render();
    },

    /** Check if a course is scheduled anywhere in the current schedule */
    isScheduled(courseId) {
        for (const classroomId in appData.schedule) {
            for (const day in appData.schedule[classroomId]) {
                for (const time in appData.schedule[classroomId][day]) {
                    const slotData = appData.schedule[classroomId][day][time];
                    if (Array.isArray(slotData)) {
                        if (slotData.some(item => item.courseId === courseId)) return true;
                    } else if (slotData && slotData.courseId === courseId) {
                        return true;
                    }
                }
            }
        }
        return false;
    },

    /** Check if a timeslot has ≥2 in-person courses (conflict) */
    hasInPersonConflict(day, timeslot) {
        let count = 0;
        for (const classroomId in appData.schedule) {
            const slotData = appData.schedule[classroomId]?.[day]?.[timeslot];
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
};


// ─────────────────────────────────────────────────────────────────────────────
//  CLASSROOM MANAGER — Classroom CRUD and timeslot management
// ─────────────────────────────────────────────────────────────────────────────

const ClassroomManager = {
    add() {
        const roomInput = document.getElementById('roomNumber');
        const roomNumber = roomInput.value.trim();
        if (!roomNumber) return;

        const classroom = {
            id: Date.now().toString(),
            roomNumber,
            timeslots: {},
            visible: true,
            timeslotFormExpanded: true
        };
        Config.DAYS.forEach(day => { classroom.timeslots[day] = []; });
        appData.classrooms.push(classroom);

        appData.schedule[classroom.id] = {};
        Config.DAYS.forEach(day => { appData.schedule[classroom.id][day] = {}; });

        roomInput.value = '';
        DataStore.save();
        Renderer.render();
    },

    remove(id) {
        appData.classrooms = appData.classrooms.filter(c => c.id !== id);
        delete appData.schedule[id];
        DataStore.save();
        Renderer.render();
    },

    toggle(id) {
        const classroom = appData.classrooms.find(c => c.id === id);
        if (classroom) {
            classroom.visible = !classroom.visible;
            DataStore.save();
            Renderer.render();
        }
    },

    toggleForm(classroomId) {
        const classroom = appData.classrooms.find(c => c.id === classroomId);
        if (classroom) {
            if (classroom.timeslotFormExpanded === undefined) classroom.timeslotFormExpanded = true;
            classroom.timeslotFormExpanded = !classroom.timeslotFormExpanded;
            DataStore.save();
            Renderer.render();
        }
    },

    addTimeslot(classroomId, day, startTime, endTime) {
        const classroom = appData.classrooms.find(c => c.id === classroomId);
        if (classroom && startTime && endTime) {
            const timeslot = `${startTime}-${endTime}`;
            if (!classroom.timeslots[day]) classroom.timeslots[day] = [];
            if (!classroom.timeslots[day].includes(timeslot)) {
                classroom.timeslots[day].push(timeslot);
                classroom.timeslots[day].sort();
                DataStore.save();
                Renderer.render();
            }
        }
    },

    removeTimeslot(classroomId, day, timeslot) {
        const classroom = appData.classrooms.find(c => c.id === classroomId);
        if (!classroom) return;

        if (appData.schedule[classroomId][day] && appData.schedule[classroomId][day][timeslot]) {
            delete appData.schedule[classroomId][day][timeslot];
        }
        if (classroom.timeslots[day]) {
            classroom.timeslots[day] = classroom.timeslots[day].filter(t => t !== timeslot);
        }
        DataStore.save();
        Renderer.render();
    },

    copyTimeslotsToAllDays(classroomId, sourceDay) {
        const classroom = appData.classrooms.find(c => c.id === classroomId);
        if (classroom && classroom.timeslots[sourceDay]) {
            const timeslots = [...classroom.timeslots[sourceDay]];
            Config.DAYS.forEach(day => {
                if (day !== sourceDay) classroom.timeslots[day] = [...timeslots];
            });
            DataStore.save();
            Renderer.render();
        }
    },

    addTimeslotFromForm(classroomId, day) {
        const startTimeInput = document.getElementById(`startTime-${classroomId}-${day}`);
        const endTimeInput = document.getElementById(`endTime-${classroomId}-${day}`);
        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;

        if (startTime && endTime) {
            if (startTime >= endTime) {
                alert('End time must be after start time');
                return;
            }
            this.addTimeslot(classroomId, day, startTime, endTime);
            startTimeInput.value = '';
            endTimeInput.value = '';
        }
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  SCHEDULE GRID — Course placement and removal on the grid
// ─────────────────────────────────────────────────────────────────────────────

const ScheduleGrid = {
    schedule(classroomId, day, time, courseId, modality, section) {
        if (!appData.schedule[classroomId]) appData.schedule[classroomId] = {};
        if (!appData.schedule[classroomId][day]) appData.schedule[classroomId][day] = {};
        if (!appData.schedule[classroomId][day][time]) appData.schedule[classroomId][day][time] = [];

        appData.schedule[classroomId][day][time].push({
            courseId,
            modality: modality || 'in-person',
            section: section || ''
        });
        DataStore.save();
        Renderer.render();
    },

    unschedule(classroomId, day, time, courseIndex) {
        if (!appData.schedule[classroomId]?.[day]?.[time]) return;

        if (courseIndex !== undefined) {
            appData.schedule[classroomId][day][time].splice(courseIndex, 1);
            if (appData.schedule[classroomId][day][time].length === 0) {
                delete appData.schedule[classroomId][day][time];
            }
        } else {
            delete appData.schedule[classroomId][day][time];
        }
        DataStore.save();
        Renderer.render();
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  DRAG & DROP — Course drag and drop between sidebar and grid
// ─────────────────────────────────────────────────────────────────────────────

const DragDrop = {
    _pendingDrop: null,

    handleStart(e, courseId) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('courseId', courseId);
        e.target.classList.add('dragging');

        const src = e.target.dataset;
        if (src.sourceClassroomId && src.sourceDay && src.sourceTimeslot) {
            e.dataTransfer.setData('sourceClassroomId', src.sourceClassroomId);
            e.dataTransfer.setData('sourceDay', src.sourceDay);
            e.dataTransfer.setData('sourceTimeslot', src.sourceTimeslot);
            e.dataTransfer.setData('sourceCourseIndex', src.sourceCourseIndex || '');
            e.dataTransfer.setData('sourceSection', src.sourceSection || '');
        }
    },

    handleEnd(e) {
        e.target.classList.remove('dragging');
    },

    handleOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over');
    },

    handleLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    },

    handleDrop(e, classroomId, day, time) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');

        const courseId = e.dataTransfer.getData('courseId');
        if (!courseId) return;

        const sourceClassroomId = e.dataTransfer.getData('sourceClassroomId');
        const sourceDay = e.dataTransfer.getData('sourceDay');
        const sourceTimeslot = e.dataTransfer.getData('sourceTimeslot');
        const sourceCourseIndex = e.dataTransfer.getData('sourceCourseIndex');

        if (sourceClassroomId && sourceDay && sourceTimeslot) {
            // Moving from one slot to another
            const sourceSlot = appData.schedule[sourceClassroomId]?.[sourceDay]?.[sourceTimeslot];
            let modality = 'in-person';
            let section = e.dataTransfer.getData('sourceSection') || '';

            if (Array.isArray(sourceSlot) && sourceCourseIndex !== '') {
                const srcItem = sourceSlot[parseInt(sourceCourseIndex)];
                modality = srcItem?.modality || 'in-person';
                section = srcItem?.section || section;
            } else if (sourceSlot && !Array.isArray(sourceSlot)) {
                modality = sourceSlot.modality || 'in-person';
                section = sourceSlot.section || section;
            }

            const isSameSlot = sourceClassroomId === classroomId && sourceDay === day && sourceTimeslot === time;
            if (!isSameSlot) {
                ScheduleGrid.schedule(classroomId, day, time, courseId, modality, section);
                ScheduleGrid.unschedule(sourceClassroomId, sourceDay, sourceTimeslot,
                    sourceCourseIndex !== '' ? parseInt(sourceCourseIndex) : 0);
            }
        } else {
            // New drop from sidebar — show modality modal
            this._pendingDrop = { classroomId, day, time, courseId };
            Modals.showModality();
        }
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  MODALS — Modal dialog management
// ─────────────────────────────────────────────────────────────────────────────

const Modals = {
    // ── Modality Modal ──
    showModality() {
        document.getElementById('modalityModal').style.display = 'block';
    },

    selectModality(modality) {
        if (DragDrop._pendingDrop) {
            const sectionInput = document.getElementById('modalitySectionInput');
            const section = sectionInput ? sectionInput.value.trim() : '';
            const drop = DragDrop._pendingDrop;
            ScheduleGrid.schedule(drop.classroomId, drop.day, drop.time, drop.courseId, modality, section);
            DragDrop._pendingDrop = null;
        }
        this.closeModality();
    },

    closeModality() {
        document.getElementById('modalityModal').style.display = 'none';
        const sectionInput = document.getElementById('modalitySectionInput');
        if (sectionInput) sectionInput.value = '';
        DragDrop._pendingDrop = null;
    },

    // ── Help Modal ──
    showHelp() {
        document.getElementById('helpModal').style.display = 'block';
    },

    closeHelp() {
        document.getElementById('helpModal').style.display = 'none';
    },

    closeHelpOnOutsideClick(event) {
        if (event.target === document.getElementById('helpModal')) {
            this.closeHelp();
        }
    },

    // ── Course Edit Modal ──
    showCourse(courseId, classroomId, day, timeslot, courseIndex) {
        const course = appData.courseCatalog.find(c => c.id === courseId);
        if (!course) return;

        const sd = DataStore.getCurrentSchedule();

        // Populate program dropdown
        const programSelect = document.getElementById('editCourseProgram');
        programSelect.innerHTML = '<option value="">Select Program</option>' +
            appData.programs.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        programSelect.value = course.programId || '';

        document.getElementById('editCourseNumber').value = course.courseNumber || '';
        document.getElementById('editCourseName').value = course.name || '';
        document.getElementById('editCourseCredits').value = course.credits;
        const quarterInput = document.getElementById('editCourseQuarterTaken');
        if (quarterInput) quarterInput.value = course.quarterTaken || '';

        UIState.setQuartersOfferedCheckboxes('edit', course.quartersOffered || []);

        // Show modality field
        const modalityGroup = document.getElementById('editModality').closest('.form-group');
        if (modalityGroup) modalityGroup.style.display = 'block';

        // Get current modality and section from the slot
        const slotData = appData.schedule[classroomId]?.[day]?.[timeslot];
        let currentModality = 'in-person';
        let currentSection = '';
        if (Array.isArray(slotData) && courseIndex !== undefined) {
            currentModality = slotData[courseIndex]?.modality || 'in-person';
            currentSection = slotData[courseIndex]?.section || '';
        } else if (slotData && !Array.isArray(slotData)) {
            currentModality = slotData.modality || 'in-person';
            currentSection = slotData.section || '';
        }
        document.getElementById('editModality').value = currentModality;

        // Show and populate section field
        const sectionGroup = document.getElementById('editCourseSection')?.closest('.form-group');
        if (sectionGroup) sectionGroup.style.display = 'block';
        const sectionInput = document.getElementById('editCourseSection');
        if (sectionInput) sectionInput.value = currentSection;

        // Instructor dropdown
        const instructorSelect = document.getElementById('editCourseInstructor');
        instructorSelect.innerHTML = '<option value="">Select Instructor (Optional)</option>' +
            appData.instructors.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
        const instrKey = Helpers.getCourseInstructorKey(courseId, currentSection);
        instructorSelect.value = sd.courseInstructors[instrKey] || '';

        const modal = document.getElementById('courseModal');
        modal.style.display = 'block';
        modal.dataset.courseId = courseId;
        modal.dataset.classroomId = classroomId;
        modal.dataset.day = day;
        modal.dataset.timeslot = timeslot;
        modal.dataset.courseIndex = courseIndex !== undefined ? courseIndex : '';
    },

    showCourseFromList(courseId) {
        const course = appData.courseCatalog.find(c => c.id === courseId);
        if (!course) return;

        const sd = DataStore.getCurrentSchedule();

        const programSelect = document.getElementById('editCourseProgram');
        programSelect.innerHTML = '<option value="">Select Program</option>' +
            appData.programs.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        programSelect.value = course.programId || '';

        document.getElementById('editCourseNumber').value = course.courseNumber || '';
        document.getElementById('editCourseName').value = course.name || '';
        document.getElementById('editCourseCredits').value = course.credits;
        const quarterInput = document.getElementById('editCourseQuarterTaken');
        if (quarterInput) quarterInput.value = course.quarterTaken || '';

        UIState.setQuartersOfferedCheckboxes('edit', course.quartersOffered || []);

        // Hide modality and section fields when editing from list
        const modalityGroup = document.getElementById('editModality').closest('.form-group');
        if (modalityGroup) modalityGroup.style.display = 'none';
        const sectionGroup = document.getElementById('editCourseSection')?.closest('.form-group');
        if (sectionGroup) sectionGroup.style.display = 'none';

        const instructorSelect = document.getElementById('editCourseInstructor');
        instructorSelect.innerHTML = '<option value="">Select Instructor (Optional)</option>' +
            appData.instructors.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
        instructorSelect.value = sd.courseInstructors[courseId] || '';

        const modal = document.getElementById('courseModal');
        modal.style.display = 'block';
        modal.dataset.courseId = courseId;
        modal.dataset.classroomId = '';
        modal.dataset.day = '';
        modal.dataset.timeslot = '';
        modal.dataset.courseIndex = '';
    },

    closeCourse() {
        document.getElementById('courseModal').style.display = 'none';
    },

    saveCourseChanges(courseId, name, credits, instructorId, classroomId, day, timeslot, modality, courseIndex, quarterTaken, programId, courseNumber, quartersOffered, section) {
        const course = appData.courseCatalog.find(c => c.id === courseId);
        if (!course) return;

        // Update catalog properties
        course.name = name || '';
        course.credits = parseInt(credits);
        course.quarterTaken = quarterTaken || null;
        course.programId = programId || null;
        course.courseNumber = courseNumber || '';
        course.quartersOffered = quartersOffered || [];

        const currentSection = section || '';

        // Update instructor assignment
        const sd = DataStore.getCurrentSchedule();
        const instrKey = Helpers.getCourseInstructorKey(courseId, currentSection);
        if (instructorId) {
            sd.courseInstructors[instrKey] = instructorId;
        } else {
            delete sd.courseInstructors[instrKey];
        }

        // Update modality and section for the scheduled slot
        if (classroomId && day && timeslot) {
            const slotData = appData.schedule[classroomId]?.[day]?.[timeslot];
            if (Array.isArray(slotData) && courseIndex !== undefined && courseIndex !== '') {
                const idx = parseInt(courseIndex);
                if (modality) slotData[idx].modality = modality;
                slotData[idx].section = currentSection;
            } else if (slotData && !Array.isArray(slotData)) {
                if (modality) slotData.modality = modality;
                slotData.section = currentSection;
            }
        }

        DataStore.save();
        Renderer.render();
        this.closeCourse();
    },

    // ── Instructor Edit Modal ──
    showInstructor(instructorId) {
        const instructor = appData.instructors.find(i => i.id === instructorId);
        if (!instructor) return;

        document.getElementById('editInstructorName').value = instructor.name;
        document.getElementById('editInstructorColor').value = instructor.color || Config.DEFAULT_COLOR;

        const modal = document.getElementById('instructorModal');
        modal.style.display = 'block';
        modal.dataset.instructorId = instructorId;
    },

    closeInstructor() {
        document.getElementById('instructorModal').style.display = 'none';
    },

    saveInstructorChanges(instructorId, name, color) {
        const instructor = appData.instructors.find(i => i.id === instructorId);
        if (instructor) {
            instructor.name = name;
            instructor.color = color || Config.DEFAULT_COLOR;
            DataStore.save();
            Renderer.render();
            this.closeInstructor();
        }
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  VALIDATION — Schedule conflict detection
// ─────────────────────────────────────────────────────────────────────────────

const Validation = {
    toggle() {
        const errorsDiv = document.getElementById('validationErrors');
        const icon = document.getElementById('validation-collapse-icon');
        if (!errorsDiv || !icon) return;

        const isCollapsed = errorsDiv.classList.toggle('collapsed');
        icon.textContent = isCollapsed ? '▶' : '▼';
    },

    /** Run all validation rules and return an array of error objects */
    validate() {
        const errors = [];
        const sd = DataStore.getCurrentSchedule();
        const scheduleQuarter = sd.quarter;

        // Build map of all scheduled entries by timeslot
        const timeslotMap = {};
        const scheduledCourseIds = new Set();

        for (const classroomId in appData.schedule) {
            const classroom = appData.classrooms.find(c => c.id === classroomId);
            const roomNumber = classroom ? classroom.roomNumber : 'Unknown';

            for (const day in appData.schedule[classroomId]) {
                for (const time in appData.schedule[classroomId][day]) {
                    const slotData = appData.schedule[classroomId][day][time];
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
                            section: item.section || ''
                        });
                    });
                }
            }
        }

        // ── Instructor conflicts ──
        this._checkInstructorConflicts(timeslotMap, sd, errors);

        // ── Cohort/quarter conflicts ──
        this._checkCohortConflicts(timeslotMap, errors);

        // ── Missing program ──
        scheduledCourseIds.forEach(courseId => {
            const course = appData.courseCatalog.find(c => c.id === courseId);
            if (course && !course.programId) {
                errors.push({
                    type: 'program',
                    message: `<strong>${Helpers.getCourseDisplayName(course)}</strong> is not assigned to a program`
                });
            }
        });

        // ── Quarter availability ──
        if (scheduleQuarter) {
            scheduledCourseIds.forEach(courseId => {
                const course = appData.courseCatalog.find(c => c.id === courseId);
                if (course && course.quartersOffered && course.quartersOffered.length > 0) {
                    if (!course.quartersOffered.includes(scheduleQuarter)) {
                        errors.push({
                            type: 'quarter',
                            message: `<strong>${Helpers.getCourseDisplayName(course)}</strong> is not offered in <strong>${scheduleQuarter}</strong> quarter (offered: ${course.quartersOffered.join(', ')})`
                        });
                    }
                }
            });
        }

        // ── Missing quarter ──
        if (!scheduleQuarter) {
            errors.push({
                type: 'quarter',
                message: `<strong>Schedule "${appData.currentSchedule}"</strong> does not have a quarter assigned. Please select a quarter.`
            });
        }

        return errors;
    },

    _checkInstructorConflicts(timeslotMap, sd, errors) {
        for (const key in timeslotMap) {
            const entries = timeslotMap[key];
            const [day, time] = key.split('|');

            const instructorGroups = {};
            entries.forEach(entry => {
                const course = appData.courseCatalog.find(c => c.id === entry.courseId);
                const instrKey = Helpers.getCourseInstructorKey(entry.courseId, entry.section);
                const instructorId = sd.courseInstructors[instrKey] || null;
                if (course && instructorId) {
                    if (!instructorGroups[instructorId]) instructorGroups[instructorId] = [];
                    const sectionSuffix = entry.section ? ` \u00a7${entry.section}` : '';
                    instructorGroups[instructorId].push({
                        ...entry,
                        courseName: Helpers.getCourseDisplayName(course) + sectionSuffix
                    });
                }
            });

            for (const instructorId in instructorGroups) {
                const group = instructorGroups[instructorId];
                const uniquePairs = [...new Set(group.map(g => Helpers.getCourseInstructorKey(g.courseId, g.section)))];
                if (uniquePairs.length > 1) {
                    const instructor = appData.instructors.find(i => i.id === instructorId);
                    const instructorName = instructor ? instructor.name : 'Unknown';
                    const courseNames = group.map(g => `${g.courseName} (Room ${g.roomNumber})`).join(', ');
                    errors.push({
                        type: 'instructor',
                        message: `<strong>${instructorName}</strong> is scheduled for multiple classes on <strong>${day} ${time}</strong>: ${courseNames}`
                    });
                }
            }
        }
    },

    _checkCohortConflicts(timeslotMap, errors) {
        for (const key in timeslotMap) {
            const entries = timeslotMap[key];
            const [day, time] = key.split('|');

            const quarterGroups = {};
            entries.forEach(entry => {
                const course = appData.courseCatalog.find(c => c.id === entry.courseId);
                if (course && course.quarterTaken) {
                    const qKey = course.quarterTaken.trim().toUpperCase();
                    if (!quarterGroups[qKey]) quarterGroups[qKey] = [];
                    quarterGroups[qKey].push({
                        ...entry,
                        courseName: Helpers.getCourseDisplayName(course),
                        quarterTaken: course.quarterTaken
                    });
                }
            });

            for (const quarter in quarterGroups) {
                const group = quarterGroups[quarter];
                const uniqueCourseIds = [...new Set(group.map(g => g.courseId))];
                if (uniqueCourseIds.length > 1) {
                    const courseNames = group.map(g => `${g.courseName} (Room ${g.roomNumber})`).join(', ');
                    errors.push({
                        type: 'cohort',
                        message: `<strong>Cohort ${group[0].quarterTaken}</strong> has multiple classes on <strong>${day} ${time}</strong>: ${courseNames}`
                    });
                }
            }
        }
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  RENDERER — All UI rendering
//  Internal helpers prefixed with _
// ─────────────────────────────────────────────────────────────────────────────

const Renderer = {
    render() {
        this.renderPrograms();
        this.renderInstructors();
        this.renderCourses();
        this.renderSchedule();
        this.renderValidationSummary();
        UIState.restoreCollapsedSections();
    },

    // ── Programs ──
    renderPrograms() {
        const container = document.getElementById('programsList');
        if (!container) return;

        if (appData.programs.length === 0) {
            container.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">No programs added yet</p>';
            return;
        }

        container.innerHTML = appData.programs.map(program => {
            const courseCount = appData.courseCatalog.filter(c => c.programId === program.id).length;
            return `
                <div class="program-item" ondblclick="ProgramManager.showEditPrompt('${program.id}')" style="cursor: pointer;">
                    <div>
                        <div class="program-name">${program.name}</div>
                        <div class="program-meta">${courseCount} course${courseCount !== 1 ? 's' : ''}</div>
                    </div>
                    <button class="delete-btn" onclick="event.stopPropagation(); ProgramManager.remove('${program.id}')">Delete</button>
                </div>
            `;
        }).join('');
    },

    // ── Instructors ──
    renderInstructors() {
        const container = document.getElementById('instructorsList');

        if (appData.instructors.length === 0) {
            container.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">No instructors added yet</p>';
            const filterList = document.getElementById('instructorFilterList');
            if (filterList) filterList.innerHTML = '<p style="padding: 10px; color: #7f8c8d;">No instructors</p>';
            return;
        }

        container.innerHTML = appData.instructors.map(instructor => {
            const workload = InstructorManager.getWorkload(instructor.id);
            const color = instructor.color || Config.DEFAULT_COLOR;
            return `
                <div class="instructor-item" ondblclick="Modals.showInstructor('${instructor.id}')" style="cursor: pointer; border-left: 4px solid ${color};">
                    <div>
                        <div>${instructor.name}</div>
                        <div class="workload">${workload} credits</div>
                    </div>
                    <button class="delete-btn" onclick="event.stopPropagation(); InstructorManager.remove('${instructor.id}')">Delete</button>
                </div>
            `;
        }).join('');

        // Render filter checkboxes
        const filterList = document.getElementById('instructorFilterList');
        if (filterList) {
            if (!appData.instructorFilter) appData.instructorFilter = [];
            filterList.innerHTML = appData.instructors.map(instructor => {
                const checked = appData.instructorFilter.includes(instructor.id);
                const color = instructor.color || Config.DEFAULT_COLOR;
                return `
                    <label class="filter-checkbox">
                        <input type="checkbox" ${checked ? 'checked' : ''}
                               onchange="UIState.updateInstructorFilter('${instructor.id}', this.checked)">
                        <span class="color-indicator" style="background: ${color};"></span>
                        <span>${instructor.name}</span>
                    </label>
                `;
            }).join('');
        }
    },

    // ── Courses ──
    renderCourses() {
        const container = document.getElementById('coursesList');
        const programSelect = document.getElementById('courseProgram');

        // Update program dropdown in add form
        if (programSelect) {
            programSelect.innerHTML = '<option value="">Select Program</option>' +
                appData.programs.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        }

        // Update program filter dropdown
        const programFilterSelect = document.getElementById('programFilterSelect');
        if (programFilterSelect) {
            const currentFilter = appData.programFilter || '';
            programFilterSelect.innerHTML = '<option value="">All Programs</option>' +
                appData.programs.map(p =>
                    `<option value="${p.id}" ${p.id === currentFilter ? 'selected' : ''}>${p.name}</option>`
                ).join('');
        }

        // Filter courses by program
        let displayCourses = appData.courseCatalog;
        if (appData.programFilter) {
            displayCourses = displayCourses.filter(c => c.programId === appData.programFilter);
        }

        if (displayCourses.length === 0) {
            container.innerHTML = appData.courseCatalog.length === 0
                ? '<p style="color: #7f8c8d; font-size: 14px;">No courses added yet</p>'
                : '<p style="color: #7f8c8d; font-size: 14px;">No courses match the selected filter</p>';
            return;
        }

        const sd = DataStore.getCurrentSchedule();

        container.innerHTML = displayCourses.map(course => {
            const instructorId = sd.courseInstructors[course.id] || null;
            const instructor = instructorId ? appData.instructors.find(i => i.id === instructorId) : null;
            const isScheduled = CourseManager.isScheduled(course.id);
            const statusClass = isScheduled ? 'course-scheduled' : 'course-unscheduled';
            const quarterLabel = course.quarterTaken ? ` • ${course.quarterTaken}` : '';
            const displayName = Helpers.getCourseDisplayName(course);
            const hasNoProgram = !course.programId;
            const quartersStr = (course.quartersOffered && course.quartersOffered.length > 0)
                ? ` • ${course.quartersOffered.join(', ')}` : '';
            return `
                <div class="course-item ${statusClass} ${hasNoProgram ? 'course-no-program' : ''}" draggable="true"
                     ondragstart="DragDrop.handleStart(event, '${course.id}')"
                     ondragend="DragDrop.handleEnd(event)"
                     ondblclick="Modals.showCourseFromList('${course.id}')">
                    <div class="course-info">
                        <div class="course-name">${displayName}${hasNoProgram ? ' <span class="no-program-badge" title="No program assigned">⚠️</span>' : ''}</div>
                        <div class="course-meta">${course.credits} credits${instructor ? ' • ' + instructor.name : ''}${quarterLabel}${quartersStr}</div>
                    </div>
                    <button class="delete-btn" onclick="event.stopPropagation(); CourseManager.remove('${course.id}')">Delete</button>
                </div>
            `;
        }).join('');
    },

    // ── Validation Summary ──
    renderValidationSummary() {
        const errors = Validation.validate();
        const summaryDiv = document.getElementById('validationSummary');
        const errorsDiv = document.getElementById('validationErrors');
        const countSpan = document.getElementById('validationCount');
        if (!summaryDiv || !errorsDiv || !countSpan) return;

        if (errors.length === 0) {
            summaryDiv.style.display = 'none';
            return;
        }

        summaryDiv.style.display = 'block';
        countSpan.textContent = errors.length;

        const typeConfig = {
            instructor: { cls: 'instructor-conflict', icon: '👨‍🏫' },
            cohort:     { cls: 'cohort-conflict',     icon: '🎓' },
            program:    { cls: 'program-conflict',    icon: '📂' },
            quarter:    { cls: 'quarter-conflict',    icon: '📅' }
        };

        errorsDiv.innerHTML = errors.map(err => {
            const cfg = typeConfig[err.type] || { cls: '', icon: '⚠️' };
            return `
                <div class="validation-error-item ${cfg.cls}">
                    <span class="validation-error-icon">${cfg.icon}</span>
                    <span class="validation-error-text">${err.message}</span>
                </div>
            `;
        }).join('');
    },

    // ── Schedule Grid ──
    renderSchedule() {
        const container = document.getElementById('scheduleGrid');

        if (appData.classrooms.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No classrooms added yet</p></div>';
            return;
        }

        container.innerHTML = appData.classrooms.map(classroom =>
            this._renderClassroom(classroom)
        ).join('');
    },

    /** Render a single classroom container */
    _renderClassroom(classroom) {
        const allTimeslots = new Set();
        Config.DAYS.filter(d => d !== 'Arranged').forEach(day => {
            (classroom.timeslots[day] || []).forEach(ts => allTimeslots.add(ts));
        });
        const sortedTimeslots = Array.from(allTimeslots).sort();

        const gridHTML = sortedTimeslots.length > 0
            ? this._renderClassroomGrid(classroom, sortedTimeslots)
            : this._renderClassroomNoTimeslots(classroom);

        const timeslotFormHTML = this._renderTimeslotForm(classroom);

        return `
            <div class="classroom-container">
                <div class="classroom-header">
                    <h3>Room ${classroom.roomNumber}</h3>
                    <div class="classroom-controls">
                        <button class="toggle-btn" onclick="ClassroomManager.toggle('${classroom.id}')">
                            ${classroom.visible ? 'Hide' : 'Show'}
                        </button>
                        <button class="delete-btn" onclick="ClassroomManager.remove('${classroom.id}')">Delete</button>
                    </div>
                </div>
                ${gridHTML}
                ${timeslotFormHTML}
            </div>
        `;
    },

    /** Render the schedule grid for a classroom that has timeslots */
    _renderClassroomGrid(classroom, sortedTimeslots) {
        return `
            <div class="classroom-schedule ${!classroom.visible ? 'hidden' : ''}">
                <div class="day-header"></div>
                ${Config.DAYS.map(day => `<div class="day-header">${day}</div>`).join('')}

                ${sortedTimeslots.map((timeslot, rowIndex) => `
                    <div class="time-label">${timeslot}</div>
                    ${Config.DAYS.map(day => {
                        if (day === 'Arranged') {
                            return rowIndex === 0
                                ? this._renderArrangedSlot(classroom.id, sortedTimeslots.length)
                                : '';
                        }
                        return this._renderDaySlot(classroom, day, timeslot);
                    }).join('')}
                `).join('')}
            </div>
        `;
    },

    /** Render the grid when no timeslots exist (still shows Arranged column) */
    _renderClassroomNoTimeslots(classroom) {
        return `
            <div class="classroom-schedule ${!classroom.visible ? 'hidden' : ''}">
                <div class="day-header"></div>
                ${Config.DAYS.map(day => `<div class="day-header">${day}</div>`).join('')}
                <div class="time-label">No times</div>
                ${Config.DAYS.map(day => {
                    if (day === 'Arranged') {
                        return this._renderArrangedSlot(classroom.id, null);
                    }
                    return `<div class="time-slot" style="background: #f0f0f0;"></div>`;
                }).join('')}
            </div>
        `;
    },

    /** Render a regular day/timeslot cell */
    _renderDaySlot(classroom, day, timeslot) {
        const hasTimeslot = (classroom.timeslots[day] || []).includes(timeslot);
        if (!hasTimeslot) {
            return `<div class="time-slot" style="background: #f0f0f0;"></div>`;
        }

        const slotData = appData.schedule[classroom.id]?.[day]?.[timeslot];
        const courses = Array.isArray(slotData) ? slotData : (slotData ? [slotData] : []);
        const hasConflict = CourseManager.hasInPersonConflict(day, timeslot);

        if (courses.length > 0) {
            return `
                <div class="time-slot occupied ${hasConflict ? 'conflict' : ''}"
                     ondragover="DragDrop.handleOver(event)"
                     ondragleave="DragDrop.handleLeave(event)"
                     ondrop="DragDrop.handleDrop(event, '${classroom.id}', '${day}', '${timeslot}')">
                    ${courses.map((item, index) =>
                        this._renderScheduledCourse(item, index, classroom.id, day, timeslot, hasConflict)
                    ).join('')}
                </div>
            `;
        }

        return `
            <div class="time-slot"
                 ondragover="DragDrop.handleOver(event)"
                 ondragleave="DragDrop.handleLeave(event)"
                 ondrop="DragDrop.handleDrop(event, '${classroom.id}', '${day}', '${timeslot}')">
            </div>
        `;
    },

    /** Render the Arranged column (DRY — previously duplicated 3 times) */
    _renderArrangedSlot(classroomId, gridRowSpan) {
        const day = 'Arranged';
        const slotData = appData.schedule[classroomId]?.[day]?.['arranged'];
        const courses = Array.isArray(slotData) ? slotData : (slotData ? [slotData] : []);
        const spanStyle = gridRowSpan ? `grid-row: span ${gridRowSpan};` : '';

        return `
            <div class="time-slot arranged-slot ${courses.length > 0 ? 'occupied' : ''}" style="${spanStyle}"
                 ondragover="DragDrop.handleOver(event)"
                 ondragleave="DragDrop.handleLeave(event)"
                 ondrop="DragDrop.handleDrop(event, '${classroomId}', '${day}', 'arranged')">
                ${courses.map((item, index) =>
                    this._renderScheduledCourse(item, index, classroomId, day, 'arranged')
                ).join('')}
            </div>
        `;
    },

    /** Render a single scheduled course card (DRY — previously duplicated 3 times) */
    _renderScheduledCourse(item, index, classroomId, day, timeslot, hasConflict) {
        const course = appData.courseCatalog.find(c => c.id === item.courseId);
        const style = this._getScheduledCourseStyle(item.courseId, item.section);
        const displayName = Helpers.getCourseDisplayName(course);
        const sectionLabel = item.section ? ` <span class="section-badge">§${item.section}</span>` : '';

        const sd = DataStore.getCurrentSchedule();
        const instrKey = Helpers.getCourseInstructorKey(item.courseId, item.section);
        const instructorId = sd.courseInstructors[instrKey] || null;
        const instructor = instructorId ? appData.instructors.find(i => i.id === instructorId) : null;

        return `
            <div class="scheduled-course"
                 style="${style}"
                 draggable="true"
                 data-source-classroom-id="${classroomId}"
                 data-source-day="${day}"
                 data-source-timeslot="${timeslot}"
                 data-source-course-index="${index}"
                 data-source-section="${item.section || ''}"
                 ondragstart="DragDrop.handleStart(event, '${item.courseId}')"
                 ondragend="DragDrop.handleEnd(event)"
                 ondblclick="Modals.showCourse('${item.courseId}', '${classroomId}', '${day}', '${timeslot}', ${index})">
                <button class="remove-course" onclick="event.stopPropagation(); ScheduleGrid.unschedule('${classroomId}', '${day}', '${timeslot}', ${index})">&times;</button>
                <div class="course-name">${displayName}${sectionLabel}${hasConflict ? ' ⚠️' : ''}</div>
                <div class="course-meta">
                    ${course ? course.credits + ' credits' : ''}${instructor ? ' • ' + instructor.name : ''}${course && course.quarterTaken ? '<span class="quarter-badge">' + course.quarterTaken + '</span>' : ''}
                    <span class="modality-badge">${Config.MODALITY_ICONS[item.modality]} ${item.modality}</span>
                </div>
            </div>
        `;
    },

    /** Compute background style for a scheduled course based on instructor color and filter */
    _getScheduledCourseStyle(courseId, section) {
        const sd = DataStore.getCurrentSchedule();
        const instrKey = Helpers.getCourseInstructorKey(courseId, section);
        const instructorId = sd.courseInstructors[instrKey] || null;
        const instructor = instructorId ? appData.instructors.find(i => i.id === instructorId) : null;
        const color = instructor ? (instructor.color || Config.DEFAULT_COLOR) : '#95a5a6';

        const isFiltering = appData.instructorFilter && appData.instructorFilter.length > 0;
        const isFiltered = isFiltering && instructorId && !appData.instructorFilter.includes(instructorId);
        const opacity = isFiltered ? '0.2' : '1';

        return `background: ${color}; opacity: ${opacity};`;
    },

    /** Render the timeslot management form for a classroom */
    _renderTimeslotForm(classroom) {
        return `
            <div class="timeslot-form-header" onclick="ClassroomManager.toggleForm('${classroom.id}')">
                <span>${classroom.timeslotFormExpanded !== false ? '▼' : '▶'} Manage Time Slots</span>
            </div>
            <div class="timeslot-form" style="display: ${classroom.timeslotFormExpanded !== false ? 'block' : 'none'};">
                ${Config.DAYS.filter(day => day !== 'Arranged').map(day => `
                    <div class="timeslot-day-section">
                        <h5>${day}</h5>
                        <div class="timeslot-inputs">
                            <input type="time" id="startTime-${classroom.id}-${day}" placeholder="Start">
                            <input type="time" id="endTime-${classroom.id}-${day}" placeholder="End">
                            <button onclick="ClassroomManager.addTimeslotFromForm('${classroom.id}', '${day}')">Add</button>
                            ${day === 'Monday' && (classroom.timeslots[day] || []).length > 0 ? `
                                <button onclick="ClassroomManager.copyTimeslotsToAllDays('${classroom.id}', '${day}')" style="background: #27ae60;">Copy to All</button>
                            ` : ''}
                        </div>
                        ${(classroom.timeslots[day] || []).length > 0 ? `
                            <div class="timeslots-list">
                                ${classroom.timeslots[day].map(ts => `
                                    <div class="timeslot-tag">
                                        ${ts}
                                        <button onclick="ClassroomManager.removeTimeslot('${classroom.id}', '${day}', '${ts}')">&times;</button>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  IMPORT / EXPORT — Data serialization with version handling
// ─────────────────────────────────────────────────────────────────────────────

const ImportExport = {
    exportSchedule() {
        const defaultName = `${appData.currentSchedule.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`;
        const filename = prompt('Enter filename for export (without .json extension):', defaultName);
        if (filename === null) return;

        const finalFilename = filename.trim() || defaultName;

        const exportPayload = {
            version: '4.0',
            exportDate: new Date().toISOString(),
            scheduleName: appData.currentSchedule,
            programs: appData.programs,
            courseCatalog: appData.courseCatalog,
            instructors: appData.instructors,             // Global instructors
            data: DataStore.getCurrentSchedule()           // Per-schedule data (no instructors)
        };

        const dataStr = JSON.stringify(exportPayload, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${finalFilename}.json`;
        link.click();
        URL.revokeObjectURL(url);
    },

    importSchedule(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);

                // v4.0: global instructors
                if (imported.version === '4.0' && imported.scheduleName && imported.data) {
                    this._importV4(imported);
                }
                // v3.0: per-schedule instructors
                else if (imported.version === '3.0' && imported.scheduleName && imported.data) {
                    this._importV3(imported);
                }
                // v2.0: old format with courses per schedule
                else if (imported.version === '2.0' && imported.scheduleName && imported.data) {
                    this._importV2(imported);
                }
                // v1.0
                else if (imported.version === '1.0' && imported.data) {
                    this._importV1(imported);
                }
                // Legacy
                else if (imported.instructors && imported.courses && imported.classrooms && imported.schedule) {
                    this._importLegacy(imported);
                }
                else {
                    alert('Invalid data format');
                }
            } catch (err) {
                alert('Error importing data: ' + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    },

    /** Prompt for schedule name, check for overwrite */
    _promptScheduleName(defaultName) {
        const name = prompt('Enter name for this schedule:', defaultName);
        if (!name || !name.trim()) return null;
        const finalName = name.trim();
        if (appData.schedules[finalName]) {
            if (!confirm(`Schedule "${finalName}" already exists. Override it?`)) return null;
        }
        return finalName;
    },

    /** Merge programs into global list (deduplicate by id and name) */
    _mergePrograms(programs) {
        if (!programs) return;
        programs.forEach(prog => {
            if (!appData.programs.find(p => p.id === prog.id)) {
                if (!appData.programs.find(p => p.name === prog.name)) {
                    appData.programs.push(prog);
                }
            }
        });
    },

    /** Merge courses into global catalog (deduplicate by id) */
    _mergeCourses(courses) {
        if (!courses) return;
        courses.forEach(course => {
            if (!appData.courseCatalog.find(c => c.id === course.id)) {
                appData.courseCatalog.push(course);
            }
        });
    },

    /** Merge instructors into global list (deduplicate by id) */
    _mergeInstructors(instructors) {
        if (!instructors) return;
        instructors.forEach(instr => {
            if (!appData.instructors.find(i => i.id === instr.id)) {
                appData.instructors.push(instr);
            }
        });
    },

    _importV4(imported) {
        const sd = imported.data;
        if (!sd.classrooms || !sd.schedule) {
            alert('Invalid data format in file');
            return;
        }

        const finalName = this._promptScheduleName(imported.scheduleName);
        if (!finalName) { alert('Import cancelled.'); return; }

        this._mergePrograms(imported.programs);
        this._mergeCourses(imported.courseCatalog);
        this._mergeInstructors(imported.instructors);

        appData.schedules[finalName] = sd;
        appData.currentSchedule = finalName;
        DataStore.save();
        ScheduleManager.renderSelector();
        Renderer.render();
        alert(`Schedule "${finalName}" imported successfully!`);
    },

    _importV3(imported) {
        const sd = imported.data;
        if (!sd.instructors || !sd.classrooms || !sd.schedule) {
            alert('Invalid data format in file');
            return;
        }

        const finalName = this._promptScheduleName(imported.scheduleName);
        if (!finalName) { alert('Import cancelled.'); return; }

        this._mergePrograms(imported.programs);
        this._mergeCourses(imported.courseCatalog);

        // Migrate instructors from per-schedule to global
        this._mergeInstructors(sd.instructors);
        delete sd.instructors;

        appData.schedules[finalName] = sd;
        appData.currentSchedule = finalName;
        DataStore.save();
        ScheduleManager.renderSelector();
        Renderer.render();
        alert(`Schedule "${finalName}" imported successfully!`);
    },

    _importV2(imported) {
        const data = imported.data;
        if (!data.instructors || !data.courses || !data.classrooms || !data.schedule) {
            alert('Invalid data format in file');
            return;
        }

        const finalName = this._promptScheduleName(imported.scheduleName);
        if (!finalName) { alert('Import cancelled.'); return; }

        // Migrate courses to catalog
        const courseInstructors = {};
        data.courses.forEach(course => {
            if (!appData.courseCatalog.find(c => c.id === course.id)) {
                const { instructorId, ...catalogCourse } = course;
                catalogCourse.programId = null;
                catalogCourse.courseNumber = '';
                catalogCourse.quartersOffered = [];
                appData.courseCatalog.push(catalogCourse);
            }
            if (course.instructorId) {
                courseInstructors[course.id] = course.instructorId;
            }
        });

        // Migrate instructors to global
        this._mergeInstructors(data.instructors);

        appData.schedules[finalName] = {
            quarter: '',
            courseInstructors,
            classrooms: data.classrooms,
            schedule: data.schedule
        };
        appData.currentSchedule = finalName;
        DataStore.save();
        ScheduleManager.renderSelector();
        Renderer.render();
        alert(`Schedule "${finalName}" imported successfully! (migrated from v2.0)`);
    },

    _importV1(imported) {
        const data = imported.data;
        if (!data.instructors || !data.courses || !data.classrooms || !data.schedule) {
            alert('Invalid data format in versioned file');
            return;
        }

        const finalName = this._promptScheduleName('Imported Schedule');
        if (!finalName) { alert('Import cancelled.'); return; }

        const courseInstructors = {};
        data.courses.forEach(course => {
            if (!appData.courseCatalog.find(c => c.id === course.id)) {
                const { instructorId, ...catalogCourse } = course;
                catalogCourse.programId = null;
                catalogCourse.courseNumber = '';
                catalogCourse.quartersOffered = [];
                appData.courseCatalog.push(catalogCourse);
            }
            if (course.instructorId) {
                courseInstructors[course.id] = course.instructorId;
            }
        });

        this._mergeInstructors(data.instructors);

        appData.schedules[finalName] = {
            quarter: '',
            courseInstructors,
            classrooms: data.classrooms,
            schedule: data.schedule
        };
        appData.currentSchedule = finalName;
        DataStore.save();
        ScheduleManager.renderSelector();
        Renderer.render();
        alert(`Schedule "${finalName}" imported successfully! (migrated from v1.0)`);
    },

    _importLegacy(imported) {
        const finalName = this._promptScheduleName('Imported Schedule');
        if (!finalName) { alert('Import cancelled.'); return; }

        const courseInstructors = {};
        imported.courses.forEach(course => {
            if (!appData.courseCatalog.find(c => c.id === course.id)) {
                const { instructorId, ...catalogCourse } = course;
                catalogCourse.programId = null;
                catalogCourse.courseNumber = '';
                catalogCourse.quartersOffered = [];
                appData.courseCatalog.push(catalogCourse);
            }
            if (course.instructorId) {
                courseInstructors[course.id] = course.instructorId;
            }
        });

        this._mergeInstructors(imported.instructors);

        appData.schedules[finalName] = {
            quarter: '',
            courseInstructors,
            classrooms: imported.classrooms,
            schedule: imported.schedule
        };
        appData.currentSchedule = finalName;
        DataStore.save();
        ScheduleManager.renderSelector();
        Renderer.render();
        alert(`Schedule "${finalName}" imported successfully! (Legacy format)`);
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  COHORT SUMMARY — Analyze and display cohort schedules
// ─────────────────────────────────────────────────────────────────────────────

const CohortSummary = {
    show() {
        const modal = document.getElementById('cohortSummaryModal');
        const content = document.getElementById('cohortSummaryContent');
        if (!modal || !content) return;

        const summaryData = this._analyzeCohorts();
        content.innerHTML = this._renderSummary(summaryData);
        modal.style.display = 'block';
    },

    close() {
        const modal = document.getElementById('cohortSummaryModal');
        if (modal) modal.style.display = 'none';
    },

    _analyzeCohorts() {
        const cohortMap = new Map();
        const sd = DataStore.getCurrentSchedule();

        // Iterate through all scheduled courses
        Object.keys(sd.schedule).forEach(classroomId => {
            const classroom = appData.classrooms.find(c => c.id === classroomId);
            if (!classroom) return;

            Object.keys(sd.schedule[classroomId]).forEach(day => {
                Object.keys(sd.schedule[classroomId][day]).forEach(timeslot => {
                    const courses = sd.schedule[classroomId][day][timeslot];
                    const courseArray = Array.isArray(courses) ? courses : (courses ? [courses] : []);

                    courseArray.forEach(item => {
                        const course = appData.courseCatalog.find(c => c.id === item.courseId);
                        if (!course || !course.quarterTaken) return;

                        const cohortKey = course.quarterTaken.trim();
                        if (!cohortMap.has(cohortKey)) {
                            cohortMap.set(cohortKey, {
                                name: cohortKey,
                                classes: []
                            });
                        }

                        const cohort = cohortMap.get(cohortKey);
                        const displayName = Helpers.getCourseDisplayName(course);

                        // Check if this course is already in the cohort's classes list (ignore section)
                        let existingClass = cohort.classes.find(c => 
                            c.courseId === course.id
                        );

                        if (!existingClass) {
                            existingClass = {
                                courseId: course.id,
                                name: displayName,
                                credits: course.credits,
                                schedules: []
                            };
                            cohort.classes.push(existingClass);
                        }

                        // Add this timeslot to the class's schedule
                        const timeDisplay = day === 'Arranged' ? 'Arranged' : `${day} ${timeslot}`;
                        existingClass.schedules.push({
                            day,
                            timeslot,
                            modality: item.modality || 'in-person',
                            section: item.section || '',
                            classroom: classroom.roomNumber,
                            timeDisplay
                        });
                    });
                });
            });
        });

        return Array.from(cohortMap.values()).sort((a, b) => 
            a.name.localeCompare(b.name, undefined, { numeric: true })
        );
    },

    _renderSummary(cohorts) {
        if (cohorts.length === 0) {
            return '<p style="color: #7f8c8d; font-size: 16px; text-align: center; margin-top: 20px;">No cohorts found. Assign cohorts (e.g., Q1, Q2) to courses in the course catalog.</p>';
        }

        return cohorts.map(cohort => {
            // Calculate unique days per week (excluding Arranged)
            const allDays = new Set();
            cohort.classes.forEach(cls => {
                cls.schedules.forEach(sched => {
                    if (sched.day !== 'Arranged') {
                        allDays.add(sched.day);
                    }
                });
            });
            const daysPerWeek = allDays.size;
            const totalCredits = cohort.classes.reduce((sum, cls) => sum + (cls.credits || 0), 0);

            const classesHTML = cohort.classes.map(cls => {
                // Group schedules by day
                const dayGroups = {};
                cls.schedules.forEach(sched => {
                    const key = sched.day;
                    if (!dayGroups[key]) dayGroups[key] = [];
                    dayGroups[key].push(sched);
                });

                const scheduleHTML = Object.keys(dayGroups)
                    .sort((a, b) => {
                        const dayOrder = Config.DAYS.indexOf(a) - Config.DAYS.indexOf(b);
                        return dayOrder;
                    })
                    .map(day => {
                        const scheds = dayGroups[day];
                        const times = scheds.map(s => s.timeslot !== 'arranged' ? s.timeslot : '').filter(t => t).join(', ');
                        
                        // Build modality text with sections
                        const modalityDetails = scheds.map(s => {
                            const icon = Config.MODALITY_ICONS[s.modality] || '';
                            const text = s.modality.charAt(0).toUpperCase() + s.modality.slice(1);
                            const sectionLabel = s.section ? ` (Section ${s.section})` : '';
                            return `${icon} ${text}${sectionLabel}`;
                        });
                        const modalityText = [...new Set(modalityDetails)].join(', ');
                        
                        return `
                            <div class="cohort-schedule-item">
                                <strong>${day}:</strong> ${times || 'Arranged'} <span class="cohort-modality">${modalityText}</span>
                            </div>
                        `;
                    }).join('');

                return `
                    <div class="cohort-class">
                        <div class="cohort-class-name">${cls.name}</div>
                        <div class="cohort-class-info">${cls.credits} credits</div>
                        <div class="cohort-schedule-list">
                            ${scheduleHTML}
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="cohort-summary-section">
                    <h3 class="cohort-name">Cohort: ${cohort.name}</h3>
                    <div class="cohort-stats">
                        <span class="cohort-stat"><strong>Days per week:</strong> ${daysPerWeek > 0 ? daysPerWeek : 'N/A'}</span>
                        <span class="cohort-stat"><strong>Total credits:</strong> ${totalCredits}</span>
                    </div>
                    <div class="cohort-classes-list">
                        ${classesHTML}
                    </div>
                </div>
            `;
        }).join('');
    }
};


// ─────────────────────────────────────────────────────────────────────────────
//  APP — Initialization and event wiring
// ─────────────────────────────────────────────────────────────────────────────

const App = {
    init() {
        DataStore.load();
        this._initializeEventListeners();
        ScheduleManager.renderSelector();
        Renderer.render();
    },

    _initializeEventListeners() {
        // Form submissions
        document.getElementById('addProgramForm').addEventListener('submit', e => {
            e.preventDefault();
            ProgramManager.add();
        });
        document.getElementById('addInstructorForm').addEventListener('submit', e => {
            e.preventDefault();
            InstructorManager.add();
        });
        document.getElementById('addCourseForm').addEventListener('submit', e => {
            e.preventDefault();
            CourseManager.add();
        });
        document.getElementById('addClassroomForm').addEventListener('submit', e => {
            e.preventDefault();
            ClassroomManager.add();
        });

        // Export/Import
        document.getElementById('exportBtn').addEventListener('click', () => ImportExport.exportSchedule());
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        document.getElementById('fileInput').addEventListener('change', e => ImportExport.importSchedule(e));

        // Course modal close handlers
        document.querySelector('.close-modal').addEventListener('click', () => Modals.closeCourse());
        document.querySelector('.close-instructor-modal').addEventListener('click', () => Modals.closeInstructor());
        window.addEventListener('click', e => {
            if (e.target.id === 'courseModal') Modals.closeCourse();
            if (e.target.id === 'modalityModal') Modals.closeModality();
            if (e.target.id === 'instructorModal') Modals.closeInstructor();
            if (e.target.id === 'cohortSummaryModal') CohortSummary.close();
        });

        // Edit course form
        document.getElementById('editCourseForm').addEventListener('submit', e => {
            e.preventDefault();
            const modal = document.getElementById('courseModal');
            const courseId = modal.dataset.courseId;
            const classroomId = modal.dataset.classroomId;
            const day = modal.dataset.day;
            const timeslot = modal.dataset.timeslot;
            const courseIndex = modal.dataset.courseIndex;
            const programId = document.getElementById('editCourseProgram').value || null;
            const courseNumber = document.getElementById('editCourseNumber').value.trim() || '';
            const name = document.getElementById('editCourseName').value.trim();
            const credits = document.getElementById('editCourseCredits').value;
            const instructorId = document.getElementById('editCourseInstructor').value;
            const modality = document.getElementById('editModality').value || 'in-person';
            const quarterTaken = document.getElementById('editCourseQuarterTaken')?.value.trim() || null;
            const quartersOffered = UIState.getQuartersOfferedFromCheckboxes('edit');
            const section = document.getElementById('editCourseSection')?.value.trim() || '';

            if (credits) {
                Modals.saveCourseChanges(courseId, name, credits, instructorId || null,
                    classroomId, day, timeslot, modality, courseIndex,
                    quarterTaken, programId, courseNumber, quartersOffered, section);
            }
        });

        // Edit instructor form
        document.getElementById('editInstructorForm').addEventListener('submit', e => {
            e.preventDefault();
            const modal = document.getElementById('instructorModal');
            const instructorId = modal.dataset.instructorId;
            const name = document.getElementById('editInstructorName').value.trim();
            const color = document.getElementById('editInstructorColor').value;
            if (name) {
                Modals.saveInstructorChanges(instructorId, name, color);
            }
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', e => {
            const filterList = document.getElementById('instructorFilterList');
            const filterToggle = document.querySelector('.filter-toggle');
            if (filterList && filterToggle && !filterToggle.contains(e.target) && !filterList.contains(e.target)) {
                filterList.style.display = 'none';
            }
            ['quartersOfferedList', 'editQuartersOfferedList'].forEach(id => {
                const list = document.getElementById(id);
                if (list && list.style.display !== 'none') {
                    const parent = list.closest('.quarters-offered-dropdown');
                    if (parent && !parent.contains(e.target)) {
                        list.style.display = 'none';
                    }
                }
            });
        });
    }
};

// Start the app
document.addEventListener('DOMContentLoaded', () => App.init());