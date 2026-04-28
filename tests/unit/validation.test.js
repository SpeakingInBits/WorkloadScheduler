import { DataStore } from '../../src/data/DataStore.js';
import { ValidationService } from '../../src/utils/Validation.js';

let ds;
let validation;

beforeEach(() => {
    ds = new DataStore();
    validation = new ValidationService(ds);

    // Set up a schedule with a quarter so we don't get spurious "missing quarter" errors
    ds.getCurrentSchedule().quarter = 'Fall';
});

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers to populate data
// ─────────────────────────────────────────────────────────────────────────────

function addProgram(name = 'CPW') {
    const id = Date.now().toString() + Math.random();
    ds.data.programs.push({ id, name });
    return id;
}

function addInstructor(name = 'Prof. Smith', color = '#3498db') {
    const id = Date.now().toString() + Math.random();
    ds.data.instructors.push({ id, name, color });
    return id;
}

function addCourse({ name = 'Math', credits = 3, programId = null, courseNumber = '101', quarterTaken = null, quartersOffered = [] } = {}) {
    const id = Date.now().toString() + Math.random();
    ds.data.courseCatalog.push({ id, name, credits, programId, courseNumber, quarterTaken, quartersOffered });
    return id;
}

function addClassroom(roomNumber = '101') {
    const id = Date.now().toString() + Math.random();
    const sd = ds.getCurrentSchedule();
    sd.classrooms.push({ id, roomNumber, visible: true });
    sd.schedule[id] = { Monday: {}, Tuesday: {}, Wednesday: {}, Thursday: {}, Friday: {}, Arranged: {} };
    return id;
}

