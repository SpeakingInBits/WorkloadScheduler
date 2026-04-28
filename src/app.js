import { dataStore } from './data/DataStore.js';
import { ScheduleManager } from './managers/ScheduleManager.js';
import { ProgramManager } from './managers/ProgramManager.js';
import { InstructorManager } from './managers/InstructorManager.js';
import { CourseManager } from './managers/CourseManager.js';
import { ClassroomManager } from './managers/ClassroomManager.js';
import { TimeslotManager } from './managers/TimeslotManager.js';
import { ValidationService } from './utils/Validation.js';
import { ImportExportService } from './utils/ImportExport.js';
import { UIStateController } from './ui/UIStateController.js';
import { ScheduleGridManager } from './ui/ScheduleGrid.js';
import { DragDropController } from './ui/DragDropController.js';
import { ModalManager } from './ui/ModalManager.js';
import { CohortSummaryView } from './ui/CohortSummaryView.js';
import { Renderer } from './ui/Renderer.js';

class App {
    #renderer;
    #scheduleManager;
    #programManager;
    #instructorManager;
    #courseManager;
    #classroomManager;
    #timeslotManager;
    #validation;
    #importExport;
    #uiState;
    #scheduleGrid;
    #dragDrop;
    #modals;
    #cohortSummary;

