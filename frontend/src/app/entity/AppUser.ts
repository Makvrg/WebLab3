import {Role} from "./Role";

export interface AppUser {
    id: number | string;
    displayName: string;
    roles: Role[];
}
