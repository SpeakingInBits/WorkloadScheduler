import { Helpers } from '../../src/utils/Helpers.js';

describe('Helpers', () => {
    describe('getCourseInstructorKey', () => {
        it('returns courseId when section is empty', () => {
            expect(Helpers.getCourseInstructorKey('abc', '')).toBe('abc');
        });

        it('returns courseId when section is undefined', () => {
            expect(Helpers.getCourseInstructorKey('abc', undefined)).toBe('abc');
        });

        it('returns "courseId::section" when section is provided', () => {
            expect(Helpers.getCourseInstructorKey('abc', 'A')).toBe('abc::A');
        });
    });

    describe('normalizeInstructorAssignments', () => {
        it('returns [] for null/undefined/empty', () => {
            expect(Helpers.normalizeInstructorAssignments(null)).toEqual([]);
            expect(Helpers.normalizeInstructorAssignments(undefined)).toEqual([]);
            expect(Helpers.normalizeInstructorAssignments('')).toEqual([]);
        });

        it('wraps a legacy id string with unspecified credits', () => {
            expect(Helpers.normalizeInstructorAssignments('i1')).toEqual([
                { instructorId: 'i1', credits: null },
            ]);
        });

        it('normalizes an array of {instructorId, credits} entries', () => {
            expect(Helpers.normalizeInstructorAssignments([
                { instructorId: 'i1', credits: 2 },
                { instructorId: 'i2', credits: 1.5 },
            ])).toEqual([
                { instructorId: 'i1', credits: 2 },
                { instructorId: 'i2', credits: 1.5 },
            ]);
        });

        it('coerces string credits to numbers and blanks to null', () => {
            expect(Helpers.normalizeInstructorAssignments([
                { instructorId: 'i1', credits: '2.5' },
                { instructorId: 'i2', credits: '' },
            ])).toEqual([
                { instructorId: 'i1', credits: 2.5 },
                { instructorId: 'i2', credits: null },
            ]);
        });

        it('drops entries without an instructorId', () => {
            expect(Helpers.normalizeInstructorAssignments([
                { instructorId: '', credits: 2 },
                'i2',
            ])).toEqual([{ instructorId: 'i2', credits: null }]);
        });
    });

    describe('getInstructorAssignments / getPrimaryInstructorId', () => {
        const scheduleData = {
            courseInstructors: {
                c1: [{ instructorId: 'i1', credits: 2 }, { instructorId: 'i2', credits: 1 }],
                'c2::A': 'iLegacy',
            },
        };

        it('reads array assignments for a bare course key', () => {
            expect(Helpers.getInstructorAssignments(scheduleData, 'c1', '')).toEqual([
                { instructorId: 'i1', credits: 2 },
                { instructorId: 'i2', credits: 1 },
            ]);
        });

        it('reads legacy string assignments for a sectioned key', () => {
            expect(Helpers.getInstructorAssignments(scheduleData, 'c2', 'A')).toEqual([
                { instructorId: 'iLegacy', credits: null },
            ]);
        });

        it('returns the first instructor id as primary', () => {
            expect(Helpers.getPrimaryInstructorId(scheduleData, 'c1', '')).toBe('i1');
        });

        it('returns null primary when unassigned', () => {
            expect(Helpers.getPrimaryInstructorId(scheduleData, 'missing', '')).toBeNull();
        });
    });

    describe('formatCredits', () => {
        it('renders whole numbers without decimals', () => {
            expect(Helpers.formatCredits(3)).toBe('3');
            expect(Helpers.formatCredits(3.0)).toBe('3');
        });

        it('renders fractional values, trimming trailing zeros', () => {
            expect(Helpers.formatCredits(2.5)).toBe('2.5');
            expect(Helpers.formatCredits(1.25)).toBe('1.25');
            expect(Helpers.formatCredits(1.5)).toBe('1.5');
        });

        it('avoids floating point noise', () => {
            expect(Helpers.formatCredits(0.1 + 0.2)).toBe('0.3');
        });
    });

    describe('getCourseDisplayName', () => {
        const programs = [{ id: 'p1', name: 'CPW' }];

        it('returns "Unknown" for null course', () => {
            expect(Helpers.getCourseDisplayName(null, programs)).toBe('Unknown');
        });

        it('returns "PROGRAM NUMBER - Name" when all fields present', () => {
            const course = { programId: 'p1', courseNumber: '101', name: 'Intro' };
            expect(Helpers.getCourseDisplayName(course, programs)).toBe('CPW 101 - Intro');
        });

        it('returns "PROGRAM NUMBER" when name is absent', () => {
            const course = { programId: 'p1', courseNumber: '101', name: '' };
            expect(Helpers.getCourseDisplayName(course, programs)).toBe('CPW 101');
        });

        it('returns just the course name when no program and no number', () => {
            const course = { programId: null, courseNumber: '', name: 'Art History' };
            expect(Helpers.getCourseDisplayName(course, programs)).toBe('Art History');
        });

        it('returns "Unnamed Course" when all fields empty', () => {
            const course = { programId: null, courseNumber: '', name: '' };
            expect(Helpers.getCourseDisplayName(course, programs)).toBe('Unnamed Course');
        });
    });

    describe('getCourseWithInstructor', () => {
        const catalog = [{ id: 'c1', name: 'Math', credits: 3 }];
        const scheduleData = { courseInstructors: { 'c1': 'i1', 'c1::B': 'i2' } };

        it('returns null for unknown courseId', () => {
            expect(Helpers.getCourseWithInstructor('unknown', '', catalog, scheduleData)).toBeNull();
        });

        it('merges instructorId for course without section', () => {
            const result = Helpers.getCourseWithInstructor('c1', '', catalog, scheduleData);
            expect(result).toMatchObject({ id: 'c1', instructorId: 'i1' });
        });

        it('merges instructorId for course with section', () => {
            const result = Helpers.getCourseWithInstructor('c1', 'B', catalog, scheduleData);
            expect(result).toMatchObject({ id: 'c1', instructorId: 'i2' });
        });

        it('sets instructorId to null when no assignment exists', () => {
            const result = Helpers.getCourseWithInstructor('c1', 'Z', catalog, scheduleData);
            expect(result.instructorId).toBeNull();
        });
    });

    describe('parseTime', () => {
        it('parses "08:00" to 480', () => {
            expect(Helpers.parseTime('08:00')).toBe(480);
        });

        it('parses "13:30" to 810', () => {
            expect(Helpers.parseTime('13:30')).toBe(810);
        });
    });

    describe('parseTimeRange', () => {
        it('parses "08:00-09:00" correctly', () => {
            expect(Helpers.parseTimeRange('08:00-09:00')).toEqual({ start: 480, end: 540 });
        });
    });

    describe('timesOverlap', () => {
        it('returns true for overlapping ranges', () => {
            expect(Helpers.timesOverlap('08:00-10:00', '09:00-11:00')).toBe(true);
        });

        it('returns false for non-overlapping ranges', () => {
            expect(Helpers.timesOverlap('08:00-09:00', '09:00-10:00')).toBe(false);
        });

        it('returns false for ranges with a gap', () => {
            expect(Helpers.timesOverlap('08:00-09:00', '10:00-11:00')).toBe(false);
        });

        it('returns true for fully contained ranges', () => {
            expect(Helpers.timesOverlap('08:00-12:00', '09:00-11:00')).toBe(true);
        });
    });

    describe('findOverlappingTimeslots', () => {
        it('returns empty array for no overlaps', () => {
            expect(Helpers.findOverlappingTimeslots(['08:00-09:00', '09:00-10:00'])).toEqual([]);
        });

        it('returns one pair for two overlapping slots', () => {
            const result = Helpers.findOverlappingTimeslots(['08:00-10:00', '09:00-11:00']);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(['08:00-10:00', '09:00-11:00']);
        });

        it('returns two pairs when three slots have two overlapping combinations', () => {
            // 08:00-10:00 overlaps 09:00-11:00, and 09:00-11:00 overlaps 10:30-12:00
            const result = Helpers.findOverlappingTimeslots(['08:00-10:00', '09:00-11:00', '10:30-12:00']);
            expect(result).toHaveLength(2);
        });
    });
});
