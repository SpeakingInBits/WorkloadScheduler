// Data structure
let appData = {
    programs: [],        // Global: [{ id, name }]
    courseCatalog: [],   // Global: [{ id, name, credits, programId, courseNumber, quarterTaken, quartersOffered }]
    schedules: {
        'Default Schedule': {
            quarter: '',          // Fall, Winter, Spring, Summer
            instructors: [],
            courseInstructors: {}, // { courseId: instructorId }
            classrooms: [],
            schedule: {}
        }
    },
    currentSchedule: 'Default Schedule',
    collapsedSections: {},
    instructorFilter: [],
    programFilter: ''
};

// Helper to get current schedule data
function getCurrentScheduleData() {
    if (!appData.schedules[appData.currentSchedule]) {
        appData.schedules[appData.currentSchedule] = {
            quarter: '',
            instructors: [],
            courseInstructors: {},
            classrooms: [],
            schedule: {}
        };
    }
    const scheduleData = appData.schedules[appData.currentSchedule];

    if (!scheduleData.instructors) scheduleData.instructors = [];
    if (!scheduleData.courseInstructors) scheduleData.courseInstructors = {};
    if (!scheduleData.classrooms) scheduleData.classrooms = [];
    if (!scheduleData.schedule) scheduleData.schedule = {};
    if (scheduleData.quarter === undefined) scheduleData.quarter = '';

    return scheduleData;
}

// Helper to build the courseInstructors key for a (courseId, section) pair
function getCourseInstructorKey(courseId, section) {
    return section ? `${courseId}::${section}` : courseId;
}

// Helper to get a course from catalog with instructor from current schedule
function getCourseWithInstructor(courseId, section) {
    const course = appData.courseCatalog.find(c => c.id === courseId);
    if (!course) return null;
    const scheduleData = getCurrentScheduleData();
    const key = getCourseInstructorKey(courseId, section);
    return {
        ...course,
        instructorId: scheduleData.courseInstructors[key] || null
    };
}

// Helper to get display name for a course
function getCourseDisplayName(course) {
    if (!course) return 'Unknown';
    const program = appData.programs.find(p => p.id === course.programId);
    const prefix = program ? `${program.name} ${course.courseNumber || ''}`.trim() : (course.courseNumber ? course.courseNumber : '');
    if (prefix && course.name) return `${prefix} - ${course.name}`;
    if (prefix) return prefix;
    return course.name || 'Unnamed Course';
}

// Helper properties for backward compatibility
Object.defineProperties(appData, {
    instructors: {
        get() { return getCurrentScheduleData().instructors; },
        set(value) { getCurrentScheduleData().instructors = value; }
    },
    classrooms: {
        get() { return getCurrentScheduleData().classrooms; },
        set(value) { getCurrentScheduleData().classrooms = value; }
    },
    schedule: {
        get() { return getCurrentScheduleData().schedule; },
        set(value) { getCurrentScheduleData().schedule = value; }
    }
});

// Store pending drop data
let pendingDrop = null;

// Days of the week
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Arranged'];

// Quarter options
const QUARTERS = ['Fall', 'Winter', 'Spring', 'Summer'];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    initializeEventListeners();
    renderScheduleSelector();
    render();
});

// Schedule Management Functions
function renderScheduleSelector() {
    const select = document.getElementById('scheduleSelect');
    if (!select) return;

    const scheduleNames = Object.keys(appData.schedules);
    select.innerHTML = scheduleNames.map(name =>
        `<option value="${name}" ${name === appData.currentSchedule ? 'selected' : ''}>${name}</option>`
    ).join('');

    // Update quarter selector
    const quarterSelect = document.getElementById('scheduleQuarter');
    if (quarterSelect) {
        const scheduleData = getCurrentScheduleData();
        quarterSelect.value = scheduleData.quarter || '';
    }
}

function switchSchedule() {
    const select = document.getElementById('scheduleSelect');
    appData.currentSchedule = select.value;
    saveToLocalStorage();
    renderScheduleSelector();
    render();
}

function createNewSchedule() {
    const name = prompt('Enter name for new schedule:');
    if (!name || !name.trim()) return;

    const scheduleName = name.trim();
    if (appData.schedules[scheduleName]) {
        alert('A schedule with this name already exists.');
        return;
    }

    // Ask for quarter
    let quarter = '';
    while (!quarter) {
        const input = prompt('Select quarter for this schedule (Fall, Winter, Spring, Summer):');
        if (input === null) return; // cancelled
        const match = QUARTERS.find(q => q.toLowerCase() === input.trim().toLowerCase());
        if (match) {
            quarter = match;
        } else {
            alert('Please enter a valid quarter: Fall, Winter, Spring, or Summer');
        }
    }

    const copyExisting = confirm(`Would you like to copy the current schedule "${appData.currentSchedule}" to the new schedule?\n\nClick OK to copy, or Cancel to start with an empty schedule.`);

    if (copyExisting) {
        const currentData = getCurrentScheduleData();
        appData.schedules[scheduleName] = {
            quarter: quarter,
            instructors: JSON.parse(JSON.stringify(currentData.instructors || [])),
            courseInstructors: JSON.parse(JSON.stringify(currentData.courseInstructors || {})),
            classrooms: JSON.parse(JSON.stringify(currentData.classrooms || [])),
            schedule: JSON.parse(JSON.stringify(currentData.schedule || {}))
        };
    } else {
        appData.schedules[scheduleName] = {
            quarter: quarter,
            instructors: [],
            courseInstructors: {},
            classrooms: [],
            schedule: {}
        };
    }

    appData.currentSchedule = scheduleName;
    saveToLocalStorage();
    renderScheduleSelector();
    render();
}

function renameCurrentSchedule() {
    const oldName = appData.currentSchedule;
    const newName = prompt('Enter new name for schedule:', oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;

    const scheduleName = newName.trim();
    if (appData.schedules[scheduleName]) {
        alert('A schedule with this name already exists.');
        return;
    }

    appData.schedules[scheduleName] = appData.schedules[oldName];
    delete appData.schedules[oldName];
    appData.currentSchedule = scheduleName;
    saveToLocalStorage();
    renderScheduleSelector();
    render();
}

function deleteCurrentSchedule() {
    if (Object.keys(appData.schedules).length === 1) {
        alert('Cannot delete the last schedule.');
        return;
    }

    if (!confirm(`Delete schedule "${appData.currentSchedule}"?`)) return;

    delete appData.schedules[appData.currentSchedule];
    appData.currentSchedule = Object.keys(appData.schedules)[0];
    saveToLocalStorage();
    renderScheduleSelector();
    render();
}

function updateScheduleQuarter() {
    const quarterSelect = document.getElementById('scheduleQuarter');
    if (quarterSelect) {
        const scheduleData = getCurrentScheduleData();
        scheduleData.quarter = quarterSelect.value;
        saveToLocalStorage();
        renderValidationSummary();
    }
}

// Collapsible Sections
function toggleSection(sectionName) {
    const section = document.getElementById(`${sectionName}-section`);
    const icon = document.getElementById(`${sectionName}-icon`);

    if (!section || !icon) return;

    const isCollapsed = section.style.display === 'none';
    section.style.display = isCollapsed ? 'block' : 'none';
    icon.textContent = isCollapsed ? '▼' : '▶';

    if (!appData.collapsedSections) appData.collapsedSections = {};
    appData.collapsedSections[sectionName] = !isCollapsed;
    saveToLocalStorage();
}

// Instructor Filter Functions
function toggleInstructorFilter(e) {
    e.stopPropagation();
    const filterList = document.getElementById('instructorFilterList');
    filterList.style.display = filterList.style.display === 'none' ? 'block' : 'none';
}

function updateInstructorFilter(instructorId, checked) {
    if (!appData.instructorFilter) appData.instructorFilter = [];

    if (checked) {
        if (!appData.instructorFilter.includes(instructorId)) {
            appData.instructorFilter.push(instructorId);
        }
    } else {
        appData.instructorFilter = appData.instructorFilter.filter(id => id !== instructorId);
    }

    saveToLocalStorage();
    renderSchedule();
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    const filterList = document.getElementById('instructorFilterList');
    const filterToggle = document.querySelector('.filter-toggle');
    if (filterList && filterToggle && !filterToggle.contains(e.target) && !filterList.contains(e.target)) {
        filterList.style.display = 'none';
    }
    // Close quarters offered dropdowns
    ['quartersOfferedList', 'editQuartersOfferedList'].forEach(id => {
        const list = document.getElementById(id);
        if (list && list.style.display !== 'none') {
            const parent = list.closest('.quarters-offered-dropdown');
            if (parent && !parent.contains(e.target)) {
                list.style.display = 'none';
            }
        }
    });
});

// Quarters Offered dropdown toggle
function toggleQuartersOffered(event, context) {
    event.stopPropagation();
    event.preventDefault();
    const listId = context === 'edit' ? 'editQuartersOfferedList' : 'quartersOfferedList';
    const list = document.getElementById(listId);
    if (list) {
        list.style.display = list.style.display === 'none' ? 'block' : 'none';
    }
}

function getQuartersOfferedFromCheckboxes(context) {
    const prefix = context === 'edit' ? 'qo-edit-' : 'qo-add-';
    const quarters = [];
    QUARTERS.forEach(q => {
        const cb = document.getElementById(prefix + q.toLowerCase());
        if (cb && cb.checked) quarters.push(q);
    });
    return quarters;
}

