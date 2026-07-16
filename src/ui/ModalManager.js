import { Config } from '../config.js';
import { Helpers } from '../utils/Helpers.js';

export class ModalManager {
    #dataStore;
    #uiState;
    #scheduleGrid;
    #dragDrop;
    #onUpdate;

    /**
     * @param {import('../data/DataStore.js').DataStore} dataStore
     * @param {import('./UIStateController.js').UIStateController} uiState
     * @param {import('./ScheduleGrid.js').ScheduleGridManager} scheduleGrid
     * @param {import('./DragDropController.js').DragDropController} dragDrop
     * @param {() => void} onUpdate
     */
    constructor(dataStore, uiState, scheduleGrid, dragDrop, onUpdate) {
        this.#dataStore = dataStore;
        this.#uiState = uiState;
        this.#scheduleGrid = scheduleGrid;
        this.#dragDrop = dragDrop;
        this.#onUpdate = onUpdate;
    }

    // ── Modality Modal ──

    showModality() {
        document.getElementById('modalityModal').style.display = 'block';
    }

    selectModality(modality) {
        if (this.#dragDrop._pendingDrop) {
            const sectionInput = document.getElementById('modalitySectionInput');
            const section = sectionInput ? sectionInput.value.trim() : '';
            const drop = this.#dragDrop._pendingDrop;
            this.#scheduleGrid.schedule(drop.classroomId, drop.day, drop.time, drop.courseId, modality, section);
            this.#dragDrop._pendingDrop = null;
        }
        this.closeModality();
    }

    closeModality() {
        document.getElementById('modalityModal').style.display = 'none';
        const sectionInput = document.getElementById('modalitySectionInput');
        if (sectionInput) sectionInput.value = '';
        this.#dragDrop._pendingDrop = null;
    }

    // ── Help Modal ──

    showHelp() {
        document.getElementById('helpModal').style.display = 'block';
    }

    closeHelp() {
        document.getElementById('helpModal').style.display = 'none';
    }

    // ── Course Edit Modal (from grid) ──

    showCourse(courseId, classroomId, day, timeslot, courseIndex) {
        const d = this.#dataStore.data;
        const course = d.courseCatalog.find(c => c.id === courseId);
        if (!course) return;

        const sd = this.#dataStore.getCurrentSchedule();

        const programSelect = document.getElementById('editCourseProgram');
        programSelect.innerHTML = '<option value="">Select Program</option>' +
            d.programs.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        programSelect.value = course.programId || '';

        document.getElementById('editCourseNumber').value = course.courseNumber || '';
        document.getElementById('editCourseName').value = course.name || '';
        document.getElementById('editCourseCredits').value = course.credits;
        const quarterInput = document.getElementById('editCourseQuarterTaken');
        if (quarterInput) quarterInput.value = course.quarterTaken || '';

        this.#uiState.setQuartersOfferedCheckboxes('edit', course.quartersOffered || []);

        const modalityGroup = document.getElementById('editModality').closest('.form-group');
        if (modalityGroup) modalityGroup.style.display = 'block';

        const slotData = d.schedule[classroomId]?.[day]?.[timeslot];
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

        const sectionGroup = document.getElementById('editCourseSection')?.closest('.form-group');
        if (sectionGroup) sectionGroup.style.display = 'block';
        const sectionInput = document.getElementById('editCourseSection');
        if (sectionInput) sectionInput.value = currentSection;

        const assignments = Helpers.getInstructorAssignments(sd, courseId, currentSection);
        this._renderInstructorRows(assignments);

        const modal = document.getElementById('courseModal');
        modal.style.display = 'block';
        modal.dataset.courseId = courseId;
        modal.dataset.classroomId = classroomId;
        modal.dataset.day = day;
        modal.dataset.timeslot = timeslot;
        modal.dataset.courseIndex = courseIndex !== undefined ? courseIndex : '';
    }

    // ── Course Edit Modal (from sidebar list) ──

