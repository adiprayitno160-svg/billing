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
  try {
    // Read VERSION_MAJOR for About page (stable version)
    const versionMajorPath = join(__dirname, '../../VERSION_MAJOR');
    const majorVersion = readFileSync(versionMajorPath, 'utf-8').trim();
    
    if (majorVersion && /^\d+\.\d+\.\d+$/.test(majorVersion)) {
      res.locals.appVersion = majorVersion;
    } else {
      throw new Error('Invalid major version format in VERSION_MAJOR file');
    }
  } catch (error) {
    // Fallback: Try VERSION file
    try {
      const versionPath = join(__dirname, '../../VERSION');
      const version = readFileSync(versionPath, 'utf-8').trim();
      
      // Extract major.minor.patch from full version (e.g., 2.0.8.5 → 2.0.8)
      const majorMatch = version.match(/^(\d+\.\d+\.\d+)/);
      if (majorMatch) {
        res.locals.appVersion = majorMatch[1];
      } else {
        throw new Error('Invalid version format in VERSION file');
      }
    } catch (err) {
      // Final fallback: package.json - PRIMARY SOURCE
      try {
        const packagePath = join(__dirname, '../../package.json');
        const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
        const pkgVersion = packageJson.version || '1.0.0';
        
        // Extract major.minor.patch from package.json version (e.g., 2.1.23 → 2.1.23)
        const majorMatch = pkgVersion.match(/^(\d+\.\d+\.\d+)/);
        res.locals.appVersion = majorMatch ? majorMatch[1] : pkgVersion;
      } catch (finalErr) {
        console.error('Error reading version from all sources:', finalErr);
        // Don't hardcode, try to get from package.json directly
        try {
          const packagePath = join(__dirname, '../../package.json');
          const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
          res.locals.appVersion = packageJson.version || '1.0.0';
        } catch (lastErr) {
          console.error('Ultimate fallback failed:', lastErr);
          res.locals.appVersion = '1.0.0'; // Only use this if everything fails
        }
      }
    }
  }
  
  // Read FULL VERSION for footer/internal tracking
  try {
    const versionPath = join(__dirname, '../../VERSION');
    const fullVersion = readFileSync(versionPath, 'utf-8').trim();
    res.locals.fullVersion = fullVersion;
  } catch (error) {
    // Fallback to package.json - PRIMARY SOURCE
    try {
      const packagePath = join(__dirname, '../../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      res.locals.fullVersion = packageJson.version || res.locals.appVersion;
    } catch (err) {
      res.locals.fullVersion = res.locals.appVersion; // Use major version as fallback
    }
  }
  
  next();
}

