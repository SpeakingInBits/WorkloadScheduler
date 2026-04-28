export class ImportExportService {
    #dataStore;
    #onUpdate;        // () => void — triggers full re-render
    #renderSelector;  // () => void — updates schedule selector dropdown

    /**
     * @param {import('../data/DataStore.js').DataStore} dataStore
     * @param {{ onUpdate: () => void, renderSelector: () => void }} callbacks
     */
    constructor(dataStore, callbacks) {
        this.#dataStore = dataStore;
        this.#onUpdate = callbacks.onUpdate;
        this.#renderSelector = callbacks.renderSelector;
    }

    exportSchedule() {
        const d = this.#dataStore.data;
        const defaultName = `${d.currentSchedule.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`;
        const filename = prompt('Enter filename for export (without .json extension):', defaultName);
        if (filename === null) return;

        const finalFilename = filename.trim() || defaultName;

        const exportPayload = {
            version: '4.0',
            exportDate: new Date().toISOString(),
            scheduleName: d.currentSchedule,
            programs: d.programs,
            courseCatalog: d.courseCatalog,
            instructors: d.instructors,
            data: this.#dataStore.getCurrentSchedule(),
        };

        const dataStr = JSON.stringify(exportPayload, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${finalFilename}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    importSchedule(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);

                if (imported.version === '4.0' && imported.scheduleName && imported.data) {
                    this._importV4(imported);
                } else if (imported.version === '3.0' && imported.scheduleName && imported.data) {
                    this._importV3(imported);
                } else if (imported.version === '2.0' && imported.scheduleName && imported.data) {
                    this._importV2(imported);
                } else if (imported.version === '1.0' && imported.data) {
                    this._importV1(imported);
                } else if (imported.instructors && imported.courses && imported.classrooms && imported.schedule) {
                    this._importLegacy(imported);
                } else {
                    alert('Invalid data format');
                }
            } catch (err) {
                alert('Error importing data: ' + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    // ── Private helpers ──

    _promptScheduleName(defaultName) {
        const d = this.#dataStore.data;
        const name = prompt('Enter name for this schedule:', defaultName);
        if (!name || !name.trim()) return null;
        const finalName = name.trim();
        if (d.schedules[finalName]) {
            if (!confirm(`Schedule "${finalName}" already exists. Override it?`)) return null;
        }
        return finalName;
    }

    _mergePrograms(programs) {
        const d = this.#dataStore.data;
        if (!programs) return;
        programs.forEach(prog => {
            if (!d.programs.find(p => p.id === prog.id)) {
                if (!d.programs.find(p => p.name === prog.name)) {
                    d.programs.push(prog);
                }
            }
        });
    }

    _mergeCourses(courses) {
        const d = this.#dataStore.data;
        if (!courses) return;
        courses.forEach(course => {
            if (!d.courseCatalog.find(c => c.id === course.id)) {
                d.courseCatalog.push(course);
            }
        });
    }

    _mergeInstructors(instructors) {
        const d = this.#dataStore.data;
        if (!instructors) return;
        instructors.forEach(instr => {
            if (!d.instructors.find(i => i.id === instr.id)) {
                d.instructors.push(instr);
            }
        });
    }

    _importV4(imported) {
        const sd = imported.data;
        if (!sd.classrooms || !sd.schedule) {
            alert('Invalid data format in file');
            return;
        }

        const finalName = this._promptScheduleName(imported.scheduleName);
        if (!finalName) { alert('Import cancelled.'); return; }

        this._mergePrograms(imported.programs);
        this._mergeCourses(imported.courseCatalog);
        this._mergeInstructors(imported.instructors);

        const d = this.#dataStore.data;
        d.schedules[finalName] = sd;
        d.currentSchedule = finalName;
        this.#dataStore.save();
        this.#renderSelector();
        this.#onUpdate();
        alert(`Schedule "${finalName}" imported successfully!`);
    }

    _importV3(imported) {
        const sd = imported.data;
        if (!sd.instructors || !sd.classrooms || !sd.schedule) {
            alert('Invalid data format in file');
            return;
        }

        const finalName = this._promptScheduleName(imported.scheduleName);
        if (!finalName) { alert('Import cancelled.'); return; }

        this._mergePrograms(imported.programs);
        this._mergeCourses(imported.courseCatalog);
        this._mergeInstructors(sd.instructors);
        delete sd.instructors;

        const d = this.#dataStore.data;
        d.schedules[finalName] = sd;
        d.currentSchedule = finalName;
        this.#dataStore.save();
        this.#renderSelector();
        this.#onUpdate();
        alert(`Schedule "${finalName}" imported successfully!`);
    }

    _importV2(imported) {
        const data = imported.data;
        if (!data.instructors || !data.courses || !data.classrooms || !data.schedule) {
            alert('Invalid data format in file');
            return;
        }

        const finalName = this._promptScheduleName(imported.scheduleName);
        if (!finalName) { alert('Import cancelled.'); return; }

        const d = this.#dataStore.data;
        const courseInstructors = {};
        data.courses.forEach(course => {
            if (!d.courseCatalog.find(c => c.id === course.id)) {
                const { instructorId, ...catalogCourse } = course;
                catalogCourse.programId = null;
                catalogCourse.courseNumber = '';
                catalogCourse.quartersOffered = [];
                d.courseCatalog.push(catalogCourse);
            }
            if (course.instructorId) courseInstructors[course.id] = course.instructorId;
        });

        this._mergeInstructors(data.instructors);

        d.schedules[finalName] = { quarter: '', courseInstructors, classrooms: data.classrooms, schedule: data.schedule };
        d.currentSchedule = finalName;
        this.#dataStore.save();
        this.#renderSelector();
        this.#onUpdate();
        alert(`Schedule "${finalName}" imported successfully! (migrated from v2.0)`);
    }

    _importV1(imported) {
        const data = imported.data;
        if (!data.instructors || !data.courses || !data.classrooms || !data.schedule) {
            alert('Invalid data format in versioned file');
            return;
        }

        const finalName = this._promptScheduleName('Imported Schedule');
        if (!finalName) { alert('Import cancelled.'); return; }

        const d = this.#dataStore.data;
        const courseInstructors = {};
        data.courses.forEach(course => {
            if (!d.courseCatalog.find(c => c.id === course.id)) {
                const { instructorId, ...catalogCourse } = course;
                catalogCourse.programId = null;
                catalogCourse.courseNumber = '';
                catalogCourse.quartersOffered = [];
                d.courseCatalog.push(catalogCourse);
            }
            if (course.instructorId) courseInstructors[course.id] = course.instructorId;
        });

        this._mergeInstructors(data.instructors);

        d.schedules[finalName] = { quarter: '', courseInstructors, classrooms: data.classrooms, schedule: data.schedule };
        d.currentSchedule = finalName;
        this.#dataStore.save();
        this.#renderSelector();
        this.#onUpdate();
        alert(`Schedule "${finalName}" imported successfully! (migrated from v1.0)`);
    }

    _importLegacy(imported) {
        const finalName = this._promptScheduleName('Imported Schedule');
        if (!finalName) { alert('Import cancelled.'); return; }

        const d = this.#dataStore.data;
        const courseInstructors = {};
        imported.courses.forEach(course => {
            if (!d.courseCatalog.find(c => c.id === course.id)) {
                const { instructorId, ...catalogCourse } = course;
                catalogCourse.programId = null;
                catalogCourse.courseNumber = '';
                catalogCourse.quartersOffered = [];
                d.courseCatalog.push(catalogCourse);
            }
            if (course.instructorId) courseInstructors[course.id] = course.instructorId;
        });

        this._mergeInstructors(imported.instructors);

        d.schedules[finalName] = { quarter: '', courseInstructors, classrooms: imported.classrooms, schedule: imported.schedule };
        d.currentSchedule = finalName;
        this.#dataStore.save();
        this.#renderSelector();
        this.#onUpdate();
        alert(`Schedule "${finalName}" imported successfully! (Legacy format)`);
    }
}
