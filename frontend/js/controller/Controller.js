export class Controller {

    static #instance = null;
    static BASE_URL = "http://127.0.0.1:5000";
    static API_URL = `${Controller.BASE_URL}/students`;
    static AUTH_URL = `${Controller.BASE_URL}/auth`;
    static PAGE_SIZE = 15

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
        return await this.request_response_cycle(`${Controller.AUTH_URL}/login`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({login, password})
            });
    }

    async register(userData) {
        return await this.request_response_cycle(`${Controller.AUTH_URL}/register`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(userData)
            });
    }

    async refresh(refreshTokenId, refreshToken) {
        return await this.request_response_cycle(`${Controller.AUTH_URL}/refresh`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({refreshTokenId, refreshToken})
            });
    }

    async logout(accessToken, refreshTokenId, refreshToken) {
        return await this.request_response_cycle(`${Controller.AUTH_URL}/logout`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({accessToken, refreshTokenId, refreshToken})
            });
    }

    async getStudents(filters = {}) {
        let pageNumber = Number(localStorage.getItem("pageNumber"))
        if (!pageNumber || pageNumber <= 0) {
            pageNumber = 1
            localStorage.setItem("pageNumber", String(pageNumber))
        }

        const url = new URL(Controller.API_URL);

        const allowedFilters = [
            "isuId",
            "fio",
            "stGroup",
            "dormitoryNumber",
            "room",
            "dateOfPlacement",
            "isNotRussian"
        ];

        for (const key of allowedFilters) {
            const value = filters[key];

            if (value !== undefined && value !== null && value !== "") {
                url.searchParams.set(key, String(value));
            }
        }
        url.searchParams.set("pageSize", String(Controller.PAGE_SIZE));
        url.searchParams.set("pageNumber", String(pageNumber));

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

        const accessToken = localStorage.getItem("accessToken");

        const headers = {
            Accept: "application/json",
            ...options.headers
        };

        if (accessToken) {
            headers.Authorization = `Bearer ${accessToken}`;
        }

        try {
            response = await fetch(url, {
                ...options,
                headers
            });
        } catch (error) {
            throw this.createNetworkError(error);
        }

        if (response.status !== 401 || options._retry) {
            return await this.processResponse(response);
        }

        const refreshTokenId = localStorage.getItem("refreshTokenId");
        const refreshToken = localStorage.getItem("refreshToken");

        if (!refreshTokenId || !refreshToken) {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshTokenId");
            localStorage.removeItem("refreshToken");
            localStorage.removeItem("userRole");

            return await this.processResponse(response);
        }

        try {
            const data = await this.refresh(
                refreshTokenId,
                refreshToken
            );

            if (!data?.accessToken) {
                throw new Error("Не удалось получить новый accessToken");
            }
            localStorage.setItem("accessToken", data.accessToken);
            if (!data?.refreshTokenId) {
                throw new Error("Не удалось получить новый refreshTokenId");
            }
            localStorage.setItem("refreshTokenId", data.refreshTokenId);
            if (!data?.refreshToken) {
                throw new Error("Не удалось получить новый refreshToken");
            }
            localStorage.setItem("refreshToken", data.refreshToken);

            return await this.request_response_cycle(url, {
                ...options,
                _retry: true,
                headers: {
                    ...options.headers,
                    Authorization: `Bearer ${data.accessToken}`
                }
            });

        } catch (error) {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshTokenId");
            localStorage.removeItem("refreshToken");
            localStorage.removeItem("userRole")
            throw error;
        }
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
