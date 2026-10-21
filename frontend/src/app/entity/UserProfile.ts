import {Role} from './Role';

export class UserProfile {
  constructor(
    public login: string,
    public email: string,
    public role: Role
  ) {}
}
