import { DataStore } from '../../../src/data/DataStore.js';
import { TimeslotManager } from '../../../src/managers/TimeslotManager.js';

let ds;
let manager;
const renderSpy = vi.fn();
const renderTimeslotManagerSpy = vi.fn();

beforeEach(() => {
    ds = new DataStore();
    manager = new TimeslotManager(ds, { render: renderSpy, renderTimeslotManager: renderTimeslotManagerSpy });
    renderSpy.mockClear();
    renderTimeslotManagerSpy.mockClear();
});

describe('TimeslotManager', () => {
    describe('add', () => {
        it('adds a timeslot to the specified day', () => {
            manager.add('Monday', '09:00', '10:00');
            expect(ds.getCurrentSchedule().timeslots.Monday).toContain('09:00-10:00');
        });

        it('does not add duplicate timeslot', () => {
            ds.getCurrentSchedule().timeslots.Monday.push('09:00-10:00');
            manager.add('Monday', '09:00', '10:00');
            expect(ds.getCurrentSchedule().timeslots.Monday).toHaveLength(1);
        });

        it('adds multiple distinct timeslots and keeps them sorted', () => {
            manager.add('Monday', '10:00', '11:00');
            manager.add('Monday', '08:00', '09:00');
            const slots = ds.getCurrentSchedule().timeslots.Monday;
            expect(slots).toHaveLength(2);
            expect(slots[0]).toBe('08:00-09:00');
        });

        it('calls render after adding', () => {
            manager.add('Monday', '08:00', '09:00');
            expect(renderSpy).toHaveBeenCalled();
        });

        it('does not call render when adding a duplicate', () => {
            ds.getCurrentSchedule().timeslots.Monday.push('09:00-10:00');
            renderSpy.mockClear();
            manager.add('Monday', '09:00', '10:00');
            expect(renderSpy).not.toHaveBeenCalled();
        });
    });

    describe('remove', () => {
        it('removes an existing timeslot from a day', () => {
            ds.getCurrentSchedule().timeslots.Monday.push('09:00-10:00');
            manager.remove('Monday', '09:00-10:00');
            expect(ds.getCurrentSchedule().timeslots.Monday).toHaveLength(0);
        });

        it('does not throw when removing a non-existent timeslot', () => {
            expect(() => manager.remove('Monday', '00:00-00:01')).not.toThrow();
        });
    });

    describe('copyToAllDays', () => {
        it('copies source day timeslots to all other days (except Arranged)', () => {
            const sd = ds.getCurrentSchedule();
            sd.timeslots.Monday = ['09:00-10:00', '10:00-11:00'];
            manager.copyToAllDays('Monday');
            expect(sd.timeslots.Tuesday).toEqual(['09:00-10:00', '10:00-11:00']);
            expect(sd.timeslots.Wednesday).toEqual(['09:00-10:00', '10:00-11:00']);
            expect(sd.timeslots.Thursday).toEqual(['09:00-10:00', '10:00-11:00']);
            expect(sd.timeslots.Friday).toEqual(['09:00-10:00', '10:00-11:00']);
        });

        it('does not copy to source day itself', () => {
            const sd = ds.getCurrentSchedule();
            sd.timeslots.Monday = ['09:00-10:00'];
            sd.timeslots.Tuesday = ['11:00-12:00'];
            manager.copyToAllDays('Tuesday');
            // Tuesday is the source — it stays unchanged
            expect(sd.timeslots.Tuesday).toEqual(['11:00-12:00']);
            // All other days (incl. Monday) get Tuesday's timeslots
            expect(sd.timeslots.Monday).toEqual(['11:00-12:00']);
            expect(sd.timeslots.Wednesday).toEqual(['11:00-12:00']);
        });
    });
});
