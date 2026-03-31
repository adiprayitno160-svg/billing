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
exports.checkPppoeAvailability = void 0;
const pool_1 = require("../../db/pool");
const mikrotikConfigHelper_1 = require("../../utils/mikrotikConfigHelper");
const checkPppoeAvailability = async (req, res) => {
    const { username, exclude_id } = req.query;
    if (!username) {
        return res.json({ error: 'Username required' });
    }
    const cleanUsername = String(username).trim();
    let result = {
        existsInDb: false,
        existsInMikrotik: false,
        customerId: null,
        customerName: null,
        customerCode: null,
        password: null,
        profile: null
    };
    try {
        // 1. Check Database
        let query = 'SELECT id, name, customer_code FROM customers WHERE pppoe_username = ?';
        let params = [cleanUsername];
        if (exclude_id) {
            query += ' AND id != ?';
            params.push(exclude_id);
        }
        query += ' LIMIT 1';
        const [rows] = await pool_1.databasePool.query(query, params);
        if (rows.length > 0) {
            result.existsInDb = true;
            result.customerId = rows[0].id;
            result.customerName = rows[0].name;
            result.customerCode = rows[0].customer_code;
        }
        // 2. Check MikroTik Only if NOT in DB (or if we want to support recovering orphaned)
        if (!result.existsInDb) {
            const config = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
            if (config) {
                // Dynamic import to avoid issues
                const { RouterOSAPI } = await Promise.resolve().then(() => __importStar(require('node-routeros')));
                const api = new RouterOSAPI({
                    host: config.host,
                    port: config.port,
                    user: config.username,
                    password: config.password,
                    timeout: 5000
                });
                try {
                    await api.connect();
                    // Check Secrets
                    const secrets = await api.write('/ppp/secret/print', [`?name=${cleanUsername}`]);
                    if (secrets && secrets.length > 0) {
                        result.existsInMikrotik = true;
                        result.password = secrets[0].password;
                        result.profile = secrets[0].profile;
                    }
                    await api.close();
                }
                catch (mtErr) {
                    console.error('MikroTik Check Error:', mtErr);
                }
            }
        }
        res.json(result);
    }
    catch (err) {
        console.error('Check API Error:', err);
        res.status(500).json({ error: 'System error' });
    }
};
exports.checkPppoeAvailability = checkPppoeAvailability;
//# sourceMappingURL=CustomerApiController.js.map