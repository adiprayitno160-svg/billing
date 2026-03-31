import { Request, Response, NextFunction } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Middleware to inject app version from VERSION files to all views
 * 
 * Versioning Strategy:
 * - appVersion (VERSION_MAJOR): Untuk About page (2.0.8) - stable release only
 * - fullVersion (VERSION): Untuk footer/internal (2.0.8.5) - includes hotfixes
 * 
 * Falls back to package.json if VERSION files are not available
 */
export function injectAppVersion(req: Request, res: Response, next: NextFunction): void {
  // Strategy: ALWAYS trust package.json as the single source of truth for the version.
  // VERSION and VERSION_MAJOR files are legacy or secondary.

  let version = '1.0.0';

  try {
    const packagePath = join(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    if (packageJson.version) {
      version = packageJson.version;
    }
  } catch (err) {
    console.warn('Failed to read package.json version:', err);
  }

  // Set both to the same package.json version to ensure consistency
  // If you really want a split (major vs full), we can parse it, but for now exact match is best for debugging updates.
  res.locals.appVersion = version;
  res.locals.fullVersion = version;

  next();
}

