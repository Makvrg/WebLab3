export class AuthView {
    #loginForm;
    #registerForm;
    #tabLoginBtn;
    #tabRegisterBtn;
    #authTitle;
    #alertEl;

    #onLoginCallback;
    #onRegisterCallback;

    /**
     * @param {Function} onLoginCallback ({login, password}) => Promise<void>
     * @param {Function} onRegisterCallback ({login, email, password, role}) => Promise<void>
     */
    constructor(onLoginCallback, onRegisterCallback) {
        this.#loginForm = document.getElementById("login-form");
        this.#registerForm = document.getElementById("register-form");
        this.#tabLoginBtn = document.getElementById("tab-login-btn");
        this.#tabRegisterBtn = document.getElementById("tab-register-btn");
        this.#authTitle = document.getElementById("auth-title");
        this.#alertEl = document.getElementById("auth-alert");

        this.#onLoginCallback = onLoginCallback;
        this.#onRegisterCallback = onRegisterCallback;

        if (this.#loginForm && this.#registerForm) {
            this.#initEvents();
        }
    }

    switchTab(mode) {
        this.hideAlert();

        if (mode === "login") {
            this.#tabLoginBtn?.classList.add("active");
            this.#tabRegisterBtn?.classList.remove("active");
            this.#loginForm.hidden = false;
            this.#registerForm.hidden = true;
            if (this.#authTitle) this.#authTitle.textContent = "Вход в систему";
        } else {
            this.#tabRegisterBtn?.classList.add("active");
            this.#tabLoginBtn?.classList.remove("active");
            this.#loginForm.hidden = true;
            this.#registerForm.hidden = false;
            if (this.#authTitle) this.#authTitle.textContent = "Регистрация нового пользователя";
        }
    }

    showAlert(message, type = "danger") {
        if (!this.#alertEl) return;
        this.#alertEl.className = `alert-box alert-${type}`;
        this.#alertEl.textContent = message;
        this.#alertEl.hidden = false;
    }

    hideAlert() {
        if (this.#alertEl) {
            this.#alertEl.hidden = true;
        }
    }

    resetRegisterForm() {
        this.#registerForm?.reset();
    }

    getLoginData() {
        return {
            login: document.getElementById("login-login")?.value.trim() || "",
            password: document.getElementById("login-password")?.value || ""
        };
    }

    getRegisterData() {
        return {
            login: document.getElementById("reg-login")?.value.trim() || "",
            email: document.getElementById("reg-email")?.value.trim() || "",
            password: document.getElementById("reg-password")?.value || "",
            confirmPassword: document.getElementById("reg-password-confirm")?.value || "",
            role: document.getElementById("reg-role")?.value || "USER"
        };
    }

    #initEvents() {
        this.#tabLoginBtn?.addEventListener("click", () => this.switchTab("login"));
        this.#tabRegisterBtn?.addEventListener("click", () => this.switchTab("register"));

        this.#loginForm?.addEventListener("submit", async event => {
            event.preventDefault();
            this.hideAlert();

            const data = this.getLoginData();
            if (this.#onLoginCallback) {
                await this.#onLoginCallback(data);
            }
        });

        this.#registerForm?.addEventListener("submit", async event => {
            event.preventDefault();
            this.hideAlert();

            const data = this.getRegisterData();

            if (data.password !== data.confirmPassword) {
                this.showAlert("Пароль и подтверждение пароля не совпадают!", "danger");
                return;
            }

            if (this.#onRegisterCallback) {
                await this.#onRegisterCallback({
                    login: data.login,
                    email: data.email,
                    password: data.password,
                    role: data.role
                });
            }
        });
    }
}
