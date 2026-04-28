export class DragDropController {
    #dataStore;
    #scheduleGrid;
    #showModalityModal;

    /** Pending drop from the sidebar (before modality is selected). */
    _pendingDrop = null;

    /**
     * @param {import('../data/DataStore.js').DataStore} dataStore
     * @param {import('./ScheduleGrid.js').ScheduleGridManager} scheduleGrid
     * @param {() => void} showModalityModal
     */
    constructor(dataStore, scheduleGrid, showModalityModal) {
        this.#dataStore = dataStore;
        this.#scheduleGrid = scheduleGrid;
        this.#showModalityModal = showModalityModal;
    }

    handleStart(e, courseId) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('courseId', courseId);
        e.target.classList.add('dragging');

        const src = e.target.dataset;
        if (src.sourceClassroom && src.sourceDay && src.sourceTimeslot) {
            e.dataTransfer.setData('sourceClassroomId', src.sourceClassroom);
            e.dataTransfer.setData('sourceDay', src.sourceDay);
            e.dataTransfer.setData('sourceTimeslot', src.sourceTimeslot);
            e.dataTransfer.setData('sourceCourseIndex', src.sourceIndex || '');
            e.dataTransfer.setData('sourceSection', src.sourceSection || '');
        }
    }

    handleEnd(e) {
        e.target.classList.remove('dragging');
    }

    handleOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over');
    }

    handleLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    handleDrop(e, classroomId, day, time) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');

        const courseId = e.dataTransfer.getData('courseId');
        if (!courseId) return;

        const sourceClassroomId = e.dataTransfer.getData('sourceClassroomId');
        const sourceDay = e.dataTransfer.getData('sourceDay');
        const sourceTimeslot = e.dataTransfer.getData('sourceTimeslot');
        const sourceCourseIndex = e.dataTransfer.getData('sourceCourseIndex');
        const d = this.#dataStore.data;

        if (sourceClassroomId && sourceDay && sourceTimeslot) {
            // Moving from one grid slot to another
            const sourceSlot = d.schedule[sourceClassroomId]?.[sourceDay]?.[sourceTimeslot];
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
                this.#scheduleGrid.schedule(classroomId, day, time, courseId, modality, section);
                this.#scheduleGrid.unschedule(
                    sourceClassroomId, sourceDay, sourceTimeslot,
                    sourceCourseIndex !== '' ? parseInt(sourceCourseIndex) : 0
                );
            }
        } else {
            // New drop from sidebar — show modality modal
            this._pendingDrop = { classroomId, day, time, courseId };
            this.#showModalityModal();
        }
    }
}
