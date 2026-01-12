
const { PingService } = require('./dist/services/pingService');
// Note: PingService is exported as default new PingService() in source, 
// but let's check how it compiles to JS. usually `exports.default`.
// Or if it uses `export class`, it might differ.
// Let's try importing default.

async function run() {
    try {
        console.log("Running PingService.monitorAllStaticIPs()...");

        // Dynamic import to handle potential ES module interop issues if needed
        // But for commonjs (dist), require should work.
        // Checking file: src/services/pingService.ts: export default new PingService();

        const pingServiceModule = require('./dist/services/pingService');
        const pingService = pingServiceModule.default || pingServiceModule;

        await pingService.monitorAllStaticIPs();

        console.log("Ping Service Run Complete.");
    } catch (error) {
        console.error("Error running Ping Service:", error);
    } finally {
        process.exit();
    }
}

run();
