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
      // Final fallback: package.json
      try {
        const packagePath = join(__dirname, '../../package.json');
        const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
        const pkgVersion = packageJson.version || '2.0.8';
        
        // Extract major.minor.patch
        const majorMatch = pkgVersion.match(/^(\d+\.\d+\.\d+)/);
        res.locals.appVersion = majorMatch ? majorMatch[1] : '2.0.8';
      } catch (finalErr) {
        console.error('Error reading version from all sources:', finalErr);
        res.locals.appVersion = '2.0.8'; // Ultimate fallback
      }
    }
  }
  
  // Read FULL VERSION for footer/internal tracking
  try {
    const versionPath = join(__dirname, '../../VERSION');
    const fullVersion = readFileSync(versionPath, 'utf-8').trim();
    res.locals.fullVersion = fullVersion;
  } catch (error) {
    // Fallback to package.json
    try {
      const packagePath = join(__dirname, '../../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      res.locals.fullVersion = packageJson.version || '2.0.8';
    } catch (err) {
      res.locals.fullVersion = res.locals.appVersion; // Use major version as fallback
    }
  }
  
  next();
}

