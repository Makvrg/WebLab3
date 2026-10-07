export class Controller {

    static #instance = null;
    static BASE_URL = "http://127.0.0.1:5000";
    static API_URL = `${Controller.BASE_URL}/students`;
    static AUTH_URL = `${Controller.BASE_URL}/auth`;

    constructor() {
        throw new Error("Используйте Controller.getInstance() вместо new");
    }

    static getInstance() {
        if (!Controller.#instance) {
            Controller.#instance = Object.create(Controller.prototype);
        }
        return Controller.#instance;
    }

    async login(login, password) {
        return await this.request_response_cycle(`${Controller.AUTH_URL}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ login, password })
        });
    }

    async register(userData) {
        return await this.request_response_cycle(`${Controller.AUTH_URL}/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(userData)
        });
    }

    async getStudents(filters = {}) {
        const url = new URL(Controller.API_URL);

        const allowedFilters = [
            "isuId",
            "fio",
            "stGroup",
            "dormitoryNumber",
            "room",
            "dateOfPlacement",
            "isNotRussian",
        ];

        for (const key of allowedFilters) {
            const value = filters[key];

            if (value !== undefined && value !== null && value !== "") {
                url.searchParams.set(key, String(value));
            }
        }

        return await this.request_response_cycle(url.toString(), {
            method: "GET"
        }
        );
    }

    async getStudent(id) {
        return await this.request_response_cycle(
            `${Controller.API_URL}/${encodeURIComponent(id)}`, {
            method: "GET"
        }
        );
    }

    async addStudent(student) {
        return await this.request_response_cycle(Controller.API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(student)
        }
        );
    }

    async updateStudent(id, student) {
        return await this.request_response_cycle(
            `${Controller.API_URL}/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(student)
        }
        );
    }

    async deleteStudent(id) {
        return await this.request_response_cycle(
            `${Controller.API_URL}/${encodeURIComponent(id)}`, {
            method: "DELETE"
        }
        );
    }

    async request_response_cycle(url, options = {}) {
        let response;
        try {
            response = await fetch(url, {
                ...options,
                headers: {
                    Accept: "application/json",
                    ...options.headers
                }
            });
        } catch (error) {
            throw this.createNetworkError(error);
        }
        return await this.processResponse(response);
    }

    async processResponse(response) {
        if (response.status === 204) {
            return null;
        }

        const data = await this.parseResponseBody(response);

        if (!response.ok) {
            const error = new Error(
                data?.error?.message ||
                data?.message ||
                `HTTP error: ${response.status}`
            );

            error.status = response.status;
            error.code = data?.error?.code;

            throw error;
        }
        return data;
    }

    async parseResponseBody(response) {
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
            try {
                return await response.json();
            } catch {
                return null;
            }
        }
        return null;
    }

    createNetworkError(error) {
        if (error?.status !== undefined) {
            return error;
        }

        const networkError = new Error(
            "Не удалось связаться с сервером"
        );

        networkError.code = "NETWORK_ERROR";
        networkError.originalError = error;

        return networkError;
    }
}
