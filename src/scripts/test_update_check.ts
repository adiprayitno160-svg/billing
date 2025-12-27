
import { GitHubService } from '../services/update/GitHubService';

async function testUpdateCheck() {
    try {
        console.log('Testing GitHub Update Check...');
        const result = await GitHubService.checkForUpdates();
        console.log('Result:', JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

testUpdateCheck();
