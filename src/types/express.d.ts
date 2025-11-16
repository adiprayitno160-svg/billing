import { User } from '../services/userService';

declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}

export {};