    showCourseFromList(courseId) {
        const d = this.#dataStore.data;
        const course = d.courseCatalog.find(c => c.id === courseId);
        if (!course) return;

        const sd = this.#dataStore.getCurrentSchedule();

        const programSelect = document.getElementById('editCourseProgram');
        programSelect.innerHTML = '<option value="">Select Program</option>' +
            d.programs.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        programSelect.value = course.programId || '';

        document.getElementById('editCourseNumber').value = course.courseNumber || '';
        document.getElementById('editCourseName').value = course.name || '';
        document.getElementById('editCourseCredits').value = course.credits;
        const quarterInput = document.getElementById('editCourseQuarterTaken');
        if (quarterInput) quarterInput.value = course.quarterTaken || '';

        this.#uiState.setQuartersOfferedCheckboxes('edit', course.quartersOffered || []);

        // Hide modality and section fields when editing from list
        const modalityGroup = document.getElementById('editModality').closest('.form-group');
        if (modalityGroup) modalityGroup.style.display = 'none';
        const sectionGroup = document.getElementById('editCourseSection')?.closest('.form-group');
        if (sectionGroup) sectionGroup.style.display = 'none';

        const assignments = Helpers.getInstructorAssignments(sd, courseId, '');
        this._renderInstructorRows(assignments);

        const modal = document.getElementById('courseModal');
        modal.style.display = 'block';
        modal.dataset.courseId = courseId;
        modal.dataset.classroomId = '';
        modal.dataset.day = '';
        modal.dataset.timeslot = '';
        modal.dataset.courseIndex = '';
    }

    closeCourse() {
        document.getElementById('courseModal').style.display = 'none';
    }

    saveCourseChanges(courseId, name, credits, classroomId, day, timeslot, modality, courseIndex, quarterTaken, programId, courseNumber, quartersOffered, section) {
        const d = this.#dataStore.data;
        const course = d.courseCatalog.find(c => c.id === courseId);
        if (!course) return;

        const courseCredits = parseFloat(credits);
        const assignments = this._readInstructorRows();

        // Enforced split: any assigned instructors must share exactly the
        // course's total credits, and no instructor may appear twice.
        const ids = assignments.map(a => a.instructorId);
        if (new Set(ids).size !== ids.length) {
            alert('Each instructor can only be listed once for this section.');
            return;
        }
        if (assignments.length > 0) {
            const assigned = assignments.reduce((sum, a) => sum + a.credits, 0);
            if (Math.abs(assigned - courseCredits) > 0.001) {
                alert(
                    `Instructor credits must add up to the course total.\n` +
                    `Assigned: ${Helpers.formatCredits(assigned)} — Course total: ${Helpers.formatCredits(courseCredits)}`
                );
                return;
            }
        }

        course.name = name || '';
        course.credits = courseCredits;
        course.quarterTaken = quarterTaken || null;
        course.programId = programId || null;
        course.courseNumber = courseNumber || '';
        course.quartersOffered = quartersOffered || [];

        const currentSection = section || '';
        const sd = this.#dataStore.getCurrentSchedule();
        const instrKey = Helpers.getCourseInstructorKey(courseId, currentSection);
        if (assignments.length > 0) {
            sd.courseInstructors[instrKey] = assignments;
        } else {
            delete sd.courseInstructors[instrKey];
        }

        if (classroomId && day && timeslot) {
            const slotData = d.schedule[classroomId]?.[day]?.[timeslot];
            if (Array.isArray(slotData) && courseIndex !== undefined && courseIndex !== '') {
                const idx = parseInt(courseIndex);
                if (modality) slotData[idx].modality = modality;
                slotData[idx].section = currentSection;
            } else if (slotData && !Array.isArray(slotData)) {
                if (modality) slotData.modality = modality;
                slotData.section = currentSection;
            }
        }

        this.#dataStore.save();
        this.#onUpdate();
        this.closeCourse();
    }

    // ── Instructor / credit-split rows (Course Edit Modal) ──

    _instructorOptions(selectedId) {
        const d = this.#dataStore.data;
        return '<option value="">Select Instructor</option>' +
            d.instructors.map(i =>
                `<option value="${i.id}" ${i.id === selectedId ? 'selected' : ''}>${i.name}</option>`
            ).join('');
    }

