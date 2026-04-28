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
