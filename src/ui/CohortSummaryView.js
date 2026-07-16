import { Config } from '../config.js';
import { Helpers } from '../utils/Helpers.js';

export class CohortSummaryView {
    #dataStore;

    /**
     * @param {import('../data/DataStore.js').DataStore} dataStore
     */
    constructor(dataStore) {
        this.#dataStore = dataStore;
    }

    show() {
        const modal = document.getElementById('cohortSummaryModal');
        const content = document.getElementById('cohortSummaryContent');
        if (!modal || !content) return;

        const summaryData = this._analyzeCohorts();
        content.innerHTML = this._renderSummary(summaryData);
        modal.style.display = 'block';
    }

    close() {
        const modal = document.getElementById('cohortSummaryModal');
        if (modal) modal.style.display = 'none';
    }

    _analyzeCohorts() {
        const d = this.#dataStore.data;
        const sd = this.#dataStore.getCurrentSchedule();
        const cohortMap = new Map();

        Object.keys(sd.schedule).forEach(classroomId => {
            const classroom = d.classrooms.find(c => c.id === classroomId);
            if (!classroom) return;

            Object.keys(sd.schedule[classroomId]).forEach(day => {
                Object.keys(sd.schedule[classroomId][day]).forEach(timeslot => {
                    const courses = sd.schedule[classroomId][day][timeslot];
                    const courseArray = Array.isArray(courses) ? courses : (courses ? [courses] : []);

                    courseArray.forEach(item => {
                        const course = d.courseCatalog.find(c => c.id === item.courseId);
                        if (!course || !course.quarterTaken) return;

                        const cohortKey = course.quarterTaken.trim();
                        if (!cohortMap.has(cohortKey)) {
                            cohortMap.set(cohortKey, { name: cohortKey, classes: [] });
                        }

                        const cohort = cohortMap.get(cohortKey);
                        const displayName = Helpers.getCourseDisplayName(course, d.programs);

                        let existingClass = cohort.classes.find(c => c.courseId === course.id);
                        if (!existingClass) {
                            existingClass = {
                                courseId: course.id,
                                name: displayName,
                                credits: course.credits,
                                schedules: [],
                            };
                            cohort.classes.push(existingClass);
                        }

                        const timeDisplay = day === 'Arranged' ? 'Arranged' : `${day} ${timeslot}`;
                        existingClass.schedules.push({
                            day,
                            timeslot,
                            modality: item.modality || 'in-person',
                            section: item.section || '',
                            classroom: classroom.roomNumber,
                            timeDisplay,
                        });
                    });
                });
            });
        });

        return Array.from(cohortMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true })
        );
    }

    _renderSummary(cohorts) {
        if (cohorts.length === 0) {
            return '<p style="color: #7f8c8d; font-size: 16px; text-align: center; margin-top: 20px;">No cohorts found. Assign cohorts (e.g., Q1, Q2) to courses in the course catalog.</p>';
        }

        return cohorts.map(cohort => {
            const allDays = new Set();
            cohort.classes.forEach(cls => {
                cls.schedules.forEach(sched => {
                    if (sched.day !== 'Arranged') allDays.add(sched.day);
                });
            });
            const daysPerWeek = allDays.size;
            const totalCredits = cohort.classes.reduce((sum, cls) => sum + (cls.credits || 0), 0);

            const classesHTML = cohort.classes.map(cls => {
                const dayGroups = {};
                cls.schedules.forEach(sched => {
                    const key = sched.day;
                    if (!dayGroups[key]) dayGroups[key] = [];
                    dayGroups[key].push(sched);
                });

                const scheduleHTML = Object.keys(dayGroups)
                    .sort((a, b) => Config.DAYS.indexOf(a) - Config.DAYS.indexOf(b))
                    .map(day => {
                        const scheds = dayGroups[day];
                        const times = scheds.map(s => s.timeslot !== 'arranged' ? s.timeslot : '').filter(t => t).join(', ');
                        const modalityDetails = scheds.map(s => {
                            const icon = Config.MODALITY_ICONS[s.modality] || '';
                            const text = s.modality.charAt(0).toUpperCase() + s.modality.slice(1);
                            const sectionLabel = s.section ? ` (Section ${s.section})` : '';
                            return `${icon} ${text}${sectionLabel}`;
                        });
                        const modalityText = [...new Set(modalityDetails)].join(', ');
                        return `
                            <div class="cohort-schedule-item">
                                <strong>${day}:</strong> ${times || 'Arranged'} <span class="cohort-modality">${modalityText}</span>
                            </div>
                        `;
                    }).join('');

                return `
                    <div class="cohort-class">
                        <div class="cohort-class-name">${cls.name}</div>
                        <div class="cohort-class-info">${Helpers.formatCredits(cls.credits)} credits</div>
                        <div class="cohort-schedule-list">${scheduleHTML}</div>
                    </div>
                `;
            }).join('');

            return `
                <div class="cohort-summary-section">
                    <h3 class="cohort-name">Cohort: ${cohort.name}</h3>
                    <div class="cohort-stats">
                        <span class="cohort-stat"><strong>Days per week:</strong> ${daysPerWeek > 0 ? daysPerWeek : 'N/A'}</span>
                        <span class="cohort-stat"><strong>Total credits:</strong> ${Helpers.formatCredits(totalCredits)}</span>
                    </div>
                    <div class="cohort-classes-list">${classesHTML}</div>
                </div>
            `;
        }).join('');
    }
}
