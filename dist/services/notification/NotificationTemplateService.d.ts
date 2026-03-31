export interface NotificationTemplate {
    id?: number;
    template_code: string;
    template_name: string;
    notification_type: string;
    channel: string;
    title_template: string;
    message_template: string;
    variables: string[] | string;
    is_active: boolean;
    priority: 'low' | 'normal' | 'high';
    schedule_days_before?: number;
    created_at?: Date;
    updated_at?: Date;
}
export declare class NotificationTemplateService {
    /**
     * Get a notification template from database
     */
    static getTemplate(notificationType: string, channel: string): Promise<NotificationTemplate | null>;
    /**
     * Get template by code
     */
    static getTemplateByCode(code: string): Promise<NotificationTemplate | null>;
    /**
     * Get all templates with optional filters
     */
    static getAllTemplates(filters?: {
        notification_type?: string;
        channel?: string;
        is_active?: boolean;
    }): Promise<NotificationTemplate[]>;
    /**
     * Create new template
     */
    static createTemplate(data: Partial<NotificationTemplate>): Promise<number>;
    /**
     * Update template
     */
    static updateTemplate(code: string, data: Partial<NotificationTemplate>): Promise<boolean>;
    /**
     * Delete template
     */
    static deleteTemplate(code: string): Promise<boolean>;
    /**
     * Replace variables in a template string
     */
    static replaceVariables(template: string, variables: Record<string, any>): string;
    /**
     * Format currency for display in messages
     */
    static formatCurrency(amount: number): string;
    /**
     * Format date for display in messages
     */
    static formatDate(date: Date): string;
    /**
     * Format notification message for anomalies
     */
    formatNotificationMessage(connectionType: string, severity: string, isMassOutage: boolean | undefined, variables: Record<string, any>): string;
}
//# sourceMappingURL=NotificationTemplateService.d.ts.map