function setQuartersOfferedCheckboxes(context, quartersOffered) {
    const prefix = context === 'edit' ? 'qo-edit-' : 'qo-add-';
    QUARTERS.forEach(q => {
        const cb = document.getElementById(prefix + q.toLowerCase());
        if (cb) {
            cb.checked = (quartersOffered || []).includes(q);
        }
    });
}

// Program filter
function updateProgramFilter() {
    const select = document.getElementById('programFilterSelect');
    appData.programFilter = select ? select.value : '';
    saveToLocalStorage();
    renderCourses();
}

// Event Listeners
function initializeEventListeners() {
    // Program form
    document.getElementById('addProgramForm').addEventListener('submit', (e) => {
        e.preventDefault();
        addProgram();
    });

    // Instructor form
    document.getElementById('addInstructorForm').addEventListener('submit', (e) => {
        e.preventDefault();
        addInstructor();
    });

    // Course form
    document.getElementById('addCourseForm').addEventListener('submit', (e) => {
        e.preventDefault();
        addCourse();
    });

    // Classroom form
    document.getElementById('addClassroomForm').addEventListener('submit', (e) => {
        e.preventDefault();
        addClassroom();
    });

    // Export/Import
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
    document.getElementById('fileInput').addEventListener('change', importData);

    // Modal close handlers
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    document.querySelector('.close-instructor-modal').addEventListener('click', closeInstructorModal);
    window.addEventListener('click', (e) => {
        if (e.target.id === 'courseModal') {
            closeModal();
        }
        if (e.target.id === 'modalityModal') {
            closeModalityModal();
        }
        if (e.target.id === 'instructorModal') {
            closeInstructorModal();
        }
    });

    // Edit course form
    document.getElementById('editCourseForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const modal = document.getElementById('courseModal');
        const courseId = modal.dataset.courseId;
        const classroomId = modal.dataset.classroomId;
        const day = modal.dataset.day;
        const timeslot = modal.dataset.timeslot;
        const courseIndex = modal.dataset.courseIndex;
        const programId = document.getElementById('editCourseProgram').value || null;
        const courseNumber = document.getElementById('editCourseNumber').value.trim() || '';
        const name = document.getElementById('editCourseName').value.trim();
        const credits = document.getElementById('editCourseCredits').value;
        const instructorId = document.getElementById('editCourseInstructor').value;
        const modality = document.getElementById('editModality').value || 'in-person';
        const quarterTaken = document.getElementById('editCourseQuarterTaken')?.value.trim() || null;
        const quartersOffered = getQuartersOfferedFromCheckboxes('edit');
        const section = document.getElementById('editCourseSection')?.value.trim() || '';

        if (credits) {
            saveCourseChanges(courseId, name, credits, instructorId || null, classroomId, day, timeslot, modality, courseIndex, quarterTaken, programId, courseNumber, quartersOffered, section);
        }
    });

    // Edit instructor form
    document.getElementById('editInstructorForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const modal = document.getElementById('instructorModal');
        const instructorId = modal.dataset.instructorId;
        const name = document.getElementById('editInstructorName').value.trim();
        const color = document.getElementById('editInstructorColor').value;

        if (name) {
            saveInstructorChanges(instructorId, name, color);
        }
    });
}

// Program functions
function addProgram() {
    const nameInput = document.getElementById('programName');
    const name = nameInput.value.trim();

    if (name) {
        const program = {
            id: Date.now().toString(),
            name: name
        };
        appData.programs.push(program);
        nameInput.value = '';
        saveToLocalStorage();
        render();
    }
}

function deleteProgram(id) {
    const hasCourses = appData.courseCatalog.some(c => c.programId === id);
    if (hasCourses) {
        alert('Cannot delete program with assigned courses. Reassign or delete the courses first.');
        return;
    }

    appData.programs = appData.programs.filter(p => p.id !== id);
    saveToLocalStorage();
    render();
}

function showEditProgramPrompt(id) {
    const program = appData.programs.find(p => p.id === id);
    if (!program) return;
    const newName = prompt('Enter new name for program:', program.name);
    if (newName && newName.trim()) {
        program.name = newName.trim();
        saveToLocalStorage();
        render();
    }
}

// Instructor functions
function addInstructor() {
    const nameInput = document.getElementById('instructorName');
    const name = nameInput.value.trim();

    if (name) {
        const instructor = {
            id: Date.now().toString(),
            name: name,
            color: '#3498db'
        };
        appData.instructors.push(instructor);
        nameInput.value = '';
        saveToLocalStorage();
        render();
    }
}

function deleteInstructor(id) {
    // Check if instructor has courses assigned in current schedule (including section-based keys)
    const scheduleData = getCurrentScheduleData();
    const hasAssignments = Object.values(scheduleData.courseInstructors).some(iId => iId === id);
    if (hasAssignments) {
        alert('Cannot delete instructor with assigned courses in the current schedule. Unassign them first.');
        return;
    }

    appData.instructors = appData.instructors.filter(i => i.id !== id);
    saveToLocalStorage();
    render();
}

function getInstructorWorkload(instructorId) {
    const scheduleData = getCurrentScheduleData();
    // Collect all scheduled (courseId, section) pairs
    const scheduledPairs = new Set();
    for (const classroomId in appData.schedule) {
        for (const day in appData.schedule[classroomId]) {
            for (const time in appData.schedule[classroomId][day]) {
                const slotData = appData.schedule[classroomId][day][time];
                const items = Array.isArray(slotData) ? slotData : (slotData ? [slotData] : []);
                items.forEach(item => {
                    const key = getCourseInstructorKey(item.courseId, item.section);
                    scheduledPairs.add(key);
                });
            }
        }
    }
    // Sum credits for each unique (courseId, section) assigned to this instructor
    let total = 0;
    scheduledPairs.forEach(key => {
        if (scheduleData.courseInstructors[key] === instructorId) {
            const courseId = key.includes('::') ? key.split('::')[0] : key;
            const course = appData.courseCatalog.find(c => c.id === courseId);
            if (course) total += course.credits;
        }
    });
    return total;
}

function isCourseScheduled(courseId) {
    for (const classroomId in appData.schedule) {
        for (const day in appData.schedule[classroomId]) {
            for (const time in appData.schedule[classroomId][day]) {
                const slotData = appData.schedule[classroomId][day][time];
                if (Array.isArray(slotData)) {
                    if (slotData.some(item => item.courseId === courseId)) {
                        return true;
                    }
                } else if (slotData && slotData.courseId === courseId) {
                    return true;
                }
            }
        }
    }
    return false;
}

function hasInPersonConflict(day, timeslot) {
    let inPersonCount = 0;
    for (const classroomId in appData.schedule) {
        const slotData = appData.schedule[classroomId]?.[day]?.[timeslot];
        if (slotData) {
            if (Array.isArray(slotData)) {
                inPersonCount += slotData.filter(item => item.modality === 'in-person').length;
            } else if (slotData.modality === 'in-person') {
                inPersonCount++;
            }
            if (inPersonCount >= 2) {
                return true;
            }
        }
    }
    return false;
}

// Course functions (global catalog)
function addCourse() {
    const programSelect = document.getElementById('courseProgram');
    const numberInput = document.getElementById('courseNumber');
    const nameInput = document.getElementById('courseName');
    const creditsInput = document.getElementById('courseCredits');
    const quarterInput = document.getElementById('courseQuarterTaken');

    const programId = programSelect.value || null;
    const courseNumber = numberInput.value.trim();
    const name = nameInput.value.trim();
    const credits = parseInt(creditsInput.value);
    const quarterTaken = quarterInput ? quarterInput.value.trim() : '';
    const quartersOffered = getQuartersOfferedFromCheckboxes('add');

    if (credits) {
        const course = {
            id: Date.now().toString(),
            name: name || '',
            credits: credits,
            programId: programId,
            courseNumber: courseNumber || '',
            quarterTaken: quarterTaken || null,
            quartersOffered: quartersOffered
        };
        appData.courseCatalog.push(course);
        nameInput.value = '';
        creditsInput.value = '';
        if (numberInput) numberInput.value = '';
        if (programSelect) programSelect.value = '';
        if (quarterInput) quarterInput.value = '';
        // Clear quarter checkboxes
        setQuartersOfferedCheckboxes('add', []);
        saveToLocalStorage();
        render();
    }
}

function deleteCourse(id) {
    // Remove from schedule in all schedules
    Object.keys(appData.schedules).forEach(scheduleName => {
        const scheduleData = appData.schedules[scheduleName];
        // Remove from schedule grid
        if (scheduleData.schedule) {
            Object.keys(scheduleData.schedule).forEach(classroomId => {
                DAYS.forEach(day => {
                    if (scheduleData.schedule[classroomId][day]) {
                        Object.keys(scheduleData.schedule[classroomId][day]).forEach(time => {
                            const slotData = scheduleData.schedule[classroomId][day][time];
                            if (Array.isArray(slotData)) {
                                scheduleData.schedule[classroomId][day][time] = slotData.filter(item => item.courseId !== id);
                                if (scheduleData.schedule[classroomId][day][time].length === 0) {
                                    delete scheduleData.schedule[classroomId][day][time];
                                }
                            } else if (slotData && slotData.courseId === id) {
                                delete scheduleData.schedule[classroomId][day][time];
                            }
                        });
                    }
                });
            });
        }
        // Remove instructor assignments (including section-based keys)
        if (scheduleData.courseInstructors) {
            Object.keys(scheduleData.courseInstructors).forEach(key => {
                if (key === id || key.startsWith(id + '::')) {
                    delete scheduleData.courseInstructors[key];
                }
            });
        }
    });

    appData.courseCatalog = appData.courseCatalog.filter(c => c.id !== id);
    saveToLocalStorage();
    render();
}

