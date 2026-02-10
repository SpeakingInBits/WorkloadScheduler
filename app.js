// Data structure
let appData = {
    schedules: {
        'Default Schedule': {
            instructors: [],
            courses: [],
            classrooms: [],
            schedule: {} // { classroomId: { day: { time: { courseId, modality } } } }
        }
    },
    currentSchedule: 'Default Schedule',
    collapsedSections: {}, // Track which sections are collapsed
    instructorFilter: [] // Array of instructor IDs to filter
};

// Helper to get current schedule data
function getCurrentScheduleData() {
    if (!appData.schedules[appData.currentSchedule]) {
        appData.schedules[appData.currentSchedule] = {
            instructors: [],
            courses: [],
            classrooms: [],
            schedule: {}
        };
    }
    const scheduleData = appData.schedules[appData.currentSchedule];
    
    // Ensure all required properties exist
    if (!scheduleData.instructors) scheduleData.instructors = [];
    if (!scheduleData.courses) scheduleData.courses = [];
    if (!scheduleData.classrooms) scheduleData.classrooms = [];
    if (!scheduleData.schedule) scheduleData.schedule = {};
    
    return scheduleData;
}

// Helper properties for backward compatibility
Object.defineProperties(appData, {
    instructors: {
        get() { return getCurrentScheduleData().instructors; },
        set(value) { getCurrentScheduleData().instructors = value; }
    },
    courses: {
        get() { return getCurrentScheduleData().courses; },
        set(value) { getCurrentScheduleData().courses = value; }
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
}

function switchSchedule() {
    const select = document.getElementById('scheduleSelect');
    appData.currentSchedule = select.value;
    saveToLocalStorage();
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
    
    // Ask if user wants to copy current schedule
    const copyExisting = confirm(`Would you like to copy the current schedule "${appData.currentSchedule}" to the new schedule?\n\nClick OK to copy, or Cancel to start with an empty schedule.`);
    
    if (copyExisting) {
        // Deep copy the current schedule data
        const currentData = getCurrentScheduleData();
        appData.schedules[scheduleName] = {
            instructors: JSON.parse(JSON.stringify(currentData.instructors || [])),
            courses: JSON.parse(JSON.stringify(currentData.courses || [])),
            classrooms: JSON.parse(JSON.stringify(currentData.classrooms || [])),
            schedule: JSON.parse(JSON.stringify(currentData.schedule || {}))
        };
    } else {
        // Create empty schedule
        appData.schedules[scheduleName] = {
            instructors: [],
            courses: [],
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

// Collapsible Sections
function toggleSection(sectionName) {
    const section = document.getElementById(`${sectionName}-section`);
    const icon = document.getElementById(`${sectionName}-icon`);
    
    if (!section || !icon) return;
    
    const isCollapsed = section.style.display === 'none';
    section.style.display = isCollapsed ? 'block' : 'none';
    icon.textContent = isCollapsed ? '▼' : '▶';
    
    // Save state
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
    renderSchedule(); // Re-render schedule with filter applied
}

// Close filter dropdown when clicking outside
document.addEventListener('click', (e) => {
    const filterList = document.getElementById('instructorFilterList');
    const filterToggle = document.querySelector('.filter-toggle');
    if (filterList && filterToggle && !filterToggle.contains(e.target) && !filterList.contains(e.target)) {
        filterList.style.display = 'none';
    }
});


// Event Listeners
function initializeEventListeners() {
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
        const name = document.getElementById('editCourseName').value.trim();
        const credits = document.getElementById('editCourseCredits').value;
        const instructorId = document.getElementById('editCourseInstructor').value;
        const modality = document.getElementById('editModality').value || 'in-person';
        
        if (name && credits) {
            saveCourseChanges(courseId, name, credits, instructorId || null, classroomId, day, timeslot, modality, courseIndex);
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

// Instructor functions
function addInstructor() {
    const nameInput = document.getElementById('instructorName');
    const name = nameInput.value.trim();
    
    if (name) {
        const instructor = {
            id: Date.now().toString(),
            name: name,
            color: '#3498db' // Default color
        };
        appData.instructors.push(instructor);
        nameInput.value = '';
        saveToLocalStorage();
        render();
    }
}

function deleteInstructor(id) {
    // Check if instructor has courses
    const hasCourses = appData.courses.some(c => c.instructorId === id);
    if (hasCourses) {
        alert('Cannot delete instructor with assigned courses');
        return;
    }
    
    appData.instructors = appData.instructors.filter(i => i.id !== id);
    saveToLocalStorage();
    render();
}

function getInstructorWorkload(instructorId) {
    return appData.courses
        .filter(c => c.instructorId === instructorId)
        .reduce((sum, c) => sum + c.credits, 0);
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
                    // Backward compatibility
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
                // Backward compatibility
                inPersonCount++;
            }
            if (inPersonCount >= 2) {
                return true;
            }
        }
    }
    return false;
}

// Course functions
function addCourse() {
    const nameInput = document.getElementById('courseName');
    const creditsInput = document.getElementById('courseCredits');
    const instructorSelect = document.getElementById('courseInstructor');
    
    const name = nameInput.value.trim();
    const credits = parseInt(creditsInput.value);
    const instructorId = instructorSelect.value;
    
    if (name && credits) {
        const course = {
            id: Date.now().toString(),
            name: name,
            credits: credits,
            instructorId: instructorId || null
        };
        appData.courses.push(course);
        nameInput.value = '';
        creditsInput.value = '';
        instructorSelect.value = '';
        saveToLocalStorage();
        render();
    }
}

function deleteCourse(id) {
    // Remove from schedule
    Object.keys(appData.schedule).forEach(classroomId => {
        DAYS.forEach(day => {
            if (appData.schedule[classroomId][day]) {
                Object.keys(appData.schedule[classroomId][day]).forEach(time => {
                    const slotData = appData.schedule[classroomId][day][time];
                    if (Array.isArray(slotData)) {
                        appData.schedule[classroomId][day][time] = slotData.filter(item => item.courseId !== id);
                        if (appData.schedule[classroomId][day][time].length === 0) {
                            delete appData.schedule[classroomId][day][time];
                        }
                    } else if (slotData && slotData.courseId === id) {
                        delete appData.schedule[classroomId][day][time];
                    }
                });
            }
        });
    });
    
    appData.courses = appData.courses.filter(c => c.id !== id);
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
            timeslots: {}, // Per-day timeslots: { Monday: [], Tuesday: [], ... }
            visible: true,
            timeslotFormExpanded: true // Single toggle for all timeslot forms
        };
        // Initialize timeslots for each day
        DAYS.forEach(day => {
            classroom.timeslots[day] = [];
        });
        appData.classrooms.push(classroom);
        
        // Initialize schedule for this classroom
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
        // Remove scheduled courses for this timeslot on this day
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
function scheduleCourse(classroomId, day, time, courseId, modality) {
    if (!appData.schedule[classroomId]) {
        appData.schedule[classroomId] = {};
    }
    if (!appData.schedule[classroomId][day]) {
        appData.schedule[classroomId][day] = {};
    }
    if (!appData.schedule[classroomId][day][time]) {
        appData.schedule[classroomId][day][time] = [];
    }
    
    // Add course to the array
    appData.schedule[classroomId][day][time].push({
        courseId: courseId,
        modality: modality || 'in-person'
    });
    saveToLocalStorage();
    render();
}

function unscheduleCourse(classroomId, day, time, courseIndex) {
    if (appData.schedule[classroomId] && appData.schedule[classroomId][day] && appData.schedule[classroomId][day][time]) {
        if (courseIndex !== undefined) {
            // Remove specific course from array
            appData.schedule[classroomId][day][time].splice(courseIndex, 1);
            // Clean up empty array
            if (appData.schedule[classroomId][day][time].length === 0) {
                delete appData.schedule[classroomId][day][time];
            }
        } else {
            // Remove entire slot (backward compatibility)
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
    
    // If dragging from schedule, store source location
    const sourceClassroomId = e.target.dataset.sourceClassroomId;
    const sourceDay = e.target.dataset.sourceDay;
    const sourceTimeslot = e.target.dataset.sourceTimeslot;
    const sourceCourseIndex = e.target.dataset.sourceCourseIndex;
    
    if (sourceClassroomId && sourceDay && sourceTimeslot) {
        e.dataTransfer.setData('sourceClassroomId', sourceClassroomId);
        e.dataTransfer.setData('sourceDay', sourceDay);
        e.dataTransfer.setData('sourceTimeslot', sourceTimeslot);
        e.dataTransfer.setData('sourceCourseIndex', sourceCourseIndex || '');
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
        // Check if moving from another timeslot
        const sourceClassroomId = e.dataTransfer.getData('sourceClassroomId');
        const sourceDay = e.dataTransfer.getData('sourceDay');
        const sourceTimeslot = e.dataTransfer.getData('sourceTimeslot');
        const sourceCourseIndex = e.dataTransfer.getData('sourceCourseIndex');
        
        // Get modality from source if moving, otherwise ask user
        if (sourceClassroomId && sourceDay && sourceTimeslot) {
            // Moving from another timeslot
            const sourceSlot = appData.schedule[sourceClassroomId]?.[sourceDay]?.[sourceTimeslot];
            let modality = 'in-person';
            if (Array.isArray(sourceSlot) && sourceCourseIndex !== '') {
                modality = sourceSlot[parseInt(sourceCourseIndex)]?.modality || 'in-person';
            } else if (sourceSlot && !Array.isArray(sourceSlot)) {
                modality = sourceSlot.modality || 'in-person';
            }
            
            // Check if moving to same slot (do nothing)
            const isSameSlot = sourceClassroomId === classroomId && sourceDay === day && sourceTimeslot === time;
            if (!isSameSlot) {
                // Schedule at new location
                scheduleCourse(classroomId, day, time, courseId, modality);
                // Remove from original location
                if (sourceCourseIndex !== '') {
                    unscheduleCourse(sourceClassroomId, sourceDay, sourceTimeslot, parseInt(sourceCourseIndex));
                } else {
                    unscheduleCourse(sourceClassroomId, sourceDay, sourceTimeslot, 0);
                }
            }
        } else {
            // Adding from sidebar - show modality modal
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
        scheduleCourse(pendingDrop.classroomId, pendingDrop.day, pendingDrop.time, pendingDrop.courseId, modality);
        pendingDrop = null;
    }
    closeModalityModal();
}

function closeModalityModal() {
    document.getElementById('modalityModal').style.display = 'none';
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
    const course = appData.courses.find(c => c.id === courseId);
    if (!course) return;
    
    document.getElementById('editCourseName').value = course.name;
    document.getElementById('editCourseCredits').value = course.credits;
    document.getElementById('editCourseInstructor').value = course.instructorId;
    
    // Show modality field when editing from schedule
    const modalityGroup = document.getElementById('editModality').closest('.form-group');
    if (modalityGroup) modalityGroup.style.display = 'block';
    
    // Get current modality for this scheduled slot
    const slotData = appData.schedule[classroomId]?.[day]?.[timeslot];
    let currentModality = 'in-person';
    if (Array.isArray(slotData) && courseIndex !== undefined) {
        currentModality = slotData[courseIndex]?.modality || 'in-person';
    } else if (slotData && !Array.isArray(slotData)) {
        currentModality = slotData.modality || 'in-person';
    }
    document.getElementById('editModality').value = currentModality;
    
    // Update instructor dropdown
    const instructorSelect = document.getElementById('editCourseInstructor');
    instructorSelect.innerHTML = '<option value="">Select Instructor (Optional)</option>' +
        appData.instructors.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
    instructorSelect.value = course.instructorId || '';
    
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
    const course = appData.courses.find(c => c.id === courseId);
    if (!course) return;
    
    document.getElementById('editCourseName').value = course.name;
    document.getElementById('editCourseCredits').value = course.credits;
    document.getElementById('editCourseInstructor').value = course.instructorId;
    
    // Hide modality field when editing from list
    const modalityGroup = document.getElementById('editModality').closest('.form-group');
    if (modalityGroup) modalityGroup.style.display = 'none';
    
    // Update instructor dropdown
    const instructorSelect = document.getElementById('editCourseInstructor');
    instructorSelect.innerHTML = '<option value="">Select Instructor (Optional)</option>' +
        appData.instructors.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
    instructorSelect.value = course.instructorId || '';
    
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

function saveCourseChanges(courseId, name, credits, instructorId, classroomId, day, timeslot, modality, courseIndex) {
    const course = appData.courses.find(c => c.id === courseId);
    if (course) {
        course.name = name;
        course.credits = parseInt(credits);
        course.instructorId = instructorId;
        
        // Update modality for this specific scheduled slot (only if classroomId exists)
        if (classroomId && day && timeslot && modality) {
            const slotData = appData.schedule[classroomId]?.[day]?.[timeslot];
            if (Array.isArray(slotData) && courseIndex !== undefined && courseIndex !== '') {
                slotData[parseInt(courseIndex)].modality = modality;
            } else if (slotData && !Array.isArray(slotData)) {
                // Backward compatibility
                slotData.modality = modality;
            }
        }
        
        saveToLocalStorage();
        render();
        closeModal();
    }
}

// Render functions
function render() {
    renderInstructors();
    renderCourses();
    renderSchedule();
    restoreCollapsedSections();
}

// Helper function to get scheduled course style based on instructor color and filter
function getScheduledCourseStyle(course) {
    const instructor = course ? appData.instructors.find(i => i.id === course.instructorId) : null;
    const instructorColor = instructor ? (instructor.color || '#3498db') : '#95a5a6';
    
    // Check if filtering is active and this instructor is not in the filter
    const isFiltering = appData.instructorFilter && appData.instructorFilter.length > 0;
    const isFiltered = isFiltering && course && course.instructorId && !appData.instructorFilter.includes(course.instructorId);
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

function renderInstructors() {
    const container = document.getElementById('instructorsList');
    
    if (appData.instructors.length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">No instructors added yet</p>';
        // Also clear the filter list
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
    const instructorSelect = document.getElementById('courseInstructor');
    
    // Update instructor dropdown
    instructorSelect.innerHTML = '<option value="">Select Instructor (Optional)</option>' +
        appData.instructors.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
    
    if (appData.courses.length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">No courses added yet</p>';
        return;
    }
    
    container.innerHTML = appData.courses.map(course => {
        const instructor = appData.instructors.find(i => i.id === course.instructorId);
        const isScheduled = isCourseScheduled(course.id);
        const statusClass = isScheduled ? 'course-scheduled' : 'course-unscheduled';
        return `
            <div class="course-item ${statusClass}" draggable="true" 
                 ondragstart="handleDragStart(event, '${course.id}')"
                 ondragend="handleDragEnd(event)"
                 ondblclick="showCourseModalFromList('${course.id}')">
                <div class="course-info">
                    <div class="course-name">${course.name}</div>
                    <div class="course-meta">${course.credits} credits${instructor ? ' • ' + instructor.name : ''}</div>
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
    
    container.innerHTML = appData.classrooms.map(classroom => {
        // Group timeslots by day for rendering
        const dayTimeslots = {};
        DAYS.forEach(day => {
            dayTimeslots[day] = classroom.timeslots[day] || [];
        });
        
        // Get all unique timeslots across all weekdays (excluding Arranged)
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
                        // Special handling for Arranged column - only show on first row and span all rows
                        if (day === 'Arranged') {
                            if (rowIndex === 0) {
                                const slotData = appData.schedule[classroom.id]?.[day]?.['arranged'];
                                const courses = Array.isArray(slotData) ? slotData : (slotData ? [slotData] : []);
                                
                                const modalityIcon = {
                                    'in-person': '🏫',
                                    'online': '💻',
                                    'hybrid': '🔄'
                                };
                                
                                return `
                                    <div class="time-slot arranged-slot ${courses.length > 0 ? 'occupied' : ''}" style="grid-row: span ${sortedTimeslots.length};" 
                                         ondragover="handleDragOver(event)"
                                         ondragleave="handleDragLeave(event)"
                                         ondrop="handleDrop(event, '${classroom.id}', '${day}', 'arranged')">
                                        ${courses.map((item, index) => {
                                            const course = appData.courses.find(c => c.id === item.courseId);
                                            const instructor = course ? appData.instructors.find(i => i.id === course.instructorId) : null;
                                            const courseStyle = getScheduledCourseStyle(course);
                                            return `
                                                <div class="scheduled-course" 
                                                     style="${courseStyle}"
                                                     draggable="true"
                                                     data-source-classroom-id="${classroom.id}"
                                                     data-source-day="${day}"
                                                     data-source-timeslot="arranged"
                                                     data-source-course-index="${index}"
                                                     ondragstart="handleDragStart(event, '${item.courseId}')"
                                                     ondragend="handleDragEnd(event)"
                                                     ondblclick="showCourseModal('${item.courseId}', '${classroom.id}', '${day}', 'arranged', ${index})">
                                                    <button class="remove-course" onclick="event.stopPropagation(); unscheduleCourse('${classroom.id}', '${day}', 'arranged', ${index})">&times;</button>
                                                    <div class="course-name">${course ? course.name : 'Unknown'}</div>
                                                    <div class="course-meta">
                                                        ${course ? course.credits + ' credits' : ''}${instructor ? ' • ' + instructor.name : ''}
                                                        <span class="modality-badge">${modalityIcon[item.modality]} ${item.modality}</span>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                `;
                            } else {
                                return ''; // Skip for other rows since it spans
                            }
                        }
                        
                        const hasTimeslot = (classroom.timeslots[day] || []).includes(timeslot);
                        if (!hasTimeslot) {
                            return `<div class="time-slot" style="background: #f0f0f0;"></div>`;
                        }
                        
                        const slotData = appData.schedule[classroom.id]?.[day]?.[timeslot];
                        const courses = Array.isArray(slotData) ? slotData : (slotData ? [slotData] : []);
                        
                        // Check for in-person conflicts
                        const hasConflict = hasInPersonConflict(day, timeslot);
                        
                        const modalityIcon = {
                            'in-person': '🏫',
                            'online': '💻',
                            'hybrid': '🔄'
                        };
                        
                        if (courses.length > 0) {
                            return `
                                <div class="time-slot occupied ${hasConflict ? 'conflict' : ''}"
                                     ondragover="handleDragOver(event)"
                                     ondragleave="handleDragLeave(event)"
                                     ondrop="handleDrop(event, '${classroom.id}', '${day}', '${timeslot}')">
                                    ${courses.map((item, index) => {
                                        const course = appData.courses.find(c => c.id === item.courseId);
                                        const instructor = course ? appData.instructors.find(i => i.id === course.instructorId) : null;
                                        const courseStyle = getScheduledCourseStyle(course);
                                        return `
                                            <div class="scheduled-course" 
                                                 style="${courseStyle}"
                                                 draggable="true"
                                                 data-source-classroom-id="${classroom.id}"
                                                 data-source-day="${day}"
                                                 data-source-timeslot="${timeslot}"
                                                 data-source-course-index="${index}"
                                                 ondragstart="handleDragStart(event, '${item.courseId}')"
                                                 ondragend="handleDragEnd(event)"
                                                 ondblclick="showCourseModal('${item.courseId}', '${classroom.id}', '${day}', '${timeslot}', ${index})">
                                                <button class="remove-course" onclick="event.stopPropagation(); unscheduleCourse('${classroom.id}', '${day}', '${timeslot}', ${index})">&times;</button>
                                                <div class="course-name">${course ? course.name : 'Unknown'}${hasConflict ? ' ⚠️' : ''}</div>
                                                <div class="course-meta">
                                                    ${course ? course.credits + ' credits' : ''}${instructor ? ' • ' + instructor.name : ''}
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
                        
                        const modalityIcon = {
                            'in-person': '🏫',
                            'online': '💻',
                            'hybrid': '🔄'
                        };
                        
                        return `
                            <div class="time-slot arranged-slot ${courses.length > 0 ? 'occupied' : ''}"
                                 ondragover="handleDragOver(event)"
                                 ondragleave="handleDragLeave(event)"
                                 ondrop="handleDrop(event, '${classroom.id}', '${day}', 'arranged')">
                                ${courses.map((item, index) => {
                                    const course = appData.courses.find(c => c.id === item.courseId);
                                    const instructor = course ? appData.instructors.find(i => i.id === course.instructorId) : null;
                                    const courseStyle = getScheduledCourseStyle(course);
                                    return `
                                        <div class="scheduled-course" style="${courseStyle}" ondblclick="showCourseModal('${item.courseId}', '${classroom.id}', '${day}', 'arranged', ${index})">
                                            <button class="remove-course" onclick="event.stopPropagation(); unscheduleCourse('${classroom.id}', '${day}', 'arranged', ${index})">&times;</button>
                                            <div class="course-name">${course ? course.name : 'Unknown'}</div>
                                            <div class="course-meta">
                                                ${course ? course.credits + ' credits' : ''}${instructor ? ' • ' + instructor.name : ''}
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
            
            // Check if this is the new multi-schedule format
            if (loaded.schedules && typeof loaded.schedules === 'object' && loaded.currentSchedule) {
                // Don't replace appData object, just update its properties to preserve getters
                appData.schedules = loaded.schedules;
                appData.currentSchedule = loaded.currentSchedule;
                appData.collapsedSections = loaded.collapsedSections || {};
                appData.instructorFilter = loaded.instructorFilter || [];
                
                // Validate that currentSchedule exists in schedules
                if (!appData.schedules[appData.currentSchedule]) {
                    // Current schedule doesn't exist, pick the first available one
                    const firstSchedule = Object.keys(appData.schedules)[0];
                    if (firstSchedule) {
                        appData.currentSchedule = firstSchedule;
                    } else {
                        // No schedules exist, create default
                        appData.schedules['Default Schedule'] = {
                            instructors: [],
                            courses: [],
                            classrooms: [],
                            schedule: {}
                        };
                        appData.currentSchedule = 'Default Schedule';
                    }
                }
            } else if (loaded.instructors || loaded.courses || loaded.classrooms || loaded.schedule) {
                // Migrate old single-schedule format to multi-schedule format
                appData.schedules = {
                    'Default Schedule': {
                        instructors: loaded.instructors || [],
                        courses: loaded.courses || [],
                        classrooms: loaded.classrooms || [],
                        schedule: loaded.schedule || {}
                    }
                };
                appData.currentSchedule = 'Default Schedule';
                appData.collapsedSections = loaded.collapsedSections || {};
                appData.instructorFilter = loaded.instructorFilter || [];
            } else {
                // Unrecognized format, start fresh
                console.warn('Unrecognized data format, initializing with default schedule');
                return; // Let default initialization happen
            }
            
            // Initialize missing global properties
            if (!appData.collapsedSections) appData.collapsedSections = {};
            if (!appData.instructorFilter) appData.instructorFilter = [];
            if (!appData.schedules) appData.schedules = {};
            if (!appData.currentSchedule) appData.currentSchedule = 'Default Schedule';
            
            // Ensure currentSchedule exists
            if (!appData.schedules[appData.currentSchedule]) {
                appData.schedules[appData.currentSchedule] = {
                    instructors: [],
                    courses: [],
                    classrooms: [],
                    schedule: {}
                };
            }
            
            // Migrate data for all schedules
            Object.keys(appData.schedules).forEach(scheduleName => {
                const scheduleData = appData.schedules[scheduleName];
                
                // Ensure all required properties exist
                if (!scheduleData.instructors) scheduleData.instructors = [];
                if (!scheduleData.courses) scheduleData.courses = [];
                if (!scheduleData.classrooms) scheduleData.classrooms = [];
                if (!scheduleData.schedule) scheduleData.schedule = {};
                
                // Ensure instructors have colors
                (scheduleData.instructors || []).forEach(instructor => {
                    if (!instructor.color) {
                        instructor.color = '#3498db';
                    }
                });
                
                // Migrate classroom data
                (scheduleData.classrooms || []).forEach(classroom => {
                    // Convert old array-based timeslots to per-day timeslots
                    if (Array.isArray(classroom.timeslots)) {
                        const oldTimeslots = [...classroom.timeslots];
                        classroom.timeslots = {};
                        DAYS.forEach(day => {
                            classroom.timeslots[day] = [...oldTimeslots];
                        });
                    }
                    
                    // Ensure timeslots is an object
                    if (!classroom.timeslots || typeof classroom.timeslots !== 'object') {
                        classroom.timeslots = {};
                    }
                    
                    // Ensure all days exist
                    DAYS.forEach(day => {
                        if (!classroom.timeslots[day]) {
                            classroom.timeslots[day] = [];
                        }
                    });
                    
                    // Initialize timeslotFormExpanded if it doesn't exist
                    if (classroom.timeslotFormExpanded === undefined) {
                        classroom.timeslotFormExpanded = true;
                    }
                    
                    // Ensure schedule object exists
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
                                    // Very old format: just courseId string
                                    scheduleData.schedule[classroom.id][day][time] = [{
                                        courseId: value,
                                        modality: 'in-person'
                                    }];
                                } else if (value && !Array.isArray(value) && value.courseId) {
                                    // Old format: single object { courseId, modality }
                                    scheduleData.schedule[classroom.id][day][time] = [value];
                                }
                                // New format is already an array, no change needed
                            });
                        }
                    });
                });
            });
            
            saveToLocalStorage(); // Save migrated data
        } catch (e) {
            console.error('Error loading data:', e);
        }
    }
}

// Export/Import functions
function exportData() {
    // Prompt for filename - default to current schedule name
    const defaultName = `${appData.currentSchedule.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`;
    const filename = prompt('Enter filename for export (without .json extension):', defaultName);
    
    if (filename === null) {
        // User cancelled
        return;
    }
    
    const finalFilename = filename.trim() || defaultName;
    
    // Export only the current schedule
    const exportData = {
        version: '2.0',
        exportDate: new Date().toISOString(),
        scheduleName: appData.currentSchedule,
        data: getCurrentScheduleData()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
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
            
            // Check if this is new version 2.0 format (single schedule with name)
            if (imported.version === '2.0' && imported.scheduleName && imported.data) {
                const scheduleData = imported.data;
                
                // Validate structure
                if (scheduleData.instructors && scheduleData.courses && scheduleData.classrooms && scheduleData.schedule) {
                    // Prompt for schedule name (default to imported name)
                    const scheduleName = prompt('Enter name for this schedule:', imported.scheduleName);
                    if (!scheduleName || !scheduleName.trim()) {
                        alert('Import cancelled.');
                        return;
                    }
                    
                    const finalName = scheduleName.trim();
                    
                    // Check if schedule exists and confirm override
                    if (appData.schedules[finalName]) {
                        if (!confirm(`Schedule "${finalName}" already exists. Override it?`)) {
                            return;
                        }
                    }
                    
                    // Add or override the schedule
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
            // Handle version 1.0 format (full appData)
            else if (imported.version === '1.0' && imported.data) {
                const data = imported.data;
                
                // Check if this is the old appData format
                if (data.instructors && data.courses && data.classrooms && data.schedule) {
                    // Convert to new multi-schedule format
                    const scheduleName = prompt('Enter name for this schedule:', 'Imported Schedule');
                    if (!scheduleName || !scheduleName.trim()) {
                        alert('Import cancelled.');
                        return;
                    }
                    
                    const finalName = scheduleName.trim();
                    if (appData.schedules[finalName]) {
                        if (!confirm(`Schedule "${finalName}" already exists. Override it?`)) {
                            return;
                        }
                    }
                    
                    appData.schedules[finalName] = {
                        instructors: data.instructors,
                        courses: data.courses,
                        classrooms: data.classrooms,
                        schedule: data.schedule
                    };
                    appData.currentSchedule = finalName;
                    
                    saveToLocalStorage();
                    renderScheduleSelector();
                    render();
                    alert(`Schedule "${finalName}" imported successfully! (Version 1.0)`);
                } else {
                    alert('Invalid data format in versioned file');
                }
            } 
            // Handle legacy format (direct appData without version)
            else if (imported.instructors && imported.courses && imported.classrooms && imported.schedule) {
                const scheduleName = prompt('Enter name for this schedule:', 'Imported Schedule');
                if (!scheduleName || !scheduleName.trim()) {
                    alert('Import cancelled.');
                    return;
                }
                
                const finalName = scheduleName.trim();
                if (appData.schedules[finalName]) {
                    if (!confirm(`Schedule "${finalName}" already exists. Override it?`)) {
                        return;
                    }
                }
                
                appData.schedules[finalName] = {
                    instructors: imported.instructors,
                    courses: imported.courses,
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
    e.target.value = ''; // Reset file input
}
