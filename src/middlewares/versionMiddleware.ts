import { Request, Response, NextFunction } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Middleware to inject app version from VERSION file to all views
 * Falls back to package.json if VERSION file is not available
 */
export function injectAppVersion(req: Request, res: Response, next: NextFunction): void {
  try {
    // Try to read VERSION file first (single source of truth)
    const versionPath = join(__dirname, '../../VERSION');
    const version = readFileSync(versionPath, 'utf-8').trim();
    
    if (version && /^\d+\.\d+\.\d+$/.test(version)) {
      res.locals.appVersion = version;
    } else {
      throw new Error('Invalid version format in VERSION file');
    }
  } catch (error) {
    // Fallback to package.json
    try {
      const packagePath = join(__dirname, '../../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      res.locals.appVersion = packageJson.version || '2.0.5';
    } catch (err) {
      console.error('Error reading version from both VERSION and package.json:', err);
      res.locals.appVersion = '2.0.5'; // Final fallback
    }
  }
  
  next();
}

