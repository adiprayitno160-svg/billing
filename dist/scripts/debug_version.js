"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const GitHubService_1 = require("../services/update/GitHubService");
console.log('Testing getMajorVersion...');
console.log('Result:', GitHubService_1.GitHubService.getMajorVersion());
const path_1 = __importDefault(require("path"));
console.log('__dirname:', __dirname);
console.log('Expected package.json path:', path_1.default.join(__dirname, '../services/update/../../../package.json'));
//# sourceMappingURL=debug_version.js.map