// Classroom functions
function addClassroom() {
    const roomInput = document.getElementById('roomNumber');
    const roomNumber = roomInput.value.trim();

    if (roomNumber) {
        const classroom = {
            id: Date.now().toString(),
            roomNumber: roomNumber,
            timeslots: {},
            visible: true,
            timeslotFormExpanded: true
        };
        DAYS.forEach(day => {
            classroom.timeslots[day] = [];
        });
        appData.classrooms.push(classroom);

        appData.schedule[classroom.id] = {};
        DAYS.forEach(day => {
            appData.schedule[classroom.id][day] = {};
        });

        roomInput.value = '';
        saveToLocalStorage();
        render();
    }
}

function deleteClassroom(id) {
    appData.classrooms = appData.classrooms.filter(c => c.id !== id);
    delete appData.schedule[id];
    saveToLocalStorage();
    render();
}

function toggleClassroom(id) {
    const classroom = appData.classrooms.find(c => c.id === id);
    if (classroom) {
        classroom.visible = !classroom.visible;
        saveToLocalStorage();
        render();
    }
}

function toggleTimeslotForm(classroomId) {
    const classroom = appData.classrooms.find(c => c.id === classroomId);
    if (classroom) {
        if (classroom.timeslotFormExpanded === undefined) {
            classroom.timeslotFormExpanded = true;
        }
        classroom.timeslotFormExpanded = !classroom.timeslotFormExpanded;
        saveToLocalStorage();
        render();
    }
}

function addTimeslot(classroomId, day, startTime, endTime) {
    const classroom = appData.classrooms.find(c => c.id === classroomId);
    if (classroom && startTime && endTime) {
        const timeslot = `${startTime}-${endTime}`;
        if (!classroom.timeslots[day]) {
            classroom.timeslots[day] = [];
        }
        if (!classroom.timeslots[day].includes(timeslot)) {
            classroom.timeslots[day].push(timeslot);
            classroom.timeslots[day].sort();
            saveToLocalStorage();
            render();
        }
    }
}

function removeTimeslot(classroomId, day, timeslot) {
    const classroom = appData.classrooms.find(c => c.id === classroomId);
    if (classroom) {
        if (appData.schedule[classroomId][day] && appData.schedule[classroomId][day][timeslot]) {
            delete appData.schedule[classroomId][day][timeslot];
        }

        if (classroom.timeslots[day]) {
            classroom.timeslots[day] = classroom.timeslots[day].filter(t => t !== timeslot);
        }
        saveToLocalStorage();
        render();
    }
}

function copyTimeslotsToAllDays(classroomId, sourceDay) {
    const classroom = appData.classrooms.find(c => c.id === classroomId);
    if (classroom && classroom.timeslots[sourceDay]) {
        const timeslots = [...classroom.timeslots[sourceDay]];
        DAYS.forEach(day => {
            if (day !== sourceDay) {
                classroom.timeslots[day] = [...timeslots];
            }
        });
        saveToLocalStorage();
        render();
    }
}

// Schedule functions
function scheduleCourse(classroomId, day, time, courseId, modality, section) {
    if (!appData.schedule[classroomId]) {
        appData.schedule[classroomId] = {};
    }
    if (!appData.schedule[classroomId][day]) {
        appData.schedule[classroomId][day] = {};
    }
    if (!appData.schedule[classroomId][day][time]) {
        appData.schedule[classroomId][day][time] = [];
    }

    appData.schedule[classroomId][day][time].push({
        courseId: courseId,
        modality: modality || 'in-person',
        section: section || ''
    });
    saveToLocalStorage();
    render();
}

function unscheduleCourse(classroomId, day, time, courseIndex) {
    if (appData.schedule[classroomId] && appData.schedule[classroomId][day] && appData.schedule[classroomId][day][time]) {
        if (courseIndex !== undefined) {
            appData.schedule[classroomId][day][time].splice(courseIndex, 1);
            if (appData.schedule[classroomId][day][time].length === 0) {
                delete appData.schedule[classroomId][day][time];
            }
        } else {
            delete appData.schedule[classroomId][day][time];
        }
        saveToLocalStorage();
        render();
    }
}

// Drag and Drop handlers
function handleDragStart(e, courseId) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('courseId', courseId);
    e.target.classList.add('dragging');

    const sourceClassroomId = e.target.dataset.sourceClassroomId;
    const sourceDay = e.target.dataset.sourceDay;
    const sourceTimeslot = e.target.dataset.sourceTimeslot;
    const sourceCourseIndex = e.target.dataset.sourceCourseIndex;
    const sourceSection = e.target.dataset.sourceSection;

    if (sourceClassroomId && sourceDay && sourceTimeslot) {
        e.dataTransfer.setData('sourceClassroomId', sourceClassroomId);
        e.dataTransfer.setData('sourceDay', sourceDay);
        e.dataTransfer.setData('sourceTimeslot', sourceTimeslot);
        e.dataTransfer.setData('sourceCourseIndex', sourceCourseIndex || '');
        e.dataTransfer.setData('sourceSection', sourceSection || '');
    }
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e, classroomId, day, time) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const courseId = e.dataTransfer.getData('courseId');
    if (courseId) {
        const sourceClassroomId = e.dataTransfer.getData('sourceClassroomId');
        const sourceDay = e.dataTransfer.getData('sourceDay');
        const sourceTimeslot = e.dataTransfer.getData('sourceTimeslot');
        const sourceCourseIndex = e.dataTransfer.getData('sourceCourseIndex');

        if (sourceClassroomId && sourceDay && sourceTimeslot) {
            const sourceSlot = appData.schedule[sourceClassroomId]?.[sourceDay]?.[sourceTimeslot];
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
                scheduleCourse(classroomId, day, time, courseId, modality, section);
                if (sourceCourseIndex !== '') {
                    unscheduleCourse(sourceClassroomId, sourceDay, sourceTimeslot, parseInt(sourceCourseIndex));
                } else {
                    unscheduleCourse(sourceClassroomId, sourceDay, sourceTimeslot, 0);
                }
            }
        } else {
            pendingDrop = { classroomId, day, time, courseId };
            showModalityModal();
        }
    }
}

// Modal functions
function showModalityModal() {
    document.getElementById('modalityModal').style.display = 'block';
}

function selectModality(modality) {
    if (pendingDrop) {
        const sectionInput = document.getElementById('modalitySectionInput');
        const section = sectionInput ? sectionInput.value.trim() : '';
        scheduleCourse(pendingDrop.classroomId, pendingDrop.day, pendingDrop.time, pendingDrop.courseId, modality, section);
        pendingDrop = null;
    }
    closeModalityModal();
}

function closeModalityModal() {
    document.getElementById('modalityModal').style.display = 'none';
    const sectionInput = document.getElementById('modalitySectionInput');
    if (sectionInput) sectionInput.value = '';
    pendingDrop = null;
}

function showHelpModal() {
    document.getElementById('helpModal').style.display = 'block';
}

function closeHelpModal() {
    document.getElementById('helpModal').style.display = 'none';
}

function closeHelpModalOnOutsideClick(event) {
    const modal = document.getElementById('helpModal');
    if (event.target === modal) {
        closeHelpModal();
    }
}

function showCourseModal(courseId, classroomId, day, timeslot, courseIndex) {
    const course = appData.courseCatalog.find(c => c.id === courseId);
    if (!course) return;

    const scheduleData = getCurrentScheduleData();

    // Populate program dropdown
    const programSelect = document.getElementById('editCourseProgram');
    programSelect.innerHTML = '<option value="">Select Program</option>' +
        appData.programs.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    programSelect.value = course.programId || '';

    document.getElementById('editCourseNumber').value = course.courseNumber || '';
    document.getElementById('editCourseName').value = course.name || '';
    document.getElementById('editCourseCredits').value = course.credits;
    const quarterInput = document.getElementById('editCourseQuarterTaken');
    if (quarterInput) quarterInput.value = course.quarterTaken || '';

    // Set quarters offered checkboxes
    setQuartersOfferedCheckboxes('edit', course.quartersOffered || []);

    // Show modality field when editing from schedule
    const modalityGroup = document.getElementById('editModality').closest('.form-group');
    if (modalityGroup) modalityGroup.style.display = 'block';

    // Get current modality
    const slotData = appData.schedule[classroomId]?.[day]?.[timeslot];
    let currentModality = 'in-person';
    let currentSection = '';
    if (Array.isArray(slotData) && courseIndex !== undefined) {
        currentModality = slotData[courseIndex]?.modality || 'in-person';
        currentSection = slotData[courseIndex]?.section || '';
    } else if (slotData && !Array.isArray(slotData)) {
        currentModality = slotData.modality || 'in-person';
        currentSection = slotData.section || '';
    }
    document.getElementById('editModality').value = currentModality;

    // Show and populate section field when editing from schedule
    const sectionGroup = document.getElementById('editCourseSection')?.closest('.form-group');
    if (sectionGroup) sectionGroup.style.display = 'block';
    const sectionInput = document.getElementById('editCourseSection');
    if (sectionInput) sectionInput.value = currentSection;

    // Update instructor dropdown (per-schedule, per-section assignment)
    const instructorSelect = document.getElementById('editCourseInstructor');
    instructorSelect.innerHTML = '<option value="">Select Instructor (Optional)</option>' +
        appData.instructors.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
    const instrKey = getCourseInstructorKey(courseId, currentSection);
    instructorSelect.value = scheduleData.courseInstructors[instrKey] || '';

    const modal = document.getElementById('courseModal');
    modal.style.display = 'block';
    modal.dataset.courseId = courseId;
    modal.dataset.classroomId = classroomId;
    modal.dataset.day = day;
    modal.dataset.timeslot = timeslot;
    modal.dataset.courseIndex = courseIndex !== undefined ? courseIndex : '';
}

