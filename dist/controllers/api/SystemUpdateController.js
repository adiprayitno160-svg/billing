"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performSystemUpdate = exports.checkSystemUpdate = void 0;
const SystemUpdateService_1 = require("../../services/system/SystemUpdateService");
const checkSystemUpdate = async (req, res) => {
    try {
        const status = await SystemUpdateService_1.SystemUpdateService.checkForUpdates();
        res.json({
            success: true,
            hasUpdate: status.hasUpdate,
            behind: status.behind,
            commits: status.commits
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.checkSystemUpdate = checkSystemUpdate;
const performSystemUpdate = async (req, res) => {
    try {
        const result = await SystemUpdateService_1.SystemUpdateService.performUpdate();
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.performSystemUpdate = performSystemUpdate;
//# sourceMappingURL=SystemUpdateController.js.map