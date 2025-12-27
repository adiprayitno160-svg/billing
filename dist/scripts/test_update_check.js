"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GitHubService_1 = require("../services/update/GitHubService");
async function testUpdateCheck() {
    try {
        console.log('Testing GitHub Update Check...');
        const result = await GitHubService_1.GitHubService.checkForUpdates();
        console.log('Result:', JSON.stringify(result, null, 2));
        process.exit(0);
    }
    catch (e) {
        console.error(e);
        process.exit(1);
    }
}
testUpdateCheck();
//# sourceMappingURL=test_update_check.js.map