function closeModal() {
    document.getElementById('courseModal').style.display = 'none';
}

function showCourseModalFromList(courseId) {
    const course = appData.courseCatalog.find(c => c.id === courseId);
    if (!course) return;

    const scheduleData = getCurrentScheduleData();

    // Populate program dropdown
    const programSelect = document.getElementById('editCourseProgram');
    programSelect.innerHTML = '<option value="">Select Program</option>' +
        appData.programs.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    programSelect.value = course.programId || '';

    document.getElementById('editCourseNumber').value = course.courseNumber || '';
    document.getElementById('editCourseName').value = course.name || '';
    document.getElementById('editCourseCredits').value = course.credits;
    const quarterInput = document.getElementById('editCourseQuarterTaken');
    if (quarterInput) quarterInput.value = course.quarterTaken || '';

    // Set quarters offered checkboxes
    setQuartersOfferedCheckboxes('edit', course.quartersOffered || []);

    // Hide modality field when editing from list
    const modalityGroup = document.getElementById('editModality').closest('.form-group');
    if (modalityGroup) modalityGroup.style.display = 'none';

    // Hide section field when editing from list
    const sectionGroup = document.getElementById('editCourseSection')?.closest('.form-group');
    if (sectionGroup) sectionGroup.style.display = 'none';

    // Update instructor dropdown (per-schedule assignment)
    const instructorSelect = document.getElementById('editCourseInstructor');
    instructorSelect.innerHTML = '<option value="">Select Instructor (Optional)</option>' +
        appData.instructors.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
    instructorSelect.value = scheduleData.courseInstructors[courseId] || '';

    const modal = document.getElementById('courseModal');
    modal.style.display = 'block';
    modal.dataset.courseId = courseId;
    modal.dataset.classroomId = '';
    modal.dataset.day = '';
    modal.dataset.timeslot = '';
    modal.dataset.courseIndex = '';
}

function showInstructorModal(instructorId) {
    const instructor = appData.instructors.find(i => i.id === instructorId);
    if (!instructor) return;

    document.getElementById('editInstructorName').value = instructor.name;
    document.getElementById('editInstructorColor').value = instructor.color || '#3498db';

    const modal = document.getElementById('instructorModal');
    modal.style.display = 'block';
    modal.dataset.instructorId = instructorId;
}

function closeInstructorModal() {
    document.getElementById('instructorModal').style.display = 'none';
}

function saveInstructorChanges(instructorId, name, color) {
    const instructor = appData.instructors.find(i => i.id === instructorId);
    if (instructor) {
        instructor.name = name;
        instructor.color = color || '#3498db';
        saveToLocalStorage();
        render();
        closeInstructorModal();
    }
}

function saveCourseChanges(courseId, name, credits, instructorId, classroomId, day, timeslot, modality, courseIndex, quarterTaken, programId, courseNumber, quartersOffered, section) {
    const course = appData.courseCatalog.find(c => c.id === courseId);
    if (course) {
        // Update catalog properties
        course.name = name || '';
        course.credits = parseInt(credits);
        course.quarterTaken = quarterTaken || null;
        course.programId = programId || null;
        course.courseNumber = courseNumber || '';
        course.quartersOffered = quartersOffered || [];

        // Determine the section for this scheduled instance
        let currentSection = section || '';

        // Update instructor assignment for current schedule (keyed by courseId::section)
        const scheduleData = getCurrentScheduleData();
        const instrKey = getCourseInstructorKey(courseId, currentSection);
        if (instructorId) {
            scheduleData.courseInstructors[instrKey] = instructorId;
        } else {
            delete scheduleData.courseInstructors[instrKey];
        }

        // Update modality and section for this specific scheduled slot
        if (classroomId && day && timeslot) {
            const slotData = appData.schedule[classroomId]?.[day]?.[timeslot];
            if (Array.isArray(slotData) && courseIndex !== undefined && courseIndex !== '') {
                const idx = parseInt(courseIndex);
                if (modality) slotData[idx].modality = modality;
                slotData[idx].section = currentSection;
            } else if (slotData && !Array.isArray(slotData)) {
                if (modality) slotData.modality = modality;
                slotData.section = currentSection;
            }
        }

        saveToLocalStorage();
        render();
        closeModal();
    }
}

// Render functions
function render() {
    renderPrograms();
    renderInstructors();
    renderCourses();
    renderSchedule();
    renderValidationSummary();
    restoreCollapsedSections();
}

// Helper function to get scheduled course style based on instructor color and filter
function getScheduledCourseStyle(course, courseId, section) {
    const scheduleData = getCurrentScheduleData();
    const instrKey = getCourseInstructorKey(courseId, section);
    const instructorId = scheduleData.courseInstructors[instrKey] || (course ? course.instructorId : null);
    const instructor = instructorId ? appData.instructors.find(i => i.id === instructorId) : null;
    const instructorColor = instructor ? (instructor.color || '#3498db') : '#95a5a6';

    const isFiltering = appData.instructorFilter && appData.instructorFilter.length > 0;
    const isFiltered = isFiltering && instructorId && !appData.instructorFilter.includes(instructorId);
    const opacity = isFiltered ? '0.2' : '1';

    return `background: ${instructorColor}; opacity: ${opacity};`;
}

function restoreCollapsedSections() {
    if (!appData.collapsedSections) return;

    Object.keys(appData.collapsedSections).forEach(sectionName => {
        const isCollapsed = appData.collapsedSections[sectionName];
        const section = document.getElementById(`${sectionName}-section`);
        const icon = document.getElementById(`${sectionName}-icon`);

        if (section && icon) {
            section.style.display = isCollapsed ? 'none' : 'block';
            icon.textContent = isCollapsed ? '▶' : '▼';
        }
    });
}

// Validation functions
function toggleValidationSummary() {
    const errorsDiv = document.getElementById('validationErrors');
    const icon = document.getElementById('validation-collapse-icon');
    if (!errorsDiv || !icon) return;

    const isCollapsed = errorsDiv.classList.toggle('collapsed');
    icon.textContent = isCollapsed ? '▶' : '▼';
}

