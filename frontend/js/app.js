import {Controller} from "./controller/Controller.js";
import {TableView} from "./view/TableView.js";
import {FormView} from "./view/FormView.js";
import {ProfileView} from "./view/ProfileView.js";
import {AuthView} from "./view/AuthView.js";
import {Student} from "./entity/Student.js";

const ERROR_MESSAGES = {
    400: "Некорректный запрос. Проверьте введённые данные.",
    401: "Требуется авторизация для выполнения операции.",
    403: "У вас недостаточно прав для выполнения этой операции.",
    404: "Запрошенный студент не найден.",
    409: "Студент с таким ИСУ ID уже существует.",
    422: "Сервер отклонил данные. Проверьте значения полей.",
    500: "Ошибка со стороны сервера."
};

function getErrorMessage(error) {
    if (error?.code === "NETWORK_ERROR") {
        return "Не удалось связаться с сервером.";
    }

    const status = Number(error?.status);

    return ERROR_MESSAGES[status]
        || error?.message
        || "Произошла неизвестная ошибка";
}

function showPageError(error) {
    let errorEl = document.getElementById("page-error");

    if (!errorEl) {
        errorEl = document.createElement("div");
        errorEl.id = "page-error";
        errorEl.className = "alert-box alert-danger";
        errorEl.setAttribute("role", "alert");

        const header = document.querySelector("header");

        if (header) {
            header.insertAdjacentElement("afterend", errorEl);
        } else {
            document.body.prepend(errorEl);
        }
    }

    errorEl.textContent = getErrorMessage(error);
    errorEl.hidden = false;

    return errorEl;
}

function hidePageError() {
    const errorEl = document.getElementById("page-error");

    if (errorEl) {
        errorEl.hidden = true;
    }
}

function hideElement(id) {
    const element = document.getElementById(id);

    if (element) {
        element.hidden = true;
    }
}

function handleServerError(error, options = {}) {
    const {hide = []} = options;

    showPageError(error);

    hide.forEach(hideElement);

    if (Number(error?.status) === 500) {
        const title = document.querySelector("h1");

        if (title) {
            title.textContent = "Ошибка со стороны сервера";
        }
    }
}

function getFiltersFromQuery() {
    const params = new URLSearchParams(window.location.search);

    const allowedFilters = [
        "isuId",
        "fio",
        "stGroup",
        "dormitoryNumber",
        "room",
        "dateOfPlacement",
        "isNotRussian"
    ];

    return Object.fromEntries(
        allowedFilters
            .filter(key => params.has(key) && params.get(key) !== "")
            .map(key => [key, params.get(key)])
    );
}

function getFilterQuery(student) {
    const values = {
        isuId: student.isuId,
        fio: student.fio,
        stGroup: student.stGroup,
        dormitoryNumber: student.dormitoryNumber,
        room: student.room,
        dateOfPlacement: student.dateOfPlacement
    };

    const params = new URLSearchParams();

    Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            params.set(key, String(value));
        }
    });

    params.set("isNotRussian", String(student.isNotRussian));

    return params;
}

