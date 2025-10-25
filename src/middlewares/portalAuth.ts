import { Request, Response, NextFunction } from 'express';

/**
 * Middleware untuk autentikasi portal prepaid
 * Check if customer is logged in to portal
 */
export function requirePortalAuth(req: Request, res: Response, next: NextFunction) {
  const session = req.session as any;

  if (!session || !session.portalCustomerId) {
    return res.redirect('/prepaid/portal/login?error=Silakan login terlebih dahulu');
  }

  next();
}

/**
 * Middleware untuk redirect jika sudah login
 */
export function redirectIfPortalAuthenticated(req: Request, res: Response, next: NextFunction) {
  const session = req.session as any;

  if (session && session.portalCustomerId) {
    return res.redirect('/prepaid/portal/packages');
  }

  next();
}

/**
 * Attach portal session data to locals untuk views
 */
export function attachPortalSession(req: Request, res: Response, next: NextFunction) {
  const session = req.session as any;

  if (session && session.portalCustomerId) {
    res.locals.portalLoggedIn = true;
    res.locals.portalCustomerId = session.portalCustomerId;
    res.locals.portalCustomerName = session.customerName || 'Customer';
  } else {
    res.locals.portalLoggedIn = false;
  }

  next();
}

