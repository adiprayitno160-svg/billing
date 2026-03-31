"use strict";
/**
 * WhatsApp Module Exports
 * Modern Baileys-based implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppHandler = exports.whatsappService = exports.WhatsAppService = void 0;
var WhatsAppService_1 = require("./WhatsAppService");
Object.defineProperty(exports, "WhatsAppService", { enumerable: true, get: function () { return WhatsAppService_1.WhatsAppService; } });
Object.defineProperty(exports, "whatsappService", { enumerable: true, get: function () { return WhatsAppService_1.whatsappService; } });
// Re-export handler if exists
var WhatsAppHandler_1 = require("./WhatsAppHandler");
Object.defineProperty(exports, "WhatsAppHandler", { enumerable: true, get: function () { return WhatsAppHandler_1.WhatsAppHandler; } });
