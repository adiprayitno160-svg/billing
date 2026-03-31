export declare class ReceiptGenerator {
    static generate(data: {
        date: string;
        refId: string;
        name: string;
        amount: number;
        item: string;
        paymentMethod: string;
    }): Promise<Buffer>;
}
//# sourceMappingURL=ReceiptGenerator.d.ts.map