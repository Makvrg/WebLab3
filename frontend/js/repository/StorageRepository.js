import {Student} from "../entity/Student.js";

export class StorageRepository {

    static #instance = null;
    static #STUDENTS_KEY = "studentsList";

    constructor() {
        if (StorageRepository.#instance) {
            throw new Error("Используйте StorageRepository.getInstance() вместо new");
        }
    }

    static getInstance() {
        if (!StorageRepository.#instance) {
            StorageRepository.#instance = Object.create(StorageRepository.prototype);
        }
        return StorageRepository.#instance;
    }

    /**
     * Читает данные из localStorage и превращает их в объекты Student
     * @returns {Student[]}
     */
    readStudents() {
        const rawData = localStorage.getItem(StorageRepository.#STUDENTS_KEY);
        return rawData ? JSON.parse(rawData).map(Student.fromJSON) : [];
    }

    /**
     * Сериализует массив студентов и сохраняет в localStorage
     * @param {Student[]} students
     */
    saveStudents(students) {
        localStorage.setItem(StorageRepository.#STUDENTS_KEY, JSON.stringify(students));
    }

    addStudent(newStudent) {
        const students = this.readStudents();
        students.push(newStudent);
        this.saveStudents(students);
    }

    deleteStudent(isuId) {
        this.saveStudents(this.readStudents()
            .filter(stud => {return Number(stud.isuId) !== Number(isuId)}));
    }

    updateStudent(updatedStudent) {
        this.saveStudents(
            this.readStudents().map(student =>
                Number(student.isuId) === Number(updatedStudent.isuId)
                    ? updatedStudent
                    : student
            )
        );
    }

    containsId(isuId) {
        return this.readStudents().some(stud => Number(stud.isuId) === Number(isuId));
    }
}