function validateSchedule() {
    const errors = [];
    const scheduleData = getCurrentScheduleData();
    const scheduleQuarter = scheduleData.quarter;

    // Build a map of all scheduled courses
    const timeslotMap = {};
    const scheduledCourseIds = new Set();

    for (const classroomId in appData.schedule) {
        const classroom = appData.classrooms.find(c => c.id === classroomId);
        const roomNumber = classroom ? classroom.roomNumber : 'Unknown';

        for (const day in appData.schedule[classroomId]) {
            for (const time in appData.schedule[classroomId][day]) {
                const slotData = appData.schedule[classroomId][day][time];
                const courses = Array.isArray(slotData) ? slotData : (slotData ? [slotData] : []);

                courses.forEach(item => {
                    scheduledCourseIds.add(item.courseId);
                    const key = `${day}|${time}`;
                    if (!timeslotMap[key]) timeslotMap[key] = [];
                    timeslotMap[key].push({
                        courseId: item.courseId,
                        classroomId: classroomId,
                        roomNumber: roomNumber,
                        modality: item.modality,
                        section: item.section || ''
                    });
                });
            }
        }
    }

    // Check for instructor conflicts
    for (const key in timeslotMap) {
        const entries = timeslotMap[key];
        const [day, time] = key.split('|');

        const instructorGroups = {};
        entries.forEach(entry => {
            const course = appData.courseCatalog.find(c => c.id === entry.courseId);
            const instrKey = getCourseInstructorKey(entry.courseId, entry.section);
            const instructorId = scheduleData.courseInstructors[instrKey] || null;
            if (course && instructorId) {
                if (!instructorGroups[instructorId]) {
                    instructorGroups[instructorId] = [];
                }
                const sectionSuffix = entry.section ? ` \u00a7${entry.section}` : '';
                instructorGroups[instructorId].push({
                    ...entry,
                    courseName: getCourseDisplayName(course) + sectionSuffix
                });
            }
        });

        for (const instructorId in instructorGroups) {
            const group = instructorGroups[instructorId];
            // Conflict if instructor has more than one distinct (courseId, section) pair in same timeslot
            const uniquePairs = [...new Set(group.map(g => getCourseInstructorKey(g.courseId, g.section)))];
            if (uniquePairs.length > 1) {
                const instructor = appData.instructors.find(i => i.id === instructorId);
                const instructorName = instructor ? instructor.name : 'Unknown';
                const courseNames = group.map(g => `${g.courseName} (Room ${g.roomNumber})`).join(', ');
                errors.push({
                    type: 'instructor',
                    message: `<strong>${instructorName}</strong> is scheduled for multiple classes on <strong>${day} ${time}</strong>: ${courseNames}`
                });
            }
        }

        // Cohort/quarter conflicts
        const quarterGroups = {};
        entries.forEach(entry => {
            const course = appData.courseCatalog.find(c => c.id === entry.courseId);
            if (course && course.quarterTaken) {
                const qKey = course.quarterTaken.trim().toUpperCase();
                if (!quarterGroups[qKey]) {
                    quarterGroups[qKey] = [];
                }
                quarterGroups[qKey].push({
                    ...entry,
                    courseName: getCourseDisplayName(course),
                    quarterTaken: course.quarterTaken
                });
            }
        });

        for (const quarter in quarterGroups) {
            const group = quarterGroups[quarter];
            const uniqueCourseIds = [...new Set(group.map(g => g.courseId))];
            if (uniqueCourseIds.length > 1) {
                const courseNames = group.map(g => `${g.courseName} (Room ${g.roomNumber})`).join(', ');
                errors.push({
                    type: 'cohort',
                    message: `<strong>Cohort ${group[0].quarterTaken}</strong> has multiple classes on <strong>${day} ${time}</strong>: ${courseNames}`
                });
            }
        }
    }

    // Check for courses without a program (only scheduled courses)
    scheduledCourseIds.forEach(courseId => {
        const course = appData.courseCatalog.find(c => c.id === courseId);
        if (course && !course.programId) {
            errors.push({
                type: 'program',
                message: `<strong>${getCourseDisplayName(course)}</strong> is not assigned to a program`
            });
        }
    });

    // Check for quarter availability (only if schedule has a quarter set)
    if (scheduleQuarter) {
        scheduledCourseIds.forEach(courseId => {
            const course = appData.courseCatalog.find(c => c.id === courseId);
            if (course && course.quartersOffered && course.quartersOffered.length > 0) {
                if (!course.quartersOffered.includes(scheduleQuarter)) {
                    errors.push({
                        type: 'quarter',
                        message: `<strong>${getCourseDisplayName(course)}</strong> is not offered in <strong>${scheduleQuarter}</strong> quarter (offered: ${course.quartersOffered.join(', ')})`
                    });
                }
            }
            // If quartersOffered is empty or not set, course is "on demand" - no error
        });
    }

    // Check if schedule has no quarter set
    if (!scheduleQuarter) {
        errors.push({
            type: 'quarter',
            message: `<strong>Schedule "${appData.currentSchedule}"</strong> does not have a quarter assigned. Please select a quarter.`
        });
    }

    return errors;
}

function renderValidationSummary() {
    const errors = validateSchedule();
    const summaryDiv = document.getElementById('validationSummary');
    const errorsDiv = document.getElementById('validationErrors');
    const countSpan = document.getElementById('validationCount');

    if (!summaryDiv || !errorsDiv || !countSpan) return;

    if (errors.length === 0) {
        summaryDiv.style.display = 'none';
        return;
    }

    summaryDiv.style.display = 'block';
    countSpan.textContent = errors.length;

    errorsDiv.innerHTML = errors.map(err => {
        let typeClass, icon;
        switch (err.type) {
            case 'instructor': typeClass = 'instructor-conflict'; icon = '👨‍🏫'; break;
            case 'cohort': typeClass = 'cohort-conflict'; icon = '🎓'; break;
            case 'program': typeClass = 'program-conflict'; icon = '📂'; break;
            case 'quarter': typeClass = 'quarter-conflict'; icon = '📅'; break;
            default: typeClass = ''; icon = '⚠️';
        }
        return `
            <div class="validation-error-item ${typeClass}">
                <span class="validation-error-icon">${icon}</span>
                <span class="validation-error-text">${err.message}</span>
            </div>
        `;
    }).join('');
}

function renderPrograms() {
    const container = document.getElementById('programsList');
    if (!container) return;

    if (appData.programs.length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">No programs added yet</p>';
        return;
    }

    container.innerHTML = appData.programs.map(program => {
        const courseCount = appData.courseCatalog.filter(c => c.programId === program.id).length;
        return `
            <div class="program-item" ondblclick="showEditProgramPrompt('${program.id}')" style="cursor: pointer;">
                <div>
                    <div class="program-name">${program.name}</div>
                    <div class="program-meta">${courseCount} course${courseCount !== 1 ? 's' : ''}</div>
                </div>
                <button class="delete-btn" onclick="event.stopPropagation(); deleteProgram('${program.id}')">Delete</button>
            </div>
        `;
    }).join('');
}

function renderInstructors() {
    const container = document.getElementById('instructorsList');

    if (appData.instructors.length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">No instructors added yet</p>';
        const filterList = document.getElementById('instructorFilterList');
        if (filterList) filterList.innerHTML = '<p style="padding: 10px; color: #7f8c8d;">No instructors</p>';
        return;
    }

    container.innerHTML = appData.instructors.map(instructor => {
        const workload = getInstructorWorkload(instructor.id);
        const color = instructor.color || '#3498db';
        return `
            <div class="instructor-item" ondblclick="showInstructorModal('${instructor.id}')" style="cursor: pointer; border-left: 4px solid ${color};">
                <div>
                    <div>${instructor.name}</div>
                    <div class="workload">${workload} credits</div>
                </div>
                <button class="delete-btn" onclick="event.stopPropagation(); deleteInstructor('${instructor.id}')">Delete</button>
            </div>
        `;
    }).join('');

    // Render filter list
    const filterList = document.getElementById('instructorFilterList');
    if (filterList) {
        if (!appData.instructorFilter) appData.instructorFilter = [];
        filterList.innerHTML = appData.instructors.map(instructor => {
            const checked = appData.instructorFilter.includes(instructor.id);
            const color = instructor.color || '#3498db';
            return `
                <label class="filter-checkbox">
                    <input type="checkbox" ${checked ? 'checked' : ''}
                           onchange="updateInstructorFilter('${instructor.id}', this.checked)">
                    <span class="color-indicator" style="background: ${color};"></span>
                    <span>${instructor.name}</span>
                </label>
            `;
        }).join('');
    }
}

function renderCourses() {
    const container = document.getElementById('coursesList');
    const programSelect = document.getElementById('courseProgram');

    // Update program dropdown in add form
    if (programSelect) {
        programSelect.innerHTML = '<option value="">Select Program</option>' +
            appData.programs.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }

    // Update program filter dropdown
    const programFilterSelect = document.getElementById('programFilterSelect');
    if (programFilterSelect) {
        const currentFilter = appData.programFilter || '';
        programFilterSelect.innerHTML = '<option value="">All Programs</option>' +
            appData.programs.map(p => `<option value="${p.id}" ${p.id === currentFilter ? 'selected' : ''}>${p.name}</option>`).join('');
    }

    // Filter courses by program
    let displayCourses = appData.courseCatalog;
    if (appData.programFilter) {
        displayCourses = displayCourses.filter(c => c.programId === appData.programFilter);
    }

    if (displayCourses.length === 0) {
        container.innerHTML = appData.courseCatalog.length === 0
            ? '<p style="color: #7f8c8d; font-size: 14px;">No courses added yet</p>'
            : '<p style="color: #7f8c8d; font-size: 14px;">No courses match the selected filter</p>';
        return;
    }

    const scheduleData = getCurrentScheduleData();

    container.innerHTML = displayCourses.map(course => {
        const instructorId = scheduleData.courseInstructors[course.id] || null;
        const instructor = instructorId ? appData.instructors.find(i => i.id === instructorId) : null;
        const isScheduled = isCourseScheduled(course.id);
        const statusClass = isScheduled ? 'course-scheduled' : 'course-unscheduled';
        const quarterLabel = course.quarterTaken ? ` • ${course.quarterTaken}` : '';
        const displayName = getCourseDisplayName(course);
        const hasNoProgram = !course.programId;
        const quartersStr = (course.quartersOffered && course.quartersOffered.length > 0) ? ` • ${course.quartersOffered.join(', ')}` : '';
        return `
            <div class="course-item ${statusClass} ${hasNoProgram ? 'course-no-program' : ''}" draggable="true"
                 ondragstart="handleDragStart(event, '${course.id}')"
                 ondragend="handleDragEnd(event)"
                 ondblclick="showCourseModalFromList('${course.id}')">
                <div class="course-info">
                    <div class="course-name">${displayName}${hasNoProgram ? ' <span class="no-program-badge" title="No program assigned">⚠️</span>' : ''}</div>
                    <div class="course-meta">${course.credits} credits${instructor ? ' • ' + instructor.name : ''}${quarterLabel}${quartersStr}</div>
                </div>
                <button class="delete-btn" onclick="event.stopPropagation(); deleteCourse('${course.id}')">Delete</button>
            </div>
        `;
    }).join('');
}

