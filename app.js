// Data structure
let appData = {
    instructors: [],
    courses: [],
    classrooms: [],
    schedule: {} // { classroomId: { day: { time: { courseId, modality } } } }
};

// Store pending drop data
let pendingDrop = null;

// Days of the week
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Arranged'];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    initializeEventListeners();
    render();
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
    window.addEventListener('click', (e) => {
        if (e.target.id === 'courseModal') {
            closeModal();
        }
        if (e.target.id === 'modalityModal') {
            closeModalityModal();
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
        const modality = document.getElementById('editModality').value;
        
        if (name && credits) {
            saveCourseChanges(courseId, name, credits, instructorId || null, classroomId, day, timeslot, modality, courseIndex);
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
            name: name
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
        // Store pending drop data and show modality modal
        pendingDrop = { classroomId, day, time, courseId };
        showModalityModal();
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

function showCourseModal(courseId, classroomId, day, timeslot, courseIndex) {
    const course = appData.courses.find(c => c.id === courseId);
    if (!course) return;
    
    document.getElementById('editCourseName').value = course.name;
    document.getElementById('editCourseCredits').value = course.credits;
    document.getElementById('editCourseInstructor').value = course.instructorId;
    
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

function saveCourseChanges(courseId, name, credits, instructorId, classroomId, day, timeslot, modality, courseIndex) {
    const course = appData.courses.find(c => c.id === courseId);
    if (course) {
        course.name = name;
        course.credits = parseInt(credits);
        course.instructorId = instructorId;
        
        // Update modality for this specific scheduled slot
        if (classroomId && day && timeslot) {
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
}

function renderInstructors() {
    const container = document.getElementById('instructorsList');
    
    if (appData.instructors.length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">No instructors added yet</p>';
        return;
    }
    
    container.innerHTML = appData.instructors.map(instructor => {
        const workload = getInstructorWorkload(instructor.id);
        return `
            <div class="instructor-item">
                <div>
                    <div>${instructor.name}</div>
                    <div class="workload">${workload} credits</div>
                </div>
                <button class="delete-btn" onclick="deleteInstructor('${instructor.id}')">Delete</button>
            </div>
        `;
    }).join('');
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
                 ondragend="handleDragEnd(event)">
                <div class="course-info">
                    <div class="course-name">${course.name}</div>
                    <div class="course-meta">${course.credits} credits${instructor ? ' • ' + instructor.name : ''}</div>
                </div>
                <button class="delete-btn" onclick="deleteCourse('${course.id}')">Delete</button>
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
                                            return `
                                                <div class="scheduled-course" ondblclick="showCourseModal('${item.courseId}', '${classroom.id}', '${day}', 'arranged', ${index})">
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
                                        return `
                                            <div class="scheduled-course" ondblclick="showCourseModal('${item.courseId}', '${classroom.id}', '${day}', '${timeslot}', ${index})">
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
        ` : `            <div class="classroom-schedule ${!classroom.visible ? 'hidden' : ''}">
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
                                    return `
                                        <div class="scheduled-course" ondblclick="showCourseModal('${item.courseId}', '${classroom.id}', '${day}', 'arranged', ${index})">
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
            </div>            <div class="timeslot-form-header" onclick="toggleTimeslotForm('${classroom.id}')">
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
            appData = JSON.parse(saved);
            
            // Migrate old data structure to new
            appData.classrooms.forEach(classroom => {
                // Convert old array-based timeslots to per-day timeslots
                if (Array.isArray(classroom.timeslots)) {
                    const oldTimeslots = [...classroom.timeslots];
                    classroom.timeslots = {};
                    DAYS.forEach(day => {
                        classroom.timeslots[day] = [...oldTimeslots];
                    });
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
                if (!appData.schedule[classroom.id]) {
                    appData.schedule[classroom.id] = {};
                    DAYS.forEach(day => {
                        appData.schedule[classroom.id][day] = {};
                    });
                }
                
                // Migrate schedule from old format to new array format
                DAYS.forEach(day => {
                    if (appData.schedule[classroom.id][day]) {
                        Object.keys(appData.schedule[classroom.id][day]).forEach(time => {
                            const value = appData.schedule[classroom.id][day][time];
                            if (typeof value === 'string') {
                                // Very old format: just courseId string
                                appData.schedule[classroom.id][day][time] = [{
                                    courseId: value,
                                    modality: 'in-person'
                                }];
                            } else if (value && !Array.isArray(value) && value.courseId) {
                                // Old format: single object { courseId, modality }
                                appData.schedule[classroom.id][day][time] = [value];
                            }
                            // New format is already an array, no change needed
                        });
                    }
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
    const dataStr = JSON.stringify(appData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `workload-schedule-${new Date().toISOString().split('T')[0]}.json`;
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
            // Validate structure
            if (imported.instructors && imported.courses && imported.classrooms && imported.schedule) {
                appData = imported;
                saveToLocalStorage();
                render();
                alert('Data imported successfully!');
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
