export class TableView {

    tbody;
    onDeleteCallback;
    onPageChangeCallback;

    /**
     * Фиксированный размер страницы.
     */
    static PAGE_SIZE = 8;

    /**
     * Ключ текущей страницы в localStorage.
     */
    static PAGE_NUMBER_KEY = "pageNumber";

    /**
     * @param {string} tbodySelector Селектор tbody для работы со строками таблицы
     * @param {Function} onDeleteCallback (isuId: string|number) => void
     * @param {Function} onPageChangeCallback (pageNumber: number) => void
     */
    constructor(
        tbodySelector,
        onDeleteCallback,
        onPageChangeCallback
    ) {
        this.tbody = document.querySelector(tbodySelector);
        this.onDeleteCallback = onDeleteCallback;
        this.onPageChangeCallback = onPageChangeCallback;

        this.#initPageNumber();
        this.#initEvents();
        this.#initPaginationEvents();
        this.#updatePaginationButtons();
    }

    /**
     * Возвращает текущую страницу.
     *
     * @returns {number}
     */
    getCurrentPage() {
        const pageNumber =
            Number(
                localStorage.getItem(
                    TableView.PAGE_NUMBER_KEY
                )
            );

        if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
            return 1;
        }

        return pageNumber;
    }

    /**
     * Устанавливает текущую страницу.
     *
     * @param {number} pageNumber
     */
    setCurrentPage(pageNumber) {
        const normalizedPage =
            Number.isInteger(pageNumber) && pageNumber > 0
                ? pageNumber
                : 1;

        localStorage.setItem(
            TableView.PAGE_NUMBER_KEY,
            String(normalizedPage)
        );

        this.#updatePaginationButtons();
    }

    /**
     * Сбрасывает пагинацию на первую страницу.
     */
    resetPage() {
        this.setCurrentPage(1);
    }

    /**
     * Рендерит студентов и обновляет состояние кнопок пагинации.
     *
     * @param {Array} students
     */
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

            this.#updatePaginationButtons(0);

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

            const userRole =
                localStorage.getItem("userRole");

            const isAdmin =
                userRole === "ADMIN";

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

        this.#updatePaginationButtons(students.length);
    }

    /**
     * Инициализирует номер страницы в localStorage.
     */
    #initPageNumber() {
        const pageNumber =
            Number(
                localStorage.getItem(
                    TableView.PAGE_NUMBER_KEY
                )
            );

        if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
            localStorage.setItem(
                TableView.PAGE_NUMBER_KEY,
                "1"
            );
        }
    }

    /**
     * Обновляет состояние кнопок пагинации.
     *
     * Если количество записей меньше размера страницы,
     * значит следующей страницы нет.
     *
     * @param {number|null} studentsCount
     */
    #updatePaginationButtons(studentsCount = null) {
        const prevBtn =
            document.getElementById("prev-page-btn");

        const nextBtn =
            document.getElementById("next-page-btn");

        const pagination =
            document.getElementById("pagination");

        if (!prevBtn || !nextBtn) {
            return;
        }

        const currentPage =
            this.getCurrentPage();

        prevBtn.disabled =
            currentPage <= 1;

        if (studentsCount !== null) {
            nextBtn.disabled =
                studentsCount < TableView.PAGE_SIZE;
        }

        if (pagination) {
            pagination.hidden = false;
        }
    }

    /**
     * Обработка кнопок пагинации.
     */
    #initPaginationEvents() {
        const prevBtn =
            document.getElementById("prev-page-btn");

        const nextBtn =
            document.getElementById("next-page-btn");

        if (prevBtn) {
            prevBtn.addEventListener(
                "click",
                () => {
                    const currentPage =
                        this.getCurrentPage();

                    if (currentPage <= 1) {
                        return;
                    }

                    const newPage =
                        currentPage - 1;

                    this.setCurrentPage(newPage);

                    if (this.onPageChangeCallback) {
                        this.onPageChangeCallback(newPage);
                    }
                }
            );
        }

        if (nextBtn) {
            nextBtn.addEventListener(
                "click",
                () => {
                    const currentPage =
                        this.getCurrentPage();

                    const newPage =
                        currentPage + 1;

                    this.setCurrentPage(newPage);

                    if (this.onPageChangeCallback) {
                        this.onPageChangeCallback(newPage);
                    }
                }
            );
        }
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

            const pagination =
                document.getElementById("pagination");

            if (pagination) {
                pagination.hidden = true;
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
        let successEl =
            document.getElementById("table-success");

        if (!successEl) {
            successEl =
                document.createElement("div");

            successEl.id = "table-success";
            successEl.className =
                "alert-box alert-success";

            const tableContainer =
                document.querySelector(
                    ".table-responsive"
                );

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
        if (!this.tbody) {
            return;
        }

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

                    this.#showSuccess(
                        "Студент успешно удален"
                    );

                } catch (error) {
                    this.#showError(error);

                } finally {
                    event.target.disabled = false;
                }
            }
        );
    }
}
