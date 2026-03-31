import EventEmitter from 'events';
export declare class PPPoEStaticMonitor extends EventEmitter {
    private static instance;
    private scheduler;
    private constructor();
    static getInstance(): PPPoEStaticMonitor;
    private log;
    /**
     * Start the periodic check. Runs every 10 minutes by default.
     */
    startScheduler(cronExpression?: string): void;
    stopScheduler(): void;
}
export declare const pppoeStaticMonitor: PPPoEStaticMonitor;
//# sourceMappingURL=PPPoEStaticMonitor.d.ts.map