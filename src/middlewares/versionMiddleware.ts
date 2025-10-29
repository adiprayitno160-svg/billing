import { Request, Response, NextFunction } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Middleware to inject app version from package.json to all views
 */
export function injectAppVersion(req: Request, res: Response, next: NextFunction): void {
  try {
    const packagePath = join(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    
    // Inject version to res.locals so it's available in all EJS views
    res.locals.appVersion = packageJson.version || '2.0.3';
  } catch (error) {
    console.error('Error reading package.json for version:', error);
    res.locals.appVersion = '2.0.3'; // Fallback version
  }
  
  next();
}

