import { DataStore } from '../../../src/data/DataStore.js';
import { CourseManager } from '../../../src/managers/CourseManager.js';

let ds;
let manager;
const onUpdateSpy = vi.fn();

// Minimal uiState stub
const uiState = {
    getQuartersOfferedFromCheckboxes: vi.fn().mockReturnValue([]),
    setQuartersOfferedCheckboxes: vi.fn(),
};

beforeEach(() => {
    ds = new DataStore();
    manager = new CourseManager(ds, uiState, onUpdateSpy);
    onUpdateSpy.mockClear();
    uiState.getQuartersOfferedFromCheckboxes.mockReturnValue([]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function stubCourseForm({ name = 'Math', number = '101', credits = '3', programId = '', quarterTaken = '' } = {}) {
    document.body.innerHTML = `
        <input id="courseName" value="${name}" />
        <input id="courseNumber" value="${number}" />
        <input id="courseCredits" value="${credits}" />
        <select id="courseProgram"><option value="${programId}" selected></option></select>
        <input id="courseQuarterTaken" value="${quarterTaken}" />
    `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('CourseManager', () => {
    describe('add', () => {
        it('adds a course when form is filled', () => {
            stubCourseForm({ name: 'Algebra', number: '201', credits: '4' });
            manager.add();
            expect(ds.data.courseCatalog).toHaveLength(1);
            expect(ds.data.courseCatalog[0].name).toBe('Algebra');
        });

        it('does not add when credits are missing', () => {
            stubCourseForm({ name: 'Bad Course', credits: '' });
            manager.add();
            expect(ds.data.courseCatalog).toHaveLength(0);
        });

        it('calls onUpdate after adding', () => {
            stubCourseForm({ name: 'Chemistry' });
            manager.add();
            expect(onUpdateSpy).toHaveBeenCalled();
        });

        it('assigns quartersOffered from uiState', () => {
            uiState.getQuartersOfferedFromCheckboxes.mockReturnValue(['Fall', 'Spring']);
            stubCourseForm({ name: 'Biology' });
            manager.add();
            expect(ds.data.courseCatalog[0].quartersOffered).toEqual(['Fall', 'Spring']);
        });
    });

    describe('remove', () => {
        it('removes the course with matching id', () => {
            ds.data.courseCatalog.push({ id: 'c1', name: 'History', credits: 3 });
            manager.remove('c1');
            expect(ds.data.courseCatalog).toHaveLength(0);
        });

        it('calls onUpdate after removing', () => {
            ds.data.courseCatalog.push({ id: 'c1', name: 'History', credits: 3 });
            manager.remove('c1');
            expect(onUpdateSpy).toHaveBeenCalled();
        });
    });

    describe('isScheduled', () => {
        it('returns false when course is not in any slot', () => {
            expect(manager.isScheduled('c1')).toBe(false);
        });

        it('returns true when course is in a slot', () => {
            const sd = ds.getCurrentSchedule();
            const rId = 'r1';
            sd.classrooms.push({ id: rId, roomNumber: '101', visible: true });
            sd.schedule[rId] = {
                Monday: { '09:00-10:00': [{ courseId: 'c1', modality: 'in-person', section: '' }] }
            };
            expect(manager.isScheduled('c1')).toBe(true);
        });
    });

    describe('hasInPersonConflict', () => {
        it('returns false when no in-person courses are in the slot', () => {
            expect(manager.hasInPersonConflict('Monday', '09:00-10:00')).toBe(false);
        });

        it('returns false with only one in-person course in the slot', () => {
            const sd = ds.getCurrentSchedule();
            const rId = 'r1';
            sd.classrooms.push({ id: rId, roomNumber: '101', visible: true });
            sd.schedule[rId] = {
                Monday: { '09:00-10:00': [{ courseId: 'c1', modality: 'in-person', section: '' }] }
            };
            expect(manager.hasInPersonConflict('Monday', '09:00-10:00')).toBe(false);
        });

        it('returns true when two in-person courses occupy the same slot', () => {
            const sd = ds.getCurrentSchedule();
            const rId = 'r1';
            sd.classrooms.push({ id: rId, roomNumber: '101', visible: true });
            sd.schedule[rId] = {
                Monday: { '09:00-10:00': [
                    { courseId: 'c1', modality: 'in-person', section: '' },
                    { courseId: 'c2', modality: 'in-person', section: '' }
                ] }
            };
            expect(manager.hasInPersonConflict('Monday', '09:00-10:00')).toBe(true);
        });

        it('returns false for online courses in the same slot', () => {
            const sd = ds.getCurrentSchedule();
            const rId = 'r1';
            sd.classrooms.push({ id: rId, roomNumber: '101', visible: true });
            sd.schedule[rId] = {
                Monday: { '09:00-10:00': [
                    { courseId: 'c1', modality: 'online', section: '' },
                    { courseId: 'c2', modality: 'online', section: '' }
                ] }
            };
            expect(manager.hasInPersonConflict('Monday', '09:00-10:00')).toBe(false);
        });
    });
});
