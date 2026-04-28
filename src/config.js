/**
 * Application-wide configuration constants.
 * Frozen to prevent accidental mutation.
 */
export const Config = Object.freeze({
    DAYS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Arranged'],
    QUARTERS: ['Fall', 'Winter', 'Spring', 'Summer'],
    MODALITY_ICONS: Object.freeze({ 'in-person': '🏫', online: '💻', hybrid: '🔄' }),
    STORAGE_KEY: 'workloadSchedulerData',
    DEFAULT_COLOR: '#3498db',
    DEFAULT_SCHEDULE: 'Default Schedule',
});
