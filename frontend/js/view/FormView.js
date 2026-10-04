import {Student} from "../entity/Student.js";

export class FormView {

    form;
    onSubmitCallback;
    mode = "add";

    /**
     * @param {string} formSelector Селектор формы для работы с ней
     * @param {Function} onSubmitCallback (student: Student, mode: "add"|"edit"|"filter") => void
     * @param {"add"|"edit"|"filter"} initialMode Начальный режим формы
     */
    constructor(formSelector, onSubmitCallback, initialMode = "add") {
        this.form = document.querySelector(formSelector);
        this.onSubmitCallback = onSubmitCallback;

        const urlMode =
            new URLSearchParams(window.location.search).get("mode");

        if (
            urlMode === "filter"
            || urlMode === "edit"
        ) {
            this.mode = urlMode;
        } else {
            this.mode = initialMode;
        }

        if (this.form) {
            this.#applyMode();
            this.#initEvents();
        }
    }

    getStudentFromForm() {
        const isuId = document.getElementById("isu")?.value || "";
        const fio = document.getElementById("fio")?.value || "";
        const group = document.getElementById("group")?.value || "";
        const dorm = document.getElementById("dorm")?.value || "";
        const room = document.getElementById("room")?.value || "";
        const date = document.getElementById("date")?.value || "";
        const foreigner =
            document.getElementById("foreigner")?.checked || false;
        const notes = document.getElementById("notes")?.value || "";

        return new Student(
            isuId,
            fio,
            group,
            dorm,
            room,
            date,
            foreigner,
            notes
        );
    }

    fillForm(student) {
        this.mode = "edit";
        this.#applyMode();

        if (document.getElementById("isu")) {
            document.getElementById("isu").value = student.isuId;
            document.getElementById("isu").readOnly = true;
        }

        if (document.getElementById("fio")) {
            document.getElementById("fio").value = student.fio;
        }

        if (document.getElementById("group")) {
            document.getElementById("group").value = student.stGroup;
        }

        if (document.getElementById("dorm")) {
            document.getElementById("dorm").value =
                student.dormitoryNumber;
        }

        if (document.getElementById("room")) {
            document.getElementById("room").value =
                student.room || "";
        }

        if (document.getElementById("date")) {
            document.getElementById("date").value =
                student.dateOfPlacement;
        }

        if (document.getElementById("foreigner")) {
            document.getElementById("foreigner").checked =
                student.isNotRussian;
        }

        if (document.getElementById("notes")) {
            document.getElementById("notes").value =
                student.notes || "";
        }
    }

    #applyMode() {
        this.form.dataset.mode = this.mode;
        const titleEl =
            document.getElementById("form-title");

        const submitBtn =
            document.getElementById("submit-btn");

        const isuEl =
            document.getElementById("isu");

        const notesContainer =
            document.getElementById("notes")?.closest(".form-group");

        const reqStars = this.form.querySelectorAll(".req-star");

        this.form
            .querySelectorAll("input, textarea, select")
            .forEach(field => {
                field.required = false;
            });

        if (this.mode === "filter") {
            if (titleEl) {
                titleEl.textContent =
                    "Фильтрация студентов";
            }

            if (submitBtn) {
                submitBtn.textContent =
                    "Применить фильтры";
            }

            if (isuEl) {
                isuEl.readOnly = false;
            }

            if (notesContainer) {
                notesContainer.hidden = true;
            }

            reqStars.forEach(star => star.hidden = true);

            return;
        }

        if (this.mode === "edit") {
            if (titleEl) {
                titleEl.textContent =
                    "Редактирование студента";
            }

            if (submitBtn) {
                submitBtn.textContent =
                    "Сохранить изменения";
            }

            if (isuEl) {
                isuEl.readOnly = true;
            }

            if (notesContainer) {
                notesContainer.hidden = false;
            }

            reqStars.forEach(star => star.hidden = false);

            return;
        }

        if (titleEl) {
            titleEl.textContent =
                "Добавление студента";
        }

        if (submitBtn) {
            submitBtn.textContent =
                "Сохранить данные";
        }

        if (isuEl) {
            isuEl.readOnly = false;
        }

        if (notesContainer) {
                notesContainer.hidden = false;
            }

        reqStars.forEach(star => star.hidden = false);

        [
            "fio",
            "group",
            "isu",
            "dorm",
            "room",
            "date"
        ].forEach(id => {
            const field =
                document.getElementById(id);

            if (field) {
                field.required = true;
            }
        });
    }

    #initEvents() {
        this.form.addEventListener("submit", async event => {
            event.preventDefault();

            const student =
                this.getStudentFromForm();

            try {
                if (this.onSubmitCallback) {
                    await this.onSubmitCallback(
                        student,
                        this.mode
                    );
                }
            } catch (error) {
                const status =
                    Number(error?.status);

                const errorMessages = {
                    400:
                        "Некорректный запрос. Проверьте введённые данные.",

                    404:
                        "Студент не найден.",

                    409:
                        "Студент с таким ИСУ ID уже существует.",

                    422:
                        `Сервер отклонил данные. Проверьте значения полей: ${error.message}`,
                    500:
                        "Ошибка со стороны сервера."
                };

                const errorMessage =
                    error?.code === "NETWORK_ERROR"
                        ? "Не удалось связаться с сервером."
                        : errorMessages[status]
                            || error?.message
                            || "Произошла неизвестная ошибка.";

                let errorEl =
                    document.getElementById(
                        "form-error"
                    );

                if (!errorEl) {
                    errorEl =
                        document.createElement("div");

                    errorEl = document.createElement("div");
                    errorEl.id = "form-error";
                    errorEl.className = "alert-box alert-danger";
                    errorEl.setAttribute(
                        "role",
                        "alert"
                    );

                    this.form.insertAdjacentElement(
                        "beforebegin",
                        errorEl
                    );
                }

                errorEl.textContent = errorMessage;
                errorEl.hidden = false;

                if (status === 500) {
                    this.form.hidden = true;

                    if (
                        document.getElementById(
                            "form-title"
                        )
                    ) {
                        document.getElementById(
                            "form-title"
                        ).textContent =
                            "Ошибка со стороны сервера";
                    }
                }
            }
        });
    }
}
