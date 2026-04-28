import { Config } from '../config.js';

export class ClassroomManager {
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
        const roomInput = document.getElementById('roomNumber');
        const roomNumber = roomInput.value.trim();
        if (!roomNumber) return;

        const d = this.#dataStore.data;
        const classroom = { id: Date.now().toString(), roomNumber, visible: true };
        d.classrooms.push(classroom);

        d.schedule[classroom.id] = {};
        Config.DAYS.forEach(day => { d.schedule[classroom.id][day] = {}; });

        roomInput.value = '';
        this.#dataStore.save();
        this.#onUpdate();
    }

    remove(id) {
        const d = this.#dataStore.data;
        d.classrooms = d.classrooms.filter(c => c.id !== id);
        delete d.schedule[id];
        this.#dataStore.save();
        this.#onUpdate();
    }

    toggle(id) {
        const classroom = this.#dataStore.data.classrooms.find(c => c.id === id);
        if (classroom) {
            classroom.visible = !classroom.visible;
            this.#dataStore.save();
            this.#onUpdate();
        }
    }
}
