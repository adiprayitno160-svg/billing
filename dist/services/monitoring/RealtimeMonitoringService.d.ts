import { Server as SocketIOServer } from 'socket.io';
export declare class RealtimeMonitoringService {
    private io;
    private isRunning;
    private interval;
    private readonly POLLING_INTERVAL;
    private lastOnlineUsernames;
    constructor(io: SocketIOServer);
    start(): void;
    stop(): void;
    private startPolling;
    private gatherMetrics;
    private getServerStats;
    private getNetworkStats;
    private processCustomerAlerts;
}
//# sourceMappingURL=RealtimeMonitoringService.d.ts.map