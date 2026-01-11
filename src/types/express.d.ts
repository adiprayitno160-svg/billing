import { User } from '../services/userService';

declare global {
    namespace Express {
        interface Request {
            user?: any;
            flash(type: string, message: any): any;
            session: any;
        }
    }
}

export { };







