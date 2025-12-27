
import { GitHubService } from '../services/update/GitHubService';

console.log('Testing getMajorVersion...');
console.log('Result:', GitHubService.getMajorVersion());

import path from 'path';
console.log('__dirname:', __dirname);
console.log('Expected package.json path:', path.join(__dirname, '../services/update/../../../package.json'));