    constructor() {
        // ── Renderer — must exist before managers so callbacks can reference it ──
        // Construct with a temporary callbacks object, then fill it in after.
        // We use a deferred callback pattern so that circular references are avoided.
        const rendererCallbacks = {
            isScheduled: null,
            hasInPersonConflict: null,
            getWorkload: null,
            validate: null,
        };

        this.#renderer = new Renderer(dataStore, {
            isScheduled: (id) => rendererCallbacks.isScheduled(id),
            hasInPersonConflict: (day, ts) => rendererCallbacks.hasInPersonConflict(day, ts),
            getWorkload: (id) => rendererCallbacks.getWorkload(id),
            validate: () => rendererCallbacks.validate(),
        });

        // ── Shared onUpdate callback ──
        const onUpdate = () => this.#renderer.render();
        const onRenderSchedule = () => this.#renderer.renderSchedule();
        const onRenderCourses = () => this.#renderer.renderCourses();

        // ── UIState ──
        this.#uiState = new UIStateController(dataStore, {
            renderSchedule: onRenderSchedule,
            renderCourses: onRenderCourses,
        });

        // ── Validation ──
        this.#validation = new ValidationService(dataStore);

        // ── Managers ──
        this.#scheduleManager = new ScheduleManager(dataStore, {
            render: onUpdate,
            renderValidationSummary: () => this.#renderer.renderValidationSummary(),
        });

        this.#programManager = new ProgramManager(dataStore, onUpdate);
        this.#instructorManager = new InstructorManager(dataStore, onUpdate);
        this.#courseManager = new CourseManager(dataStore, this.#uiState, onUpdate);
        this.#classroomManager = new ClassroomManager(dataStore, onUpdate);

        this.#timeslotManager = new TimeslotManager(dataStore, {
            render: onUpdate,
            renderTimeslotManager: () => this.#renderer.renderTimeslotManager(),
        });

        // ── Schedule Grid ──
        this.#scheduleGrid = new ScheduleGridManager(dataStore, onUpdate);

        // ── Drag & Drop ──
        this.#modals = null; // forward reference — assigned after modal is created
        this.#dragDrop = new DragDropController(
            dataStore,
            this.#scheduleGrid,
            () => this.#modals.showModality()
        );

        // ── Modals ──
        this.#modals = new ModalManager(
            dataStore,
            this.#uiState,
            this.#scheduleGrid,
            this.#dragDrop,
            onUpdate
        );

        // ── Import/Export ──
        this.#importExport = new ImportExportService(dataStore, {
            onUpdate,
            renderSelector: () => this.#scheduleManager.renderSelector(),
        });

        // ── Cohort Summary ──
        this.#cohortSummary = new CohortSummaryView(dataStore);

        // ── Fill in renderer callbacks now that all managers exist ──
        rendererCallbacks.isScheduled = (id) => this.#courseManager.isScheduled(id);
        rendererCallbacks.hasInPersonConflict = (day, ts) => this.#courseManager.hasInPersonConflict(day, ts);
        rendererCallbacks.getWorkload = (id) => this.#instructorManager.getWorkload(id);
        rendererCallbacks.validate = () => this.#validation.validate();
    }

    init() {
        dataStore.load();
        this._initializeEventListeners();
        this.#scheduleManager.renderSelector();
        this.#renderer.render();
        this.#uiState.restoreCollapsedSections();
    }

    _initializeEventListeners() {
        // ── Form submissions ──
        document.getElementById('addProgramForm').addEventListener('submit', e => {
            e.preventDefault();
            this.#programManager.add();
        });
        document.getElementById('addInstructorForm').addEventListener('submit', e => {
            e.preventDefault();
            this.#instructorManager.add();
        });
        document.getElementById('addCourseForm').addEventListener('submit', e => {
            e.preventDefault();
            this.#courseManager.add();
        });
        document.getElementById('addClassroomForm').addEventListener('submit', e => {
            e.preventDefault();
            this.#classroomManager.add();
        });

        // ── Schedule selector ──
        document.getElementById('scheduleSelect').addEventListener('change', () => {
            this.#scheduleManager.switchTo();
        });
        document.getElementById('scheduleQuarter').addEventListener('change', () => {
            this.#scheduleManager.updateQuarter();
        });
        document.getElementById('newScheduleBtn').addEventListener('click', () => {
            this.#scheduleManager.create();
        });
        document.getElementById('renameScheduleBtn').addEventListener('click', () => {
            this.#scheduleManager.rename();
        });
        document.getElementById('deleteScheduleBtn').addEventListener('click', () => {
            this.#scheduleManager.deleteCurrent();
        });

        // ── Import/Export ──
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.#importExport.exportSchedule();
        });
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        document.getElementById('fileInput').addEventListener('change', e => {
            this.#importExport.importSchedule(e);
        });

        // ── Help ──
        document.getElementById('helpIcon').addEventListener('click', () => {
            this.#modals.showHelp();
        });

        // ── Cohort Summary ──
        document.getElementById('cohortSummaryBtn').addEventListener('click', () => {
            this.#cohortSummary.show();
        });

        // ── Section collapse toggles ──
        ['programs', 'instructors', 'courses', 'classrooms'].forEach(section => {
            const header = document.querySelector(`[data-toggle-section="${section}"]`);
            if (header) {
                header.addEventListener('click', () => this.#uiState.toggleSection(section));
            }
        });

        // ── Instructor filter ──
        const filterToggle = document.querySelector('.filter-toggle');
        if (filterToggle) {
            filterToggle.addEventListener('click', (e) => this.#uiState.toggleInstructorFilter(e));
        }

        // ── Program filter ──
        const programFilterSelect = document.getElementById('programFilterSelect');
        if (programFilterSelect) {
            programFilterSelect.addEventListener('change', () => this.#uiState.updateProgramFilter());
        }

        // ── Quarters offered dropdowns ──
        document.querySelectorAll('[data-toggle-quarters]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const context = btn.dataset.toggleQuarters;
                this.#uiState.toggleQuartersOffered(e, context);
            });
        });

        // ── Modal close buttons ──
        document.querySelector('.close-modal')?.addEventListener('click', () => this.#modals.closeCourse());
        document.querySelector('.close-instructor-modal')?.addEventListener('click', () => this.#modals.closeInstructor());
        document.querySelector('.close-cohort-modal')?.addEventListener('click', () => this.#cohortSummary.close());
        document.querySelector('.close-help-modal')?.addEventListener('click', () => this.#modals.closeHelp());

        // ── Modality modal buttons ──
        document.getElementById('modalityModal')?.querySelectorAll('[data-modality]').forEach(btn => {
            btn.addEventListener('click', () => this.#modals.selectModality(btn.dataset.modality));
        });
        document.querySelector('.close-modality-modal')?.addEventListener('click', () => this.#modals.closeModality());

        // ── Edit course form ──
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
            const quartersOffered = this.#uiState.getQuartersOfferedFromCheckboxes('edit');
            const section = document.getElementById('editCourseSection')?.value.trim() || '';

            if (credits) {
                this.#modals.saveCourseChanges(
                    courseId, name, credits, instructorId || null,
                    classroomId, day, timeslot, modality, courseIndex,
                    quarterTaken, programId, courseNumber, quartersOffered, section
                );
            }
        });

        // ── Edit instructor form ──
        document.getElementById('editInstructorForm').addEventListener('submit', e => {
            e.preventDefault();
            const modal = document.getElementById('instructorModal');
            const instructorId = modal.dataset.instructorId;
            const name = document.getElementById('editInstructorName').value.trim();
            const color = document.getElementById('editInstructorColor').value;
            if (name) {
                this.#modals.saveInstructorChanges(instructorId, name, color);
            }
        });

        // ── Validation toggle ──
        document.getElementById('validationSummary')?.querySelector('.validation-header')
            ?.addEventListener('click', () => this.#validation.toggle());

        // ── Global event delegation ──
        document.addEventListener('click', e => this._handleDelegatedClick(e));
        document.addEventListener('dblclick', e => this._handleDelegatedDblclick(e));
        document.addEventListener('dragstart', e => this._handleDragStart(e));
        document.addEventListener('dragend', e => this._handleDragEnd(e));
        document.addEventListener('dragover', e => this._handleDragOver(e));
        document.addEventListener('dragleave', e => this._handleDragLeave(e));
        document.addEventListener('drop', e => this._handleDrop(e));
        document.addEventListener('change', e => this._handleDelegatedChange(e));

        // ── Close dropdowns on outside click ──
        document.addEventListener('click', e => {
            const filterList = document.getElementById('instructorFilterList');
            const filterToggleEl = document.querySelector('.filter-toggle');
            if (filterList && filterToggleEl &&
                !filterToggleEl.contains(e.target) && !filterList.contains(e.target)) {
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

        // ── Close modals on backdrop click ──
        window.addEventListener('click', e => {
            if (e.target.id === 'courseModal') this.#modals.closeCourse();
            if (e.target.id === 'modalityModal') this.#modals.closeModality();
            if (e.target.id === 'instructorModal') this.#modals.closeInstructor();
            if (e.target.id === 'cohortSummaryModal') this.#cohortSummary.close();
            if (e.target.id === 'helpModal') this.#modals.closeHelp();
        });
    }

    // ── Event delegation handlers ──

    _handleDelegatedClick(e) {
        // Stop propagation on delete buttons so the parent dblclick doesn't fire
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const { action, id } = btn.dataset;

        switch (action) {
            case 'program-remove':
                e.stopPropagation();
                this.#programManager.remove(id);
                break;
            case 'instructor-remove':
                e.stopPropagation();
                this.#instructorManager.remove(id);
                break;
            case 'course-remove':
                e.stopPropagation();
                this.#courseManager.remove(id);
                break;
            case 'classroom-remove':
                this.#classroomManager.remove(id);
                break;
            case 'classroom-toggle':
                this.#classroomManager.toggle(id);
                break;
            case 'unschedule': {
                e.stopPropagation();
                const { classroom, day, timeslot, index } = btn.dataset;
                this.#scheduleGrid.unschedule(classroom, day, timeslot, parseInt(index));
                break;
            }
            case 'timeslot-toggle':
                this.#timeslotManager.togglePanel();
                break;
            case 'timeslot-remove': {
                const { day, timeslot } = btn.dataset;
                this.#timeslotManager.remove(day, timeslot);
                break;
            }
            case 'timeslot-add': {
                const { day } = btn.dataset;
                this.#timeslotManager.addFromForm(day);
                break;
            }
            case 'timeslot-copy': {
                const { day } = btn.dataset;
                this.#timeslotManager.copyToAllDays(day);
                break;
            }
            case 'instructor-filter': {
                const { id: instrId } = btn.dataset;
                this.#uiState.updateInstructorFilter(instrId, btn.checked);
                break;
            }
        }
    }

    _handleDelegatedDblclick(e) {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const { action, id } = el.dataset;

        switch (action) {
            case 'program-edit':
                this.#programManager.showEditPrompt(id);
                break;
            case 'instructor-edit':
                this.#modals.showInstructor(id);
                break;
            case 'course-edit-list':
                this.#modals.showCourseFromList(id);
                break;
            case 'edit-scheduled': {
                const { course, classroom, day, timeslot, index } = el.dataset;
                this.#modals.showCourse(course, classroom, day, timeslot, parseInt(index));
                break;
            }
        }
    }

    _handleDragStart(e) {
        const el = e.target.closest('[data-drag-course-id]');
        if (el) {
            this.#dragDrop.handleStart(e, el.dataset.dragCourseId);
        }
    }

    _handleDragEnd(e) {
        const el = e.target.closest('[data-drag-course-id]');
        if (el) {
            this.#dragDrop.handleEnd(e);
        }
    }

    _handleDragOver(e) {
        const slot = e.target.closest('[data-droppable]');
        if (slot) {
            this.#dragDrop.handleOver({ ...e, currentTarget: slot });
        }
    }

    _handleDragLeave(e) {
        const slot = e.target.closest('[data-droppable]');
        if (slot && !slot.contains(e.relatedTarget)) {
            this.#dragDrop.handleLeave({ ...e, currentTarget: slot });
        }
    }

    _handleDrop(e) {
        const slot = e.target.closest('[data-droppable]');
        if (slot) {
            const { classroom, day, timeslot } = slot.dataset;
            this.#dragDrop.handleDrop(
                { ...e, currentTarget: slot, preventDefault: () => e.preventDefault() },
                classroom, day, timeslot
            );
        }
    }

    _handleDelegatedChange(e) {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const { action } = el.dataset;

        if (action === 'timeslot-edit-start') {
            const { day, ts, end } = el.dataset;
            this.#timeslotManager.edit(day, ts, el.value, end);
        } else if (action === 'timeslot-edit-end') {
            const { day, ts, start } = el.dataset;
            this.#timeslotManager.edit(day, ts, start, el.value);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new App().init());
