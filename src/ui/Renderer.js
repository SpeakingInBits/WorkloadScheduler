import { Config } from '../config.js';
import { Helpers } from '../utils/Helpers.js';

export class Renderer {
    #dataStore;
    #callbacks; // { isScheduled, hasInPersonConflict, getWorkload, validate }

    /**
     * @param {import('../data/DataStore.js').DataStore} dataStore
     * @param {{
     *   isScheduled: (id: string) => boolean,
     *   hasInPersonConflict: (day: string, ts: string) => boolean,
     *   getWorkload: (id: string) => number,
     *   validate: () => Array<{type: string, message: string}>,
     * }} callbacks
     */
    constructor(dataStore, callbacks) {
        this.#dataStore = dataStore;
        this.#callbacks = callbacks;
    }

    render() {
        this.renderPrograms();
        this.renderInstructors();
        this.renderCourses();
        this.renderSchedule();
        this.renderValidationSummary();
    }

    // ── Programs ──

    renderPrograms() {
        const container = document.getElementById('programsList');
        if (!container) return;

        const d = this.#dataStore.data;
        if (d.programs.length === 0) {
            container.innerHTML = '<p style="color: var(--color-muted); font-size: 14px;">No programs added yet</p>';
            return;
        }

        container.innerHTML = d.programs.map(program => {
            const courseCount = d.courseCatalog.filter(c => c.programId === program.id).length;
            return `
                <div class="program-item"
                     data-action="program-edit" data-id="${program.id}"
                     style="cursor: pointer;">
                    <div>
                        <div class="program-name">${program.name}</div>
                        <div class="program-meta">${courseCount} course${courseCount !== 1 ? 's' : ''}</div>
                    </div>
                    <button class="delete-btn"
                            data-action="program-remove" data-id="${program.id}">Delete</button>
                </div>
            `;
        }).join('');
    }

    // ── Instructors ──

    renderInstructors() {
        const container = document.getElementById('instructorsList');
        if (!container) return;

        const d = this.#dataStore.data;
        if (d.instructors.length === 0) {
            container.innerHTML = '<p style="color: var(--color-muted); font-size: 14px;">No instructors added yet</p>';
            const filterList = document.getElementById('instructorFilterList');
            if (filterList) filterList.innerHTML = '<p style="padding: 10px; color: var(--color-muted);">No instructors</p>';
            return;
        }

        container.innerHTML = d.instructors.map(instructor => {
            const workload = this.#callbacks.getWorkload(instructor.id);
            const color = instructor.color || Config.DEFAULT_COLOR;
            return `
                <div class="instructor-item"
                     data-action="instructor-edit" data-id="${instructor.id}"
                     style="cursor: pointer; border-left: 4px solid ${color};">
                    <div>
                        <div>${instructor.name}</div>
                        <div class="workload">${Helpers.formatCredits(workload)} credits</div>
                    </div>
                    <button class="delete-btn"
                            data-action="instructor-remove" data-id="${instructor.id}">Delete</button>
                </div>
            `;
        }).join('');

        const filterList = document.getElementById('instructorFilterList');
        if (filterList) {
            if (!d.instructorFilter) d.instructorFilter = [];
            filterList.innerHTML = d.instructors.map(instructor => {
                const checked = d.instructorFilter.includes(instructor.id);
                const color = instructor.color || Config.DEFAULT_COLOR;
                return `
                    <label class="filter-checkbox">
                        <input type="checkbox" ${checked ? 'checked' : ''}
                               data-action="instructor-filter" data-id="${instructor.id}">
                        <span class="color-indicator" style="background: ${color};"></span>
                        <span>${instructor.name}</span>
                    </label>
                `;
            }).join('');
        }
    }

    // ── Courses ──

