export class ProgramManager {
    #dataStore;
    #onUpdate;

    /**
     * @param {import('../data/DataStore.js').DataStore} dataStore
     * @param {() => void} onUpdate
     */
    constructor(dataStore, onUpdate) {
        this.#dataStore = dataStore;
        this.#onUpdate = onUpdate;
    }

    add() {
        const nameInput = document.getElementById('programName');
        const name = nameInput.value.trim();
        if (!name) return;

        this.#dataStore.data.programs.push({ id: Date.now().toString(), name });
        nameInput.value = '';
        this.#dataStore.save();
        this.#onUpdate();
    }

    remove(id) {
        const hasCourses = this.#dataStore.data.courseCatalog.some(c => c.programId === id);
        if (hasCourses) {
            alert('Cannot delete program with assigned courses. Reassign or delete the courses first.');
            return;
        }
        const d = this.#dataStore.data;
        d.programs = d.programs.filter(p => p.id !== id);
        this.#dataStore.save();
        this.#onUpdate();
    }

    showEditPrompt(id) {
        const program = this.#dataStore.data.programs.find(p => p.id === id);
        if (!program) return;
        const newName = prompt('Enter new name for program:', program.name);
        if (newName && newName.trim()) {
            program.name = newName.trim();
            this.#dataStore.save();
            this.#onUpdate();
        }
    }
}