document.addEventListener("DOMContentLoaded", async () => {
    const controller = Controller.getInstance();

    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken")
    const refreshTokenId = localStorage.getItem("refreshTokenId")
    const userRole = localStorage.getItem("userRole");
    const isAuthPage = window.location.pathname.endsWith("auth.html");

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        if (accessToken) {
            logoutBtn.hidden = false;
            logoutBtn.addEventListener("click", () => {
                try {
                    controller.logout(accessToken, refreshTokenId, refreshToken)
                    localStorage.removeItem("accessToken");
                    localStorage.removeItem("refreshToken");
                    localStorage.removeItem("refreshTokenId");
                    localStorage.removeItem("userRole");
                    window.location.href = "auth.html";
            } catch (error) {
                    handleServerError(error)
                }
            });
        } else {
            logoutBtn.hidden = true;
        }
    }

    if (!accessToken && !isAuthPage) {
        const authRequiredCard = document.getElementById("auth-required");
        const mainContent = document.getElementById("main-content")
            || document.getElementById("student-form");
        const headerActions = document.getElementById("header-actions");
        const paginationBtns = document.getElementById("pagination");

        if (authRequiredCard) {
            authRequiredCard.hidden = false;
        }
        if (mainContent) {
            mainContent.hidden = true;
        }
        if (headerActions) {
            headerActions.hidden = true;
        }
        if (paginationBtns) {
            paginationBtns.hidden = true
        }

        return;
    }

    if (userRole === "USER") {
        const addBtn = document.getElementById("add-btn");
        if (addBtn) {
            addBtn.hidden = true;
        }

        // разрешён только режим фильтрации mode=filter
        const currentMode = new URLSearchParams(window.location.search).get("mode");
        const studentForm = document.getElementById("student-form");

        if (studentForm && currentMode !== "filter") {
            studentForm.hidden = true;
            showPageError({
                message: "У вас нет прав для изменения данных." +
                    " Роль USER предназначена только для просмотра и фильтрации."
            });
            return;
        }
    }

    // Авторизация и регистрация (auth.html)
    if (document.getElementById("login-form")) {
        let authView;

        authView = new AuthView(
            async credentials => {
                try {
                    const data = await controller.login(
                        credentials.login,
                        credentials.password
                    );

                    localStorage.setItem("accessToken", data.accessToken);
                    localStorage.setItem("refreshToken", data.refreshToken);
                    localStorage.setItem("refreshTokenId", data.refreshTokenId)
                    localStorage.setItem("userRole", data.role || "USER");

                    authView.showAlert("Авторизация успешна! Перенаправление...", "success");
                    setTimeout(() => {
                        window.location.href = "index.html";
                    }, 800);
                } catch (error) {
                    authView.showAlert(
                        error.message || "Неверный логин или пароль",
                        "danger"
                    );
                }
            },
            async userData => {
                try {
                    await controller.register(userData);

                    authView.showAlert("Регистрация успешна! Теперь вы можете войти.", "success");
                    authView.resetRegisterForm();
                    setTimeout(() => {
                        authView.switchTab("login");
                    }, 1200);
                } catch (error) {
                    authView.showAlert(
                        error.message || "Не удалось зарегистрировать пользователя",
                        "danger"
                    );
                }
            }
        );
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const queryId = urlParams.get("id");
    const requestedMode = urlParams.get("mode");

    // Страница списка студентов (index.html)
    if (document.getElementById("students-table")) {
        const tableView = new TableView(
            "#table-body",

            async isuId => {
                await controller.deleteStudent(isuId);

                const filters =
                    getFiltersFromQuery();

                const students =
                    await controller.getStudents(filters);

                tableView.render(
                    students.map(Student.fromJSON)
                );
            },

            async pageNumber => {
                try {
                    hidePageError();

                    const filters =
                        getFiltersFromQuery();

                    const students =
                        await controller.getStudents(
                            filters
                        );

                    tableView.render(
                        students.map(Student.fromJSON)
                    );

                } catch (error) {
                    handleServerError(error, {
                        hide: [
                            "add-btn",
                            "filter-btn",
                            "students-table"
                        ]
                    });
                }
            }
        );

        const filterBtn =
            document.getElementById("filter-btn");

        if (filterBtn) {
            filterBtn.addEventListener(
                "click",
                event => {
                    event.preventDefault();

                    // Новые фильтры начинаются с первой страницы.
                    tableView.resetPage();

                    window.location.href =
                        "form.html?mode=filter";
                }
            );
        }

        try {
            hidePageError();

            const filters =
                getFiltersFromQuery();

            const students =
                await controller.getStudents(filters);

            tableView.render(
                students.map(Student.fromJSON)
            );

        } catch (error) {
            handleServerError(error, {
                hide: [
                    "add-btn",
                    "filter-btn",
                    "students-table"
                ]
            });
        }
    }

    // Страница формы (form.html)
    if (document.getElementById("student-form")) {
        const initialMode =
            requestedMode === "filter"
                ? "filter"
                : requestedMode === "edit"
                    ? "edit"
                    : "add";

        const formView = new FormView(
            "#student-form",
            async (student, mode) => {
                if (mode === "edit") {
                    await controller.updateStudent(
                        student.isuId,
                        student
                    );

                    window.location.href = "index.html";
                    return;
                }

                if (mode === "filter") {
                    const params = getFilterQuery(student);
                    const query = params.toString();

                    window.location.href = query
                        ? `index.html?${query}`
                        : "index.html";

                    return;
                }

                await controller.addStudent(student);

                window.location.href = "index.html";
            },
            initialMode
        );

        if (queryId) {
            try {
                const response =
                    await controller.getStudent(queryId);

                if (!response) {
                    handleServerError({ status: 404 }, {
                        hide: ["student-form"]
                    });
                    return;
                }

                formView.fillForm(
                    Student.fromJSON(response)
                );
            } catch (error) {
                handleServerError(error, {
                    hide: ["student-form"]
                });
            }
        }
    }

    // Страница карточки студента (student.html)
    if (document.querySelector(".profile-card")) {
        const profileView = new ProfileView();

        try {
            const response =
                await controller.getStudent(queryId);

            if (!response) {
                handleServerError({ status: 404 }, {
                    hide: ["profile-card"]
                });
                return;
            }

            profileView.render(
                Student.fromJSON(response)
            );
        } catch (error) {
            handleServerError(error, {
                hide: ["profile-card"]
            });
        }
    }
});