    renderCourses() {
        const container = document.getElementById('coursesList');
        if (!container) return;

        const d = this.#dataStore.data;

        const programSelect = document.getElementById('courseProgram');
        if (programSelect) {
            programSelect.innerHTML = '<option value="">Select Program</option>' +
                d.programs.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        }

        const programFilterSelect = document.getElementById('programFilterSelect');
        if (programFilterSelect) {
            const currentFilter = d.programFilter || '';
            programFilterSelect.innerHTML = '<option value="">All Programs</option>' +
                d.programs.map(p =>
                    `<option value="${p.id}" ${p.id === currentFilter ? 'selected' : ''}>${p.name}</option>`
                ).join('');
        }

        let displayCourses = d.courseCatalog;
        if (d.programFilter) {
            displayCourses = displayCourses.filter(c => c.programId === d.programFilter);
        }

        if (displayCourses.length === 0) {
            container.innerHTML = d.courseCatalog.length === 0
                ? '<p style="color: var(--color-muted); font-size: 14px;">No courses added yet</p>'
                : '<p style="color: var(--color-muted); font-size: 14px;">No courses match the selected filter</p>';
            return;
        }

        const sd = this.#dataStore.getCurrentSchedule();

        container.innerHTML = displayCourses.map(course => {
            const instructorLabel = this._instructorLabel(
                Helpers.getInstructorAssignments(sd, course.id, ''), course.credits
            );
            const isScheduled = this.#callbacks.isScheduled(course.id);
            const statusClass = isScheduled ? 'course-scheduled' : 'course-unscheduled';
            const quarterLabel = course.quarterTaken ? ` • ${course.quarterTaken}` : '';
            const displayName = Helpers.getCourseDisplayName(course, d.programs);
            const hasNoProgram = !course.programId;
            const quartersStr = (course.quartersOffered && course.quartersOffered.length > 0)
                ? ` • ${course.quartersOffered.join(', ')}` : '';
            return `
                <div class="course-item ${statusClass} ${hasNoProgram ? 'course-no-program' : ''}"
                     draggable="true"
                     data-drag-course-id="${course.id}"
                     data-action="course-edit-list" data-id="${course.id}">
                    <div class="course-info">
                        <div class="course-name">${displayName}${hasNoProgram ? ' <span class="no-program-badge" title="No program assigned">⚠️</span>' : ''}</div>
                        <div class="course-meta">${Helpers.formatCredits(course.credits)} credits${instructorLabel ? ' • ' + instructorLabel : ''}${quarterLabel}${quartersStr}</div>
                    </div>
                    <button class="delete-btn"
                            data-action="course-remove" data-id="${course.id}">Delete</button>
                </div>
            `;
        }).join('');
    }

    // ── Validation Summary ──

    renderValidationSummary() {
        const errors = this.#callbacks.validate();
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
            quarter:    { cls: 'quarter-conflict',    icon: '📅' },
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
    }

    // ── Schedule Grid ──

    renderSchedule() {
        this.renderTimeslotManager();
        const container = document.getElementById('scheduleGrid');
        if (!container) return;

        const d = this.#dataStore.data;
        if (d.classrooms.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No classrooms added yet</p></div>';
            return;
        }

        container.innerHTML = d.classrooms.map(classroom =>
            this._renderClassroom(classroom)
        ).join('');
    }

    _renderClassroom(classroom) {
        const sd = this.#dataStore.getCurrentSchedule();
        const allTimeslots = new Set();
        Config.DAYS.filter(d => d !== 'Arranged').forEach(day => {
            (sd.timeslots[day] || []).forEach(ts => allTimeslots.add(ts));
        });
        const sortedTimeslots = Array.from(allTimeslots).sort();

        const gridHTML = sortedTimeslots.length > 0
            ? this._renderClassroomGrid(classroom, sortedTimeslots)
            : this._renderClassroomNoTimeslots(classroom);

        return `
            <div class="classroom-container">
                <div class="classroom-header">
                    <h3>Room ${classroom.roomNumber}</h3>
                    <div class="classroom-controls">
                        <button class="toggle-btn"
                                data-action="classroom-toggle" data-id="${classroom.id}">
                            ${classroom.visible ? 'Hide' : 'Show'}
                        </button>
                        <button class="delete-btn"
                                data-action="classroom-remove" data-id="${classroom.id}">Delete</button>
                    </div>
                </div>
                ${gridHTML}
            </div>
        `;
    }

