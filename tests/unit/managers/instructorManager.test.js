import { DataStore } from '../../../src/data/DataStore.js';
import { InstructorManager } from '../../../src/managers/InstructorManager.js';

let ds;
let manager;
const onUpdateSpy = vi.fn();

function setNameInput(value) {
    document.body.innerHTML = `<input id="instructorName" value="${value}" />`;
}

beforeEach(() => {
    ds = new DataStore();
    manager = new InstructorManager(ds, onUpdateSpy);
    onUpdateSpy.mockClear();
    document.body.innerHTML = '<input id="instructorName" value="" />';
});

describe('InstructorManager', () => {
    describe('add', () => {
        it('adds an instructor when name is provided', () => {
            setNameInput('Prof. Jones');
            manager.add();
            expect(ds.data.instructors).toHaveLength(1);
            expect(ds.data.instructors[0].name).toBe('Prof. Jones');
        });

        it('does not add when name input is blank', () => {
            setNameInput('');
            manager.add();
            expect(ds.data.instructors).toHaveLength(0);
        });

        it('does not add when name is only whitespace', () => {
            setNameInput('   ');
            manager.add();
            expect(ds.data.instructors).toHaveLength(0);
        });

        it('calls onUpdate after adding', () => {
            setNameInput('Prof. Jones');
            manager.add();
            expect(onUpdateSpy).toHaveBeenCalled();
        });

        it('adds multiple instructors independently', () => {
            setNameInput('First');
            manager.add();
            setNameInput('Second');
            manager.add();
            expect(ds.data.instructors).toHaveLength(2);
            expect(ds.data.instructors[0].name).toBe('First');
            expect(ds.data.instructors[1].name).toBe('Second');
        });
    });

    describe('remove', () => {
        it('removes the instructor with no assignments', () => {
            ds.data.instructors.push({ id: 'i1', name: 'To Remove', color: '#fff' });
            manager.remove('i1');
            expect(ds.data.instructors).toHaveLength(0);
        });

        it('does NOT remove when instructor has course assignments', () => {
            ds.data.instructors.push({ id: 'i1', name: 'Assigned Prof', color: '#fff' });
            const sd = ds.getCurrentSchedule();
            sd.courseInstructors['course1'] = 'i1';
            vi.spyOn(window, 'alert').mockImplementation(() => {});
            manager.remove('i1');
            expect(ds.data.instructors).toHaveLength(1);
        });

        it('calls onUpdate after removing', () => {
            ds.data.instructors.push({ id: 'i1', name: 'To Remove', color: '#fff' });
            manager.remove('i1');
            expect(onUpdateSpy).toHaveBeenCalled();
        });

        it('does NOT remove and shows alert when course assignments exist', () => {
            ds.data.instructors.push({ id: 'i1', name: 'Prof', color: '#fff' });
            const sd = ds.getCurrentSchedule();
            sd.courseInstructors['course1'] = 'i1';
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
            manager.remove('i1');
            expect(alertSpy).toHaveBeenCalled();
            expect(ds.data.instructors).toHaveLength(1);
        });
    });

    describe('getWorkload', () => {
        it('returns 0 credits when instructor has no assignments', () => {
            ds.data.instructors.push({ id: 'i1', name: 'Prof', color: '#fff' });
            expect(manager.getWorkload('i1')).toBe(0);
        });

        it('sums credits for all assigned courses', () => {
            ds.data.instructors.push({ id: 'i1', name: 'Prof', color: '#fff' });
            ds.data.courseCatalog.push({ id: 'c1', credits: 3 });
            ds.data.courseCatalog.push({ id: 'c2', credits: 4 });
            const sd = ds.getCurrentSchedule();
            sd.courseInstructors['c1'] = 'i1';
            sd.courseInstructors['c2'] = 'i1';
            const roomId = 'r1';
            sd.classrooms.push({ id: roomId, roomNumber: '101', visible: true });
            sd.schedule[roomId] = {
                Monday: { '09:00-10:00': [{ courseId: 'c1', modality: 'in-person', section: '' }] },
                Tuesday: { '09:00-10:00': [{ courseId: 'c2', modality: 'online', section: '' }] }
            };
            expect(manager.getWorkload('i1')).toBe(7);
        });

        it('does not double-count the same course scheduled multiple times', () => {
            ds.data.instructors.push({ id: 'i1', name: 'Prof', color: '#fff' });
            ds.data.courseCatalog.push({ id: 'c1', credits: 3 });
            const sd = ds.getCurrentSchedule();
            sd.courseInstructors['c1'] = 'i1';
            const roomId = 'r1';
            sd.classrooms.push({ id: roomId, roomNumber: '101', visible: true });
            sd.schedule[roomId] = {
                Monday: { '09:00-10:00': [{ courseId: 'c1', modality: 'in-person', section: '' }] },
                Wednesday: { '09:00-10:00': [{ courseId: 'c1', modality: 'in-person', section: '' }] }
            };
            // Same course (same key) should be counted once
            expect(manager.getWorkload('i1')).toBe(3);
        });
    });
});