function scheduleItem(classroomId, day, timeslot, courseId, modality = 'in-person', section = '') {
    const sd = ds.getCurrentSchedule();
    if (!sd.schedule[classroomId]) sd.schedule[classroomId] = {};
    if (!sd.schedule[classroomId][day]) sd.schedule[classroomId][day] = {};
    if (!sd.schedule[classroomId][day][timeslot]) sd.schedule[classroomId][day][timeslot] = [];
    sd.schedule[classroomId][day][timeslot].push({ courseId, modality, section });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ValidationService', () => {
    describe('validate — missing quarter', () => {
        it('reports error when schedule has no quarter', () => {
            ds.getCurrentSchedule().quarter = '';
            const errors = validation.validate();
            expect(errors.some(e => e.type === 'quarter')).toBe(true);
        });

        it('reports no quarter error when quarter is set', () => {
            const errors = validation.validate();
            expect(errors.filter(e => e.type === 'quarter')).toHaveLength(0);
        });
    });

    describe('validate — missing program', () => {
        it('reports error for scheduled course with no program', () => {
            const cId = addCourse({ programId: null });
            const rId = addClassroom();
            scheduleItem(rId, 'Monday', '09:00-10:00', cId);

            const errors = validation.validate();
            expect(errors.some(e => e.type === 'program')).toBe(true);
        });

        it('no program error when course has a program', () => {
            const pId = addProgram();
            const cId = addCourse({ programId: pId });
            const rId = addClassroom();
            scheduleItem(rId, 'Monday', '09:00-10:00', cId);

            const errors = validation.validate();
            expect(errors.filter(e => e.type === 'program')).toHaveLength(0);
        });
    });

    describe('validate — quarter availability', () => {
        it('reports error when course is not offered in the schedule quarter', () => {
            const pId = addProgram();
            const cId = addCourse({ programId: pId, quartersOffered: ['Spring'] });
            const rId = addClassroom();
            scheduleItem(rId, 'Monday', '09:00-10:00', cId);
            ds.getCurrentSchedule().quarter = 'Fall';

            const errors = validation.validate();
            expect(errors.some(e => e.type === 'quarter')).toBe(true);
        });

        it('no quarter error when course is offered in the schedule quarter', () => {
            const pId = addProgram();
            const cId = addCourse({ programId: pId, quartersOffered: ['Fall'] });
            const rId = addClassroom();
            scheduleItem(rId, 'Monday', '09:00-10:00', cId);

            const errors = validation.validate();
            expect(errors.filter(e => e.type === 'quarter')).toHaveLength(0);
        });

        it('no quarter error when course has no quartersOffered restriction', () => {
            const pId = addProgram();
            const cId = addCourse({ programId: pId, quartersOffered: [] });
            const rId = addClassroom();
            scheduleItem(rId, 'Monday', '09:00-10:00', cId);

            const errors = validation.validate();
            expect(errors.filter(e => e.type === 'quarter')).toHaveLength(0);
        });
    });

    describe('validate — instructor conflicts', () => {
        it('reports error when one instructor has overlapping courses', () => {
            const iId = addInstructor();
            const pId = addProgram();
            const c1 = addCourse({ programId: pId });
            const c2 = addCourse({ programId: pId });
            const rId = addClassroom();

            scheduleItem(rId, 'Monday', '09:00-10:00', c1);
            scheduleItem(rId, 'Monday', '09:30-10:30', c2);

            const sd = ds.getCurrentSchedule();
            sd.courseInstructors[c1] = iId;
            sd.courseInstructors[c2] = iId;

            const errors = validation.validate();
            expect(errors.some(e => e.type === 'instructor')).toBe(true);
        });

        it('no instructor error when courses don\'t overlap', () => {
            const iId = addInstructor();
            const pId = addProgram();
            const c1 = addCourse({ programId: pId });
            const c2 = addCourse({ programId: pId });
            const rId = addClassroom();

            scheduleItem(rId, 'Monday', '08:00-09:00', c1);
            scheduleItem(rId, 'Monday', '09:00-10:00', c2);

            const sd = ds.getCurrentSchedule();
            sd.courseInstructors[c1] = iId;
            sd.courseInstructors[c2] = iId;

            const errors = validation.validate();
            expect(errors.filter(e => e.type === 'instructor')).toHaveLength(0);
        });

        it('ignores Arranged day for instructor conflicts', () => {
            const iId = addInstructor();
            const pId = addProgram();
            const c1 = addCourse({ programId: pId });
            const c2 = addCourse({ programId: pId });
            const rId = addClassroom();

            scheduleItem(rId, 'Arranged', 'arranged', c1);
            scheduleItem(rId, 'Arranged', 'arranged', c2);

            const sd = ds.getCurrentSchedule();
            sd.courseInstructors[c1] = iId;
            sd.courseInstructors[c2] = iId;

            const errors = validation.validate();
            expect(errors.filter(e => e.type === 'instructor')).toHaveLength(0);
        });
    });

    describe('validate — cohort conflicts', () => {
        it('reports error when two courses from the same cohort overlap', () => {
            const pId = addProgram();
            const c1 = addCourse({ programId: pId, quarterTaken: 'Q1' });
            const c2 = addCourse({ programId: pId, quarterTaken: 'Q1' });
            const rId = addClassroom();

            scheduleItem(rId, 'Tuesday', '10:00-11:00', c1);
            scheduleItem(rId, 'Tuesday', '10:30-11:30', c2);

            const errors = validation.validate();
            expect(errors.some(e => e.type === 'cohort')).toBe(true);
        });

        it('no cohort error when courses from same cohort don\'t overlap', () => {
            const pId = addProgram();
            const c1 = addCourse({ programId: pId, quarterTaken: 'Q1' });
            const c2 = addCourse({ programId: pId, quarterTaken: 'Q1' });
            const rId = addClassroom();

            scheduleItem(rId, 'Tuesday', '08:00-09:00', c1);
            scheduleItem(rId, 'Tuesday', '09:00-10:00', c2);

            const errors = validation.validate();
            expect(errors.filter(e => e.type === 'cohort')).toHaveLength(0);
        });

        it('no cohort error when courses are from different cohorts', () => {
            const pId = addProgram();
            const c1 = addCourse({ programId: pId, quarterTaken: 'Q1' });
            const c2 = addCourse({ programId: pId, quarterTaken: 'Q2' });
            const rId = addClassroom();

            scheduleItem(rId, 'Tuesday', '10:00-11:00', c1);
            scheduleItem(rId, 'Tuesday', '10:30-11:30', c2);

            const errors = validation.validate();
            expect(errors.filter(e => e.type === 'cohort')).toHaveLength(0);
        });
    });
});