    _renderClassroomGrid(classroom, sortedTimeslots) {
        const overlappingSlots = new Set();
        for (let i = 0; i < sortedTimeslots.length; i++) {
            for (let j = i + 1; j < sortedTimeslots.length; j++) {
                if (Helpers.timesOverlap(sortedTimeslots[i], sortedTimeslots[j])) {
                    overlappingSlots.add(sortedTimeslots[i]);
                    overlappingSlots.add(sortedTimeslots[j]);
                }
            }
        }

        return `
            <div class="classroom-schedule ${!classroom.visible ? 'hidden' : ''}">
                <div class="day-header"></div>
                ${Config.DAYS.map(day => `<div class="day-header">${day}</div>`).join('')}
                ${sortedTimeslots.map((timeslot, rowIndex) => `
                    <div class="time-label ${overlappingSlots.has(timeslot) ? 'time-label-overlap' : ''}">${timeslot}${overlappingSlots.has(timeslot) ? ' <span class="overlap-indicator" title="Overlaps with another time slot">⚠️</span>' : ''}</div>
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
    }

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
    }

    _renderDaySlot(classroom, day, timeslot) {
        const sd = this.#dataStore.getCurrentSchedule();
        const d = this.#dataStore.data;
        const hasTimeslot = (sd.timeslots[day] || []).includes(timeslot);
        if (!hasTimeslot) {
            return `<div class="time-slot" style="background: #f0f0f0;"></div>`;
        }

        const slotData = d.schedule[classroom.id]?.[day]?.[timeslot];
        const courses = Array.isArray(slotData) ? slotData : (slotData ? [slotData] : []);
        const hasConflict = this.#callbacks.hasInPersonConflict(day, timeslot);

        if (courses.length > 0) {
            return `
                <div class="time-slot occupied ${hasConflict ? 'conflict' : ''}"
                     data-droppable data-classroom="${classroom.id}" data-day="${day}" data-timeslot="${timeslot}">
                    ${courses.map((item, index) =>
                        this._renderScheduledCourse(item, index, classroom.id, day, timeslot, hasConflict)
                    ).join('')}
                </div>
            `;
        }

        return `
            <div class="time-slot"
                 data-droppable data-classroom="${classroom.id}" data-day="${day}" data-timeslot="${timeslot}">
            </div>
        `;
    }

    _renderArrangedSlot(classroomId, gridRowSpan) {
        const day = 'Arranged';
        const d = this.#dataStore.data;
        const slotData = d.schedule[classroomId]?.[day]?.['arranged'];
        const courses = Array.isArray(slotData) ? slotData : (slotData ? [slotData] : []);
        const spanStyle = gridRowSpan ? `grid-row: span ${gridRowSpan};` : '';

        return `
            <div class="time-slot arranged-slot ${courses.length > 0 ? 'occupied' : ''}" style="${spanStyle}"
                 data-droppable data-classroom="${classroomId}" data-day="${day}" data-timeslot="arranged">
                ${courses.map((item, index) =>
                    this._renderScheduledCourse(item, index, classroomId, day, 'arranged')
                ).join('')}
            </div>
        `;
    }

    _renderScheduledCourse(item, index, classroomId, day, timeslot, hasConflict) {
        const d = this.#dataStore.data;
        const course = d.courseCatalog.find(c => c.id === item.courseId);
        const style = this._getScheduledCourseStyle(item.courseId, item.section);
        const displayName = Helpers.getCourseDisplayName(course, d.programs);
        const sectionLabel = item.section ? ` <span class="section-badge">§${item.section}</span>` : '';

        const sd = this.#dataStore.getCurrentSchedule();
        const assignments = Helpers.getInstructorAssignments(sd, item.courseId, item.section);
        const instructorLabel = this._instructorLabel(assignments, course ? course.credits : 0);

        return `
            <div class="scheduled-course"
                 style="${style}"
                 draggable="true"
                 data-drag-course-id="${item.courseId}"
                 data-source-classroom="${classroomId}"
                 data-source-day="${day}"
                 data-source-timeslot="${timeslot}"
                 data-source-index="${index}"
                 data-source-section="${item.section || ''}"
                 data-action="edit-scheduled"
                 data-course="${item.courseId}"
                 data-classroom="${classroomId}"
                 data-day="${day}"
                 data-timeslot="${timeslot}"
                 data-index="${index}">
                <button class="remove-course"
                        data-action="unschedule"
                        data-classroom="${classroomId}" data-day="${day}"
                        data-timeslot="${timeslot}" data-index="${index}">&times;</button>
                <div class="course-name">${displayName}${sectionLabel}${hasConflict ? ' ⚠️' : ''}</div>
                <div class="course-meta">
                    ${course ? Helpers.formatCredits(course.credits) + ' credits' : ''}${instructorLabel ? ' • ' + instructorLabel : ''}${course && course.quarterTaken ? '<span class="quarter-badge">' + course.quarterTaken + '</span>' : ''}
                    <span class="modality-badge">${Config.MODALITY_ICONS[item.modality]} ${item.modality}</span>
                </div>
            </div>
        `;
    }

    _getScheduledCourseStyle(courseId, section) {
        const d = this.#dataStore.data;
        const sd = this.#dataStore.getCurrentSchedule();
        const assignments = Helpers.getInstructorAssignments(sd, courseId, section);
        const primaryId = assignments.length > 0 ? assignments[0].instructorId : null;
        const primary = primaryId ? d.instructors.find(i => i.id === primaryId) : null;
        const color = primary ? (primary.color || Config.DEFAULT_COLOR) : '#95a5a6';

        // With co-teaching, keep the slot visible if ANY assigned instructor
        // passes the active filter.
        const isFiltering = d.instructorFilter && d.instructorFilter.length > 0;
        const matchesFilter = assignments.some(a => d.instructorFilter.includes(a.instructorId));
        const isFiltered = isFiltering && assignments.length > 0 && !matchesFilter;
        const opacity = isFiltered ? '0.2' : '1';

        return `background: ${color}; opacity: ${opacity};`;
    }

    /**
     * Build a display label for a set of instructor assignments.
     * Single instructor → "Name". Co-teaching → "Name (2), Name2 (1)".
     * @param {Array<{instructorId: string, credits: number|null}>} assignments
     * @param {number} courseCredits — fallback credit total for unspecified shares
     * @returns {string}
     */
    _instructorLabel(assignments, courseCredits) {
        const d = this.#dataStore.data;
        if (!assignments || assignments.length === 0) return '';
        const names = assignments.map(a => {
            const instructor = d.instructors.find(i => i.id === a.instructorId);
            const name = instructor ? instructor.name : 'Unknown';
            if (assignments.length === 1) return name;
            const credits = a.credits == null ? courseCredits : a.credits;
            return `${name} (${Helpers.formatCredits(credits)})`;
        });
        return names.join(', ');
    }

    // ── Timeslot Manager ──

    renderTimeslotManager() {
        const container = document.getElementById('timeslotManager');
        if (!container) return;

        const sd = this.#dataStore.getCurrentSchedule();
        const isExpanded = sd.timeslotManagerExpanded !== false;

        container.innerHTML = `
            <div class="timeslot-manager">
                <div class="timeslot-manager-header" data-action="timeslot-toggle">
                    <span>${isExpanded ? '▼' : '▶'} Manage Time Slots</span>
                </div>
                <div class="timeslot-manager-body" style="display: ${isExpanded ? 'block' : 'none'};">
                    ${Config.DAYS.filter(day => day !== 'Arranged').map(day => {
                        const timeslots = sd.timeslots[day] || [];
                        const overlaps = Helpers.findOverlappingTimeslots(timeslots);
                        const overlappingSet = new Set();
                        overlaps.forEach(([a, b]) => { overlappingSet.add(a); overlappingSet.add(b); });

                        return `
                            <div class="timeslot-day-section">
                                <h5>${day}</h5>
                                ${timeslots.length > 0 ? `
                                    <div class="timeslots-editable-list">
                                        ${timeslots.map(ts => {
                                            const [start, end] = ts.split('-');
                                            const isOverlap = overlappingSet.has(ts);
                                            return `
                                                <div class="timeslot-editable ${isOverlap ? 'timeslot-overlap' : ''}">
                                                    <input type="time" value="${start}"
                                                        data-action="timeslot-edit-start" data-day="${day}" data-ts="${ts}" data-end="${end}">
                                                    <span class="timeslot-separator">&mdash;</span>
                                                    <input type="time" value="${end}"
                                                        data-action="timeslot-edit-end" data-day="${day}" data-ts="${ts}" data-start="${start}">
                                                    ${isOverlap ? '<span class="overlap-warning" title="This time slot overlaps with another">⚠️</span>' : ''}
                                                    <button class="timeslot-remove"
                                                            data-action="timeslot-remove" data-day="${day}" data-timeslot="${ts}">&times;</button>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                ` : ''}
                                <div class="timeslot-add-row">
                                    <input type="time" id="shared-startTime-${day}">
                                    <span class="timeslot-separator">&mdash;</span>
                                    <input type="time" id="shared-endTime-${day}">
                                    <button data-action="timeslot-add" data-day="${day}">Add</button>
                                    ${day === 'Monday' && timeslots.length > 0 ? `
                                        <button data-action="timeslot-copy" data-day="Monday" style="background: var(--color-success);">Copy to All</button>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
}
