import {Role} from "../entity/Role";

export interface UserContext {
    userId: number;
    login: string;
    email: string;
    role: Role;
}
