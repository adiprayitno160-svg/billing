export declare class ActivationService {
    /**
     * Finalize activation after payment is confirmed
     */
    static activate(pendingRegistrationId: number): Promise<{
        success: boolean;
        message: string;
        customerId?: number;
    }>;
}
//# sourceMappingURL=ActivationService.d.ts.map