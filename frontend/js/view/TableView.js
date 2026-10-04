export class TableView {

    tbody;
    onDeleteCallback;

    /**
     * @param {string} tbodySelector Селектор tbody для работы со строками таблицы
     * @param {Function} onDeleteCallback (isuId: string|number) => void
     */
    constructor(tbodySelector, onDeleteCallback) {
        this.tbody = document.querySelector(tbodySelector);
        this.onDeleteCallback = onDeleteCallback;

        if (this.tbody) {
            this.#initEvents();
        }
    }

    render(students) {
        if (!this.tbody) return;

        this.tbody.innerHTML = "";

        if (students.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");

            td.colSpan = 6;
            td.style.textAlign = "center";
            td.textContent = "Студентов пока нет";

            tr.appendChild(td);
            this.tbody.appendChild(tr);

            return;
        }

        students.forEach(student => {
            const tr = document.createElement("tr");
            tr.dataset.isuId = student.isuId;

            const fields = [
                student.isuId,
                student.fio,
                student.stGroup,
                student.dormitoryNumber,
                student.room
            ];

            fields.forEach(value => {
                const td = document.createElement("td");

                td.textContent = value ?? "";

                tr.appendChild(td);
            });

            const actionsTd =
                document.createElement("td");

            actionsTd.className = "actions";

            const safeIsuId =
                encodeURIComponent(student.isuId);

            const userRole = localStorage.getItem("userRole");
            const isAdmin = userRole === "ADMIN";

            actionsTd.innerHTML = `
                <a href="student.html?id=${safeIsuId}" class="btn btn-small">Просмотр</a>
                ${isAdmin ? `
                    <a href="form.html?id=${safeIsuId}&mode=edit" class="btn btn-small btn-primary">Изменить</a>
                    <button class="btn btn-small btn-danger btn-delete">Удалить</button>
                ` : ""}
            `;

            tr.appendChild(actionsTd);
            this.tbody.appendChild(tr);
        });
    }

    #getErrorMessage(error) {
        if (error?.code === "NETWORK_ERROR") {
            return "Не удалось связаться с сервером.";
        }

        const status =
            Number(error?.status);

        return ({
            400:
                "Некорректный запрос. Проверьте введённые данные.",

            404:
                "Студент для удаления не найден.",

            409:
                "Операция конфликтует с текущими данными.",

            422:
                "Сервер отклонил данные операции.",

            500:
                "Ошибка со стороны сервера."
        }[status] || error?.message
            || "Произошла неизвестная ошибка.");
    }

    #showError(error) {
        let errorEl =
            document.getElementById("table-error");

        if (!errorEl) {
            errorEl =
                document.createElement("div");

            errorEl = document.createElement("div");
            errorEl.id = "table-error";
            errorEl.className = "alert-box alert-danger";
            errorEl.setAttribute(
                "role",
                "alert"
            );

            const tableContainer =
                document.querySelector(
                    ".table-responsive"
                );

            if (tableContainer) {
                tableContainer.insertAdjacentElement(
                    "beforebegin",
                    errorEl
                );
            } else {
                this.tbody.parentElement?.insertAdjacentElement(
                    "beforebegin",
                    errorEl
                );
            }
        }

        errorEl.textContent =
            this.#getErrorMessage(error);

        errorEl.hidden = false;

        if (Number(error?.status) === 500) {
            const addBtn =
                document.getElementById("add-btn");

            const filterBtn =
                document.getElementById("filter-btn");

            const tableBody =
                document.getElementById("table-body");

            if (addBtn) {
                addBtn.hidden = true;
            }

            if (filterBtn) {
                filterBtn.hidden = true;
            }

            if (tableBody) {
                tableBody.hidden = true;
            }

            const title =
                document.querySelector("h1");

            if (title) {
                title.textContent =
                    "Ошибка со стороны сервера";
            }
        }
    }

    #showSuccess(message) {
        let successEl
            = document.getElementById("table-success");
        if (!successEl) {
            successEl = document.createElement("div");
            successEl.id = "table-success";
            successEl.className = "alert-box alert-success";
            const tableContainer =
                document.querySelector(".table-responsive");
            if (tableContainer) {
                tableContainer.insertAdjacentElement(
                    "beforebegin",
                    successEl
                );
            }
        }
        successEl.textContent = message;
        successEl.hidden = false;
        setTimeout(() => {
            successEl.hidden = true;
        }, 3000);
    }

    #initEvents() {
        this.tbody.addEventListener(
            "click",
            async event => {
                if (
                    !event.target.classList.contains(
                        "btn-delete"
                    )
                ) {
                    return;
                }

                const tr =
                    event.target.closest("tr");

                if (
                    !tr
                    || !tr.dataset.isuId
                ) {
                    return;
                }

                event.target.disabled = true;

                try {
                    await this.onDeleteCallback(
                        tr.dataset.isuId
                    );

                    const errorEl =
                        document.getElementById(
                            "table-error"
                        );

                    if (errorEl) {
                        errorEl.hidden = true;
                    }

                    this.#showSuccess("Студент успешно удален");

                } catch (error) {
                    this.#showError(error);

                } finally {
                    event.target.disabled = false;
                }
            }
        );
    }
}
