# Instructor Workload Scheduler

A front-end only web application for scheduling instructor workloads with drag-and-drop functionality. All data is stored in the browser's localStorage with import/export capabilities.

## Features

### Instructor Management
- Add instructors by name
- View total workload per instructor (in credits)
- Delete instructors (protected if they have assigned courses)

### Course Management
- Add courses with name, credits, and assigned instructor
- Edit course details by **double-clicking** on any scheduled course
- Delete courses (automatically removes from schedule)
- Drag courses to schedule slots

### Classroom Management
- Add classrooms by room number
- Show/hide individual classrooms
- Delete classrooms
- Per-day customizable timeslots

### Time Slot Management
- Add different timeslots for each day of the week
- Quick "Copy to All" button to replicate Monday's schedule across all weekdays
- Remove individual timeslots per day
- Flexible scheduling with different hours per day

### Schedule Grid
- Visual grid showing Monday-Friday schedule
- Drag and drop courses onto any available time slot
- **Courses can be assigned to multiple slots** (for classes that meet multiple times per week)
- Each scheduled slot shows:
  - Course name
  - Credits
  - Instructor name
  - Modality badge

### Modality Options
When dropping a course onto a schedule slot, choose from:
- 🏫 **In-Person** - Traditional classroom instruction
- 💻 **Online** - Virtual/remote instruction
- 🔄 **Hybrid** - Mix of in-person and online

### Data Management
- Automatic save to browser localStorage
- Export schedule as JSON file
- Import previously exported JSON files
- Backward compatible with older data formats

## How to Use

1. **Open** `index.html` in your web browser
2. **Add Instructors** - Enter names in the Instructors panel
3. **Add Courses** - Enter course details and assign to an instructor
4. **Add Classrooms** - Create rooms with room numbers
5. **Add Time Slots** - Set up schedule times for each day of the week
6. **Schedule Courses** - Drag courses from the sidebar onto schedule slots, then select modality
7. **Edit Courses** - Double-click any scheduled course to edit its details
8. **Export/Import** - Save your data or load previous schedules

## Tips

- Use the "Copy to All" button on Monday to quickly set up the same timeslots for the entire week
- Courses can be scheduled multiple times (e.g., a course meeting MWF)
- Double-click scheduled courses to quickly edit course information
- Toggle classroom visibility to focus on specific rooms
- Export your data regularly as a backup

## Technical Details

- **100% Client-Side** - No server required
- **Local Storage** - Data persists in browser
- **Drag & Drop API** - Native HTML5 drag and drop
- **Responsive Design** - Works on various screen sizes
- **No Dependencies** - Pure HTML, CSS, and JavaScript
