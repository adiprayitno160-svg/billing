"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const isolationService_1 = require("../services/billing/isolationService");
const pool_1 = require("../db/pool");
const IS = __importStar(require("../services/billing/isolationService"));
async function restore() {
    console.log("IS keys:", Object.keys(IS));
    console.log("Type of IsolationService:", typeof isolationService_1.IsolationService);
    // Use getOwnPropertyNames for classes
    console.log("IsolationService members:", Object.getOwnPropertyNames(isolationService_1.IsolationService));
    console.log("Restoring Customer 839...");
    try {
        const result = await isolationService_1.IsolationService.restoreIfQualified(839);
        console.log("RESTORE RESULT:", result);
    }
    catch (err) {
        console.error("FAILURE:", err.message);
    }
    finally {
        await pool_1.databasePool.end();
    }
}
restore();
//# sourceMappingURL=restore-839.js.map