function renderSchedule() {
    const container = document.getElementById('scheduleGrid');

    if (appData.classrooms.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No classrooms added yet</p></div>';
        return;
    }

    const scheduleData = getCurrentScheduleData();

    container.innerHTML = appData.classrooms.map(classroom => {
        const dayTimeslots = {};
        DAYS.forEach(day => {
            dayTimeslots[day] = classroom.timeslots[day] || [];
        });

        const allTimeslots = new Set();
        DAYS.filter(day => day !== 'Arranged').forEach(day => {
            (classroom.timeslots[day] || []).forEach(ts => allTimeslots.add(ts));
        });
        const sortedTimeslots = Array.from(allTimeslots).sort();

        const scheduleHTML = sortedTimeslots.length > 0 ? `
            <div class="classroom-schedule ${!classroom.visible ? 'hidden' : ''}">
                <div class="day-header"></div>
                ${DAYS.map(day => `<div class="day-header">${day}</div>`).join('')}

                ${sortedTimeslots.map((timeslot, rowIndex) => `
                    <div class="time-label">${timeslot}</div>
                    ${DAYS.map(day => {
                        if (day === 'Arranged') {
                            if (rowIndex === 0) {
                                const slotData = appData.schedule[classroom.id]?.[day]?.['arranged'];
                                const courses = Array.isArray(slotData) ? slotData : (slotData ? [slotData] : []);

                                const modalityIcon = { 'in-person': '🏫', 'online': '💻', 'hybrid': '🔄' };

                                return `
                                    <div class="time-slot arranged-slot ${courses.length > 0 ? 'occupied' : ''}" style="grid-row: span ${sortedTimeslots.length};"
                                         ondragover="handleDragOver(event)"
                                         ondragleave="handleDragLeave(event)"
                                         ondrop="handleDrop(event, '${classroom.id}', '${day}', 'arranged')">
                                        ${courses.map((item, index) => {
                                            const course = appData.courseCatalog.find(c => c.id === item.courseId);
                                            const instrKey = getCourseInstructorKey(item.courseId, item.section);
                                            const instructorId = scheduleData.courseInstructors[instrKey] || null;
                                            const instructor = instructorId ? appData.instructors.find(i => i.id === instructorId) : null;
                                            const courseStyle = getScheduledCourseStyle(course, item.courseId, item.section);
                                            const displayName = getCourseDisplayName(course);
                                            const sectionLabel = item.section ? ` <span class="section-badge">§${item.section}</span>` : '';
                                            return `
                                                <div class="scheduled-course"
                                                     style="${courseStyle}"
                                                     draggable="true"
                                                     data-source-classroom-id="${classroom.id}"
                                                     data-source-day="${day}"
                                                     data-source-timeslot="arranged"
                                                     data-source-course-index="${index}"
                                                     data-source-section="${item.section || ''}"
                                                     ondragstart="handleDragStart(event, '${item.courseId}')"
                                                     ondragend="handleDragEnd(event)"
                                                     ondblclick="showCourseModal('${item.courseId}', '${classroom.id}', '${day}', 'arranged', ${index})">
                                                    <button class="remove-course" onclick="event.stopPropagation(); unscheduleCourse('${classroom.id}', '${day}', 'arranged', ${index})">&times;</button>
                                                    <div class="course-name">${displayName}${sectionLabel}</div>
                                                    <div class="course-meta">
                                                        ${course ? course.credits + ' credits' : ''}${instructor ? ' • ' + instructor.name : ''}${course && course.quarterTaken ? '<span class="quarter-badge">' + course.quarterTaken + '</span>' : ''}
                                                        <span class="modality-badge">${modalityIcon[item.modality]} ${item.modality}</span>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                `;
                            } else {
                                return '';
                            }
                        }

                        const hasTimeslot = (classroom.timeslots[day] || []).includes(timeslot);
                        if (!hasTimeslot) {
                            return `<div class="time-slot" style="background: #f0f0f0;"></div>`;
                        }

                        const slotData = appData.schedule[classroom.id]?.[day]?.[timeslot];
                        const courses = Array.isArray(slotData) ? slotData : (slotData ? [slotData] : []);

                        const hasConflict = hasInPersonConflict(day, timeslot);

                        const modalityIcon = { 'in-person': '🏫', 'online': '💻', 'hybrid': '🔄' };

                        if (courses.length > 0) {
                            return `
                                <div class="time-slot occupied ${hasConflict ? 'conflict' : ''}"
                                     ondragover="handleDragOver(event)"
                                     ondragleave="handleDragLeave(event)"
                                     ondrop="handleDrop(event, '${classroom.id}', '${day}', '${timeslot}')">
                                    ${courses.map((item, index) => {
                                        const course = appData.courseCatalog.find(c => c.id === item.courseId);
                                        const instrKey = getCourseInstructorKey(item.courseId, item.section);
                                        const instructorId = scheduleData.courseInstructors[instrKey] || null;
                                        const instructor = instructorId ? appData.instructors.find(i => i.id === instructorId) : null;
                                        const courseStyle = getScheduledCourseStyle(course, item.courseId, item.section);
                                        const displayName = getCourseDisplayName(course);
                                        const sectionLabel = item.section ? ` <span class="section-badge">§${item.section}</span>` : '';
                                        return `
                                            <div class="scheduled-course"
                                                 style="${courseStyle}"
                                                 draggable="true"
                                                 data-source-classroom-id="${classroom.id}"
                                                 data-source-day="${day}"
                                                 data-source-timeslot="${timeslot}"
                                                 data-source-course-index="${index}"
                                                 data-source-section="${item.section || ''}"
                                                 ondragstart="handleDragStart(event, '${item.courseId}')"
                                                 ondragend="handleDragEnd(event)"
                                                 ondblclick="showCourseModal('${item.courseId}', '${classroom.id}', '${day}', '${timeslot}', ${index})">
                                                <button class="remove-course" onclick="event.stopPropagation(); unscheduleCourse('${classroom.id}', '${day}', '${timeslot}', ${index})">&times;</button>
                                                <div class="course-name">${displayName}${sectionLabel}${hasConflict ? ' ⚠️' : ''}</div>
                                                <div class="course-meta">
                                                    ${course ? course.credits + ' credits' : ''}${instructor ? ' • ' + instructor.name : ''}${course && course.quarterTaken ? '<span class="quarter-badge">' + course.quarterTaken + '</span>' : ''}
                                                    <span class="modality-badge">${modalityIcon[item.modality]} ${item.modality}</span>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            `;
                        } else {
                            return `
                                <div class="time-slot"
                                     ondragover="handleDragOver(event)"
                                     ondragleave="handleDragLeave(event)"
                                     ondrop="handleDrop(event, '${classroom.id}', '${day}', '${timeslot}')">
                                </div>
                            `;
                        }
                    }).join('')}
                `).join('')}
            </div>
            <div class="timeslot-form-header" onclick="toggleTimeslotForm('${classroom.id}')">
                <span>${classroom.timeslotFormExpanded !== false ? '▼' : '▶'} Manage Time Slots</span>
            </div>
            <div class="timeslot-form" style="display: ${classroom.timeslotFormExpanded !== false ? 'block' : 'none'};">
                ${DAYS.filter(day => day !== 'Arranged').map(day => `
                    <div class="timeslot-day-section">
                        <h5>${day}</h5>
                        <div class="timeslot-inputs">
                            <input type="time" id="startTime-${classroom.id}-${day}" placeholder="Start">
                            <input type="time" id="endTime-${classroom.id}-${day}" placeholder="End">
                            <button onclick="addTimeslotFromForm('${classroom.id}', '${day}')">Add</button>
                            ${day === 'Monday' && (classroom.timeslots[day] || []).length > 0 ? `
                                <button onclick="copyTimeslotsToAllDays('${classroom.id}', '${day}')" style="background: #27ae60;">Copy to All</button>
                            ` : ''}
                        </div>
                        ${(classroom.timeslots[day] || []).length > 0 ? `
                            <div class="timeslots-list">
                                ${classroom.timeslots[day].map(ts => `
                                    <div class="timeslot-tag">
                                        ${ts}
                                        <button onclick="removeTimeslot('${classroom.id}', '${day}', '${ts}')">&times;</button>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        ` : `
            <div class="classroom-schedule ${!classroom.visible ? 'hidden' : ''}">
                <div class="day-header"></div>
                ${DAYS.map(day => `<div class="day-header">${day}</div>`).join('')}
                <div class="time-label">No times</div>
                ${DAYS.map(day => {
                    if (day === 'Arranged') {
                        const slotData = appData.schedule[classroom.id]?.[day]?.['arranged'];
                        const courses = Array.isArray(slotData) ? slotData : (slotData ? [slotData] : []);

                        const modalityIcon = { 'in-person': '🏫', 'online': '💻', 'hybrid': '🔄' };

                        return `
                            <div class="time-slot arranged-slot ${courses.length > 0 ? 'occupied' : ''}"
                                 ondragover="handleDragOver(event)"
                                 ondragleave="handleDragLeave(event)"
                                 ondrop="handleDrop(event, '${classroom.id}', '${day}', 'arranged')">
                                ${courses.map((item, index) => {
                                    const course = appData.courseCatalog.find(c => c.id === item.courseId);
                                    const instrKey = getCourseInstructorKey(item.courseId, item.section);
                                    const instructorId = scheduleData.courseInstructors[instrKey] || null;
                                    const instructor = instructorId ? appData.instructors.find(i => i.id === instructorId) : null;
                                    const courseStyle = getScheduledCourseStyle(course, item.courseId, item.section);
                                    const displayName = getCourseDisplayName(course);
                                    const sectionLabel = item.section ? ` <span class="section-badge">§${item.section}</span>` : '';
                                    return `
                                        <div class="scheduled-course"
                                             style="${courseStyle}"
                                             draggable="true"
                                             data-source-classroom-id="${classroom.id}"
                                             data-source-day="${day}"
                                             data-source-timeslot="arranged"
                                             data-source-course-index="${index}"
                                             data-source-section="${item.section || ''}"
                                             ondragstart="handleDragStart(event, '${item.courseId}')"
                                             ondragend="handleDragEnd(event)"
                                             ondblclick="showCourseModal('${item.courseId}', '${classroom.id}', '${day}', 'arranged', ${index})">
                                            <button class="remove-course" onclick="event.stopPropagation(); unscheduleCourse('${classroom.id}', '${day}', 'arranged', ${index})">&times;</button>
                                            <div class="course-name">${displayName}${sectionLabel}</div>
                                            <div class="course-meta">
                                                ${course ? course.credits + ' credits' : ''}${instructor ? ' • ' + instructor.name : ''}${course && course.quarterTaken ? '<span class="quarter-badge">' + course.quarterTaken + '</span>' : ''}
                                                <span class="modality-badge">${modalityIcon[item.modality]} ${item.modality}</span>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `;
                    } else {
                        return `<div class="time-slot" style="background: #f0f0f0;"></div>`;
                    }
                }).join('')}
            </div>
            <div class="timeslot-form-header" onclick="toggleTimeslotForm('${classroom.id}')">
                <span>${classroom.timeslotFormExpanded !== false ? '▼' : '▶'} Manage Time Slots</span>
            </div>
            <div class="timeslot-form" style="display: ${classroom.timeslotFormExpanded !== false ? 'block' : 'none'};">
                ${DAYS.filter(day => day !== 'Arranged').map(day => `
                    <div class="timeslot-day-section">
                        <h5>${day}</h5>
                        <div class="timeslot-inputs">
                            <input type="time" id="startTime-${classroom.id}-${day}" placeholder="Start">
                            <input type="time" id="endTime-${classroom.id}-${day}" placeholder="End">
                            <button onclick="addTimeslotFromForm('${classroom.id}', '${day}')">Add</button>
                            ${day === 'Monday' ? `
                                <button onclick="copyTimeslotsToAllDays('${classroom.id}', '${day}')" style="background: #27ae60;">Copy to All</button>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        return `
            <div class="classroom-container">
                <div class="classroom-header">
                    <h3>Room ${classroom.roomNumber}</h3>
                    <div class="classroom-controls">
                        <button class="toggle-btn" onclick="toggleClassroom('${classroom.id}')">
                            ${classroom.visible ? 'Hide' : 'Show'}
                        </button>
                        <button class="delete-btn" onclick="deleteClassroom('${classroom.id}')">Delete</button>
                    </div>
                </div>
                ${scheduleHTML}
            </div>
        `;
    }).join('');
}

function addTimeslotFromForm(classroomId, day) {
    const startTimeInput = document.getElementById(`startTime-${classroomId}-${day}`);
    const endTimeInput = document.getElementById(`endTime-${classroomId}-${day}`);

    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;

    if (startTime && endTime) {
        if (startTime >= endTime) {
            alert('End time must be after start time');
            return;
        }
        addTimeslot(classroomId, day, startTime, endTime);
        startTimeInput.value = '';
        endTimeInput.value = '';
    }
}

// LocalStorage functions
function saveToLocalStorage() {
    localStorage.setItem('workloadSchedulerData', JSON.stringify(appData));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('workloadSchedulerData');
    if (saved) {
        try {
            const loaded = JSON.parse(saved);

            // Check for new format with programs and courseCatalog
            if (loaded.programs !== undefined && loaded.courseCatalog !== undefined) {
                appData.programs = loaded.programs || [];
                appData.courseCatalog = loaded.courseCatalog || [];
                appData.schedules = loaded.schedules || {};
                appData.currentSchedule = loaded.currentSchedule || 'Default Schedule';
                appData.collapsedSections = loaded.collapsedSections || {};
                appData.instructorFilter = loaded.instructorFilter || [];
                appData.programFilter = loaded.programFilter || '';
            }
            // Migrate from old multi-schedule format (has schedules but no programs/courseCatalog)
            else if (loaded.schedules && typeof loaded.schedules === 'object' && loaded.currentSchedule) {
                appData.programs = [];
                appData.courseCatalog = [];
                appData.schedules = loaded.schedules;
                appData.currentSchedule = loaded.currentSchedule;
                appData.collapsedSections = loaded.collapsedSections || {};
                appData.instructorFilter = loaded.instructorFilter || [];
                appData.programFilter = '';

                // Migrate: extract courses from all schedules into courseCatalog
                const courseMap = {}; // id -> course (without instructorId)
                Object.keys(appData.schedules).forEach(scheduleName => {
                    const sd = appData.schedules[scheduleName];
                    if (sd.courses && Array.isArray(sd.courses)) {
                        sd.courses.forEach(course => {
                            if (!courseMap[course.id]) {
                                const { instructorId, ...catalogCourse } = course;
                                catalogCourse.programId = null;
                                catalogCourse.courseNumber = '';
                                catalogCourse.quartersOffered = [];
                                courseMap[course.id] = catalogCourse;
                            }
                            // Create instructor assignment
                            if (!sd.courseInstructors) sd.courseInstructors = {};
                            if (course.instructorId) {
                                sd.courseInstructors[course.id] = course.instructorId;
                            }
                        });
                        delete sd.courses; // Remove old courses array
                    }
                    if (!sd.quarter) sd.quarter = '';
                    if (!sd.courseInstructors) sd.courseInstructors = {};
                });
                appData.courseCatalog = Object.values(courseMap);
            }
            // Migrate from old single-schedule format
            else if (loaded.instructors || loaded.courses || loaded.classrooms || loaded.schedule) {
                appData.programs = [];
                appData.courseCatalog = [];
                appData.collapsedSections = loaded.collapsedSections || {};
                appData.instructorFilter = loaded.instructorFilter || [];
                appData.programFilter = '';

                const courses = loaded.courses || [];
                const courseInstructors = {};
                courses.forEach(course => {
                    const { instructorId, ...catalogCourse } = course;
                    catalogCourse.programId = null;
                    catalogCourse.courseNumber = '';
                    catalogCourse.quartersOffered = [];
                    appData.courseCatalog.push(catalogCourse);
                    if (instructorId) {
                        courseInstructors[course.id] = instructorId;
                    }
                });

                appData.schedules = {
                    'Default Schedule': {
                        quarter: '',
                        instructors: loaded.instructors || [],
                        courseInstructors: courseInstructors,
                        classrooms: loaded.classrooms || [],
                        schedule: loaded.schedule || {}
                    }
                };
                appData.currentSchedule = 'Default Schedule';
            } else {
                console.warn('Unrecognized data format, initializing with default schedule');
                return;
            }

            // Initialize missing global properties
            if (!appData.programs) appData.programs = [];
            if (!appData.courseCatalog) appData.courseCatalog = [];
            if (!appData.collapsedSections) appData.collapsedSections = {};
            if (!appData.instructorFilter) appData.instructorFilter = [];
            if (!appData.schedules) appData.schedules = {};
            if (!appData.currentSchedule) appData.currentSchedule = 'Default Schedule';
            if (appData.programFilter === undefined) appData.programFilter = '';

            // Ensure currentSchedule exists
            if (!appData.schedules[appData.currentSchedule]) {
                const firstSchedule = Object.keys(appData.schedules)[0];
                if (firstSchedule) {
                    appData.currentSchedule = firstSchedule;
                } else {
                    appData.schedules['Default Schedule'] = {
                        quarter: '',
                        instructors: [],
                        courseInstructors: {},
                        classrooms: [],
                        schedule: {}
                    };
                    appData.currentSchedule = 'Default Schedule';
                }
            }

            // Ensure courseCatalog entries have new fields
            appData.courseCatalog.forEach(course => {
                if (!course.programId) course.programId = null;
                if (!course.courseNumber) course.courseNumber = '';
                if (!course.quartersOffered) course.quartersOffered = [];
            });

            // Migrate data for all schedules
            Object.keys(appData.schedules).forEach(scheduleName => {
                const scheduleData = appData.schedules[scheduleName];

                if (!scheduleData.instructors) scheduleData.instructors = [];
                if (!scheduleData.courseInstructors) scheduleData.courseInstructors = {};
                if (!scheduleData.classrooms) scheduleData.classrooms = [];
                if (!scheduleData.schedule) scheduleData.schedule = {};
                if (scheduleData.quarter === undefined) scheduleData.quarter = '';

                // Remove old courses array if still present
                if (scheduleData.courses) {
                    if (!scheduleData.courseInstructors) scheduleData.courseInstructors = {};
                    scheduleData.courses.forEach(course => {
                        if (course.instructorId) {
                            scheduleData.courseInstructors[course.id] = course.instructorId;
                        }
                        // Add to catalog if not already there
                        if (!appData.courseCatalog.find(c => c.id === course.id)) {
                            const { instructorId, ...catalogCourse } = course;
                            catalogCourse.programId = null;
                            catalogCourse.courseNumber = '';
                            catalogCourse.quartersOffered = [];
                            appData.courseCatalog.push(catalogCourse);
                        }
                    });
                    delete scheduleData.courses;
                }

                // Ensure instructors have colors
                (scheduleData.instructors || []).forEach(instructor => {
                    if (!instructor.color) {
                        instructor.color = '#3498db';
                    }
                });

                // Migrate classroom data
                (scheduleData.classrooms || []).forEach(classroom => {
                    if (Array.isArray(classroom.timeslots)) {
                        const oldTimeslots = [...classroom.timeslots];
                        classroom.timeslots = {};
                        DAYS.forEach(day => {
                            classroom.timeslots[day] = [...oldTimeslots];
                        });
                    }

                    if (!classroom.timeslots || typeof classroom.timeslots !== 'object') {
                        classroom.timeslots = {};
                    }

                    DAYS.forEach(day => {
                        if (!classroom.timeslots[day]) {
                            classroom.timeslots[day] = [];
                        }
                    });

                    if (classroom.timeslotFormExpanded === undefined) {
                        classroom.timeslotFormExpanded = true;
                    }

                    if (!scheduleData.schedule[classroom.id]) {
                        scheduleData.schedule[classroom.id] = {};
                        DAYS.forEach(day => {
                            scheduleData.schedule[classroom.id][day] = {};
                        });
                    }

                    // Migrate schedule from old format to new array format
                    DAYS.forEach(day => {
                        if (scheduleData.schedule[classroom.id][day]) {
                            Object.keys(scheduleData.schedule[classroom.id][day]).forEach(time => {
                                const value = scheduleData.schedule[classroom.id][day][time];
                                if (typeof value === 'string') {
                                    scheduleData.schedule[classroom.id][day][time] = [{
                                        courseId: value,
                                        modality: 'in-person',
                                        section: ''
                                    }];
                                } else if (value && !Array.isArray(value) && value.courseId) {
                                    if (value.section === undefined) value.section = '';
                                    scheduleData.schedule[classroom.id][day][time] = [value];
                                } else if (Array.isArray(value)) {
                                    value.forEach(item => {
                                        if (item && item.section === undefined) item.section = '';
                                    });
                                }
                            });
                        }
                    });
                });
            });

            saveToLocalStorage();
        } catch (e) {
            console.error('Error loading data:', e);
        }
    }
}

// Export/Import functions
function exportData() {
    const defaultName = `${appData.currentSchedule.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`;
    const filename = prompt('Enter filename for export (without .json extension):', defaultName);

    if (filename === null) return;

    const finalFilename = filename.trim() || defaultName;

    const exportPayload = {
        version: '3.0',
        exportDate: new Date().toISOString(),
        scheduleName: appData.currentSchedule,
        programs: appData.programs,
        courseCatalog: appData.courseCatalog,
        data: getCurrentScheduleData()
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

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const imported = JSON.parse(event.target.result);

            // Version 3.0: new format with programs + courseCatalog
            if (imported.version === '3.0' && imported.scheduleName && imported.data) {
                const scheduleData = imported.data;

                if (scheduleData.instructors && scheduleData.classrooms && scheduleData.schedule) {
                    const scheduleName = prompt('Enter name for this schedule:', imported.scheduleName);
                    if (!scheduleName || !scheduleName.trim()) {
                        alert('Import cancelled.');
                        return;
                    }

                    const finalName = scheduleName.trim();
                    if (appData.schedules[finalName]) {
                        if (!confirm(`Schedule "${finalName}" already exists. Override it?`)) return;
                    }

                    // Merge programs (avoid duplicates by name)
                    if (imported.programs) {
                        imported.programs.forEach(prog => {
                            if (!appData.programs.find(p => p.id === prog.id)) {
                                // Check by name too
                                const existing = appData.programs.find(p => p.name === prog.name);
                                if (!existing) {
                                    appData.programs.push(prog);
                                }
                            }
                        });
                    }

                    // Merge course catalog (avoid duplicates by ID)
                    if (imported.courseCatalog) {
                        imported.courseCatalog.forEach(course => {
                            if (!appData.courseCatalog.find(c => c.id === course.id)) {
                                appData.courseCatalog.push(course);
                            }
                        });
                    }

                    appData.schedules[finalName] = scheduleData;
                    appData.currentSchedule = finalName;

                    saveToLocalStorage();
                    renderScheduleSelector();
                    render();
                    alert(`Schedule "${finalName}" imported successfully!`);
                } else {
                    alert('Invalid data format in file');
                }
            }
            // Version 2.0: old format with courses per schedule
            else if (imported.version === '2.0' && imported.scheduleName && imported.data) {
                const data = imported.data;

                if (data.instructors && data.courses && data.classrooms && data.schedule) {
                    const scheduleName = prompt('Enter name for this schedule:', imported.scheduleName);
                    if (!scheduleName || !scheduleName.trim()) {
                        alert('Import cancelled.');
                        return;
                    }

                    const finalName = scheduleName.trim();
                    if (appData.schedules[finalName]) {
                        if (!confirm(`Schedule "${finalName}" already exists. Override it?`)) return;
                    }

                    // Migrate courses to catalog
                    const courseInstructors = {};
                    data.courses.forEach(course => {
                        if (!appData.courseCatalog.find(c => c.id === course.id)) {
                            const { instructorId, ...catalogCourse } = course;
                            catalogCourse.programId = null;
                            catalogCourse.courseNumber = '';
                            catalogCourse.quartersOffered = [];
                            appData.courseCatalog.push(catalogCourse);
                        }
                        if (course.instructorId) {
                            courseInstructors[course.id] = course.instructorId;
                        }
                    });

                    appData.schedules[finalName] = {
                        quarter: '',
                        instructors: data.instructors,
                        courseInstructors: courseInstructors,
                        classrooms: data.classrooms,
                        schedule: data.schedule
                    };
                    appData.currentSchedule = finalName;

                    saveToLocalStorage();
                    renderScheduleSelector();
                    render();
                    alert(`Schedule "${finalName}" imported successfully! (migrated from v2.0)`);
                } else {
                    alert('Invalid data format in file');
                }
            }
            // Version 1.0
            else if (imported.version === '1.0' && imported.data) {
                const data = imported.data;

                if (data.instructors && data.courses && data.classrooms && data.schedule) {
                    const scheduleName = prompt('Enter name for this schedule:', 'Imported Schedule');
                    if (!scheduleName || !scheduleName.trim()) {
                        alert('Import cancelled.');
                        return;
                    }

                    const finalName = scheduleName.trim();
                    if (appData.schedules[finalName]) {
                        if (!confirm(`Schedule "${finalName}" already exists. Override it?`)) return;
                    }

                    const courseInstructors = {};
                    data.courses.forEach(course => {
                        if (!appData.courseCatalog.find(c => c.id === course.id)) {
                            const { instructorId, ...catalogCourse } = course;
                            catalogCourse.programId = null;
                            catalogCourse.courseNumber = '';
                            catalogCourse.quartersOffered = [];
                            appData.courseCatalog.push(catalogCourse);
                        }
                        if (course.instructorId) {
                            courseInstructors[course.id] = course.instructorId;
                        }
                    });

                    appData.schedules[finalName] = {
                        quarter: '',
                        instructors: data.instructors,
                        courseInstructors: courseInstructors,
                        classrooms: data.classrooms,
                        schedule: data.schedule
                    };
                    appData.currentSchedule = finalName;

                    saveToLocalStorage();
                    renderScheduleSelector();
                    render();
                    alert(`Schedule "${finalName}" imported successfully! (migrated from v1.0)`);
                } else {
                    alert('Invalid data format in versioned file');
                }
            }
            // Legacy format
            else if (imported.instructors && imported.courses && imported.classrooms && imported.schedule) {
                const scheduleName = prompt('Enter name for this schedule:', 'Imported Schedule');
                if (!scheduleName || !scheduleName.trim()) {
                    alert('Import cancelled.');
                    return;
                }

                const finalName = scheduleName.trim();
                if (appData.schedules[finalName]) {
                    if (!confirm(`Schedule "${finalName}" already exists. Override it?`)) return;
                }

                const courseInstructors = {};
                imported.courses.forEach(course => {
                    if (!appData.courseCatalog.find(c => c.id === course.id)) {
                        const { instructorId, ...catalogCourse } = course;
                        catalogCourse.programId = null;
                        catalogCourse.courseNumber = '';
                        catalogCourse.quartersOffered = [];
                        appData.courseCatalog.push(catalogCourse);
                    }
                    if (course.instructorId) {
                        courseInstructors[course.id] = course.instructorId;
                    }
                });

                appData.schedules[finalName] = {
                    quarter: '',
                    instructors: imported.instructors,
                    courseInstructors: courseInstructors,
                    classrooms: imported.classrooms,
                    schedule: imported.schedule
                };
                appData.currentSchedule = finalName;

                saveToLocalStorage();
                renderScheduleSelector();
                render();
                alert(`Schedule "${finalName}" imported successfully! (Legacy format)`);
            } else {
                alert('Invalid data format');
            }
        } catch (e) {
            alert('Error importing data: ' + e.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}
