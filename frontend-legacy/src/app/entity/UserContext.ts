import {Role} from "./Role";

export interface UserContext {
    userId: number | string;
    login: string;
    email: string;
    role: Role;
}
