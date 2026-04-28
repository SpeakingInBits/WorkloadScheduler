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

        const instructorSelect = document.getElementById('editCourseInstructor');
        instructorSelect.innerHTML = '<option value="">Select Instructor (Optional)</option>' +
            d.instructors.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
        const instrKey = Helpers.getCourseInstructorKey(courseId, currentSection);
        instructorSelect.value = sd.courseInstructors[instrKey] || '';

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

        const instructorSelect = document.getElementById('editCourseInstructor');
        instructorSelect.innerHTML = '<option value="">Select Instructor (Optional)</option>' +
            d.instructors.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
        instructorSelect.value = sd.courseInstructors[courseId] || '';

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

    saveCourseChanges(courseId, name, credits, instructorId, classroomId, day, timeslot, modality, courseIndex, quarterTaken, programId, courseNumber, quartersOffered, section) {
        const d = this.#dataStore.data;
        const course = d.courseCatalog.find(c => c.id === courseId);
        if (!course) return;

        course.name = name || '';
        course.credits = parseInt(credits);
        course.quarterTaken = quarterTaken || null;
        course.programId = programId || null;
        course.courseNumber = courseNumber || '';
        course.quartersOffered = quartersOffered || [];

        const currentSection = section || '';
        const sd = this.#dataStore.getCurrentSchedule();
        const instrKey = Helpers.getCourseInstructorKey(courseId, currentSection);
        if (instructorId) {
            sd.courseInstructors[instrKey] = instructorId;
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