    _instructorRowHTML(instructorId = '', credits = '') {
        const creditsVal = (credits === null || credits === undefined) ? '' : credits;
        return `
            <div class="instructor-row">
                <select class="instructor-row-select" data-action="instructor-row-change">
                    ${this._instructorOptions(instructorId)}
                </select>
                <input type="number" class="instructor-row-credits" data-action="instructor-row-change"
                       step="0.5" min="0" value="${creditsVal}" placeholder="Credits">
                <button type="button" class="instructor-row-remove"
                        data-action="remove-instructor-row" title="Remove instructor">&times;</button>
            </div>
        `;
    }

    _renderInstructorRows(assignments) {
        const container = document.getElementById('editInstructorRows');
        if (!container) return;
        container.innerHTML = (assignments || [])
            .map(a => this._instructorRowHTML(a.instructorId, a.credits))
            .join('');
        this.updateCreditsSummary();
    }

    addInstructorRow() {
        const container = document.getElementById('editInstructorRows');
        if (!container) return;
        // Default the new row's credits to whatever is still unassigned.
        const courseCredits = parseFloat(document.getElementById('editCourseCredits').value) || 0;
        const assigned = this._readInstructorRows().reduce((sum, a) => sum + a.credits, 0);
        const remaining = Math.max(0, parseFloat((courseCredits - assigned).toFixed(2)));
        container.insertAdjacentHTML('beforeend', this._instructorRowHTML('', remaining || ''));
        this.updateCreditsSummary();
    }

    removeInstructorRow(rowEl) {
        if (rowEl) rowEl.remove();
        this.updateCreditsSummary();
    }

    _readInstructorRows() {
        const container = document.getElementById('editInstructorRows');
        if (!container) return [];
        return Array.from(container.querySelectorAll('.instructor-row'))
            .map(row => {
                const instructorId = row.querySelector('.instructor-row-select').value;
                const credits = parseFloat(row.querySelector('.instructor-row-credits').value) || 0;
                return { instructorId, credits };
            })
            .filter(a => a.instructorId);
    }

    updateCreditsSummary() {
        const summary = document.getElementById('instructorCreditsSummary');
        if (!summary) return;

        const assignments = this._readInstructorRows();
        if (assignments.length === 0) {
            summary.textContent = 'No instructors assigned (optional).';
            summary.className = 'credits-summary';
            return;
        }

        const courseCredits = parseFloat(document.getElementById('editCourseCredits').value) || 0;
        const assigned = assignments.reduce((sum, a) => sum + a.credits, 0);
        const balanced = Math.abs(assigned - courseCredits) <= 0.001;
        summary.textContent = balanced
            ? `Assigned ${Helpers.formatCredits(assigned)} of ${Helpers.formatCredits(courseCredits)} credits ✓`
            : `Assigned ${Helpers.formatCredits(assigned)} of ${Helpers.formatCredits(courseCredits)} credits — must total ${Helpers.formatCredits(courseCredits)}`;
        summary.className = `credits-summary ${balanced ? 'credits-summary-ok' : 'credits-summary-error'}`;
    }

    // ── Instructor Edit Modal ──

    showInstructor(instructorId) {
        const instructor = this.#dataStore.data.instructors.find(i => i.id === instructorId);
        if (!instructor) return;

        document.getElementById('editInstructorName').value = instructor.name;
        document.getElementById('editInstructorColor').value = instructor.color || Config.DEFAULT_COLOR;

        const modal = document.getElementById('instructorModal');
        modal.style.display = 'block';
        modal.dataset.instructorId = instructorId;
    }

    closeInstructor() {
        document.getElementById('instructorModal').style.display = 'none';
    }

    saveInstructorChanges(instructorId, name, color) {
        const instructor = this.#dataStore.data.instructors.find(i => i.id === instructorId);
        if (instructor) {
            instructor.name = name;
            instructor.color = color || Config.DEFAULT_COLOR;
            this.#dataStore.save();
            this.#onUpdate();
            this.closeInstructor();
        }
    }
}
