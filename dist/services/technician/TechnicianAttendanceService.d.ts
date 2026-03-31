export declare class TechnicianAttendanceService {
    static ensureTable(): Promise<void>;
    static checkIn(technicianId: number, wage: number): Promise<void>;
    static getMonthlyReport(technicianId: number, month: number, year: number): Promise<{
        attendance: any[];
        jobs: any[];
    }>;
}
//# sourceMappingURL=TechnicianAttendanceService.d.ts.map