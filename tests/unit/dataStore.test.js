import { DataStore } from '../../src/data/DataStore.js';

// Use named class for fresh isolated instances per test
let ds;

beforeEach(() => {
    ds = new DataStore();
});

describe('DataStore', () => {
    describe('createEmptySchedule', () => {
        it('returns object with empty arrays for all non-Arranged days', () => {
            const sd = ds.createEmptySchedule('Fall');
            expect(sd.quarter).toBe('Fall');
            expect(sd.courseInstructors).toEqual({});
            expect(sd.classrooms).toEqual([]);
            expect(sd.schedule).toEqual({});
            expect(sd.timeslots.Monday).toEqual([]);
            expect(sd.timeslots.Arranged).toBeUndefined();
        });

        it('defaults quarter to empty string', () => {
            const sd = ds.createEmptySchedule();
            expect(sd.quarter).toBe('');
        });
    });

    describe('getCurrentSchedule', () => {
        it('returns the current schedule data', () => {
            const sd = ds.getCurrentSchedule();
            expect(sd).toBeDefined();
            expect(sd.classrooms).toEqual([]);
        });

        it('auto-initialises a missing schedule', () => {
            ds.data.currentSchedule = 'NewSchedule';
            const sd = ds.getCurrentSchedule();
            expect(sd).toBeDefined();
            expect(sd.classrooms).toEqual([]);
        });

        it('populates missing timeslots on existing schedule', () => {
            const sd = ds.getCurrentSchedule();
            delete sd.timeslots;
            const refreshed = ds.getCurrentSchedule();
            expect(refreshed.timeslots.Monday).toEqual([]);
        });
    });

    describe('save / load', () => {
        it('round-trips programs through localStorage', () => {
            ds.data.programs.push({ id: '1', name: 'CPW' });
            ds.save();

            const ds2 = new DataStore();
            ds2.load();
            expect(ds2.data.programs).toHaveLength(1);
            expect(ds2.data.programs[0].name).toBe('CPW');
        });

        it('round-trips courses through localStorage', () => {
            ds.data.courseCatalog.push({ id: 'c1', name: 'Math', credits: 3, programId: null, courseNumber: '', quartersOffered: [] });
            ds.save();

            const ds2 = new DataStore();
            ds2.load();
            expect(ds2.data.courseCatalog[0].name).toBe('Math');
        });

        it('handles empty localStorage gracefully', () => {
            localStorage.clear();
            expect(() => ds.load()).not.toThrow();
        });

        it('migrates a legacy string instructor assignment to a credit-split array', () => {
            ds.data.courseCatalog.push({ id: 'c1', name: 'Math', credits: 3, programId: null, courseNumber: '', quartersOffered: [] });
            const sd = ds.getCurrentSchedule();
            sd.courseInstructors['c1'] = 'i1';        // legacy single-instructor shape
            sd.courseInstructors['c2::A'] = 'i2';     // legacy sectioned shape (unknown course)
            ds.save();

            const ds2 = new DataStore();
            ds2.load();
            const reloaded = ds2.getCurrentSchedule();
            expect(reloaded.courseInstructors['c1']).toEqual([{ instructorId: 'i1', credits: 3 }]);
            // Unknown course → credits fall back to null
            expect(reloaded.courseInstructors['c2::A']).toEqual([{ instructorId: 'i2', credits: null }]);
        });

        it('leaves an already-migrated array assignment untouched', () => {
            ds.data.courseCatalog.push({ id: 'c1', name: 'Math', credits: 3, programId: null, courseNumber: '', quartersOffered: [] });
            const sd = ds.getCurrentSchedule();
            sd.courseInstructors['c1'] = [
                { instructorId: 'i1', credits: 1.5 },
                { instructorId: 'i2', credits: 1.5 },
            ];
            ds.save();

            const ds2 = new DataStore();
            ds2.load();
            expect(ds2.getCurrentSchedule().courseInstructors['c1']).toEqual([
                { instructorId: 'i1', credits: 1.5 },
                { instructorId: 'i2', credits: 1.5 },
            ]);
        });

        it('preserves currentSchedule after reload', () => {
            ds.data.schedules['Fall 2026'] = ds.createEmptySchedule('Fall');
            ds.data.currentSchedule = 'Fall 2026';
            ds.save();

            const ds2 = new DataStore();
            ds2.load();
            expect(ds2.data.currentSchedule).toBe('Fall 2026');
        });
    });

    describe('data.classrooms virtual property', () => {
        it('proxies to getCurrentSchedule().classrooms', () => {
            ds.getCurrentSchedule().classrooms.push({ id: 'r1', roomNumber: '101', visible: true });
            expect(ds.data.classrooms).toHaveLength(1);
            expect(ds.data.classrooms[0].roomNumber).toBe('101');
        });

        it('setting data.classrooms updates the schedule', () => {
            ds.data.classrooms = [{ id: 'r2', roomNumber: '202', visible: true }];
            expect(ds.getCurrentSchedule().classrooms[0].roomNumber).toBe('202');
        });
    });

    describe('data.schedule virtual property', () => {
        it('proxies to getCurrentSchedule().schedule', () => {
            ds.getCurrentSchedule().schedule['r1'] = {};
            expect(ds.data.schedule['r1']).toBeDefined();
        });
    });
});
