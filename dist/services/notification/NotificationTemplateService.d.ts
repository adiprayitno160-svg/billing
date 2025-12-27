/**
 * Notification Template Service
 * Manages notification templates that can be customized
 */
export interface NotificationTemplate {
    id?: number;
    template_code: string;
    template_name: string;
    notification_type: string;
    channel: 'whatsapp' | 'email' | 'sms' | 'push';
    title_template: string;
    message_template: string;
    variables?: string[];
    is_active: boolean;
    priority: 'low' | 'normal' | 'high';
    schedule_days_before?: number;
    created_at?: Date;
    updated_at?: Date;
}
export declare class NotificationTemplateService {
    /**
     * Get all templates
     */
    static getAllTemplates(filters?: {
        notification_type?: string;
        channel?: string;
        is_active?: boolean;
    }): Promise<NotificationTemplate[]>;
    /**
     * Get template by code
     */
    static getTemplateByCode(templateCode: string): Promise<NotificationTemplate | null>;
    /**
     * Get template by notification type and channel
     */
    static getTemplate(notificationType: string, channel?: string): Promise<NotificationTemplate | null>;
    /**
     * Create new template
     */
    static createTemplate(template: Omit<NotificationTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<number>;
    /**
     * Update template
     */
    static updateTemplate(templateCode: string, updates: Partial<Omit<NotificationTemplate, 'id' | 'template_code' | 'created_at' | 'updated_at'>>): Promise<boolean>;
    /**
     * Delete template
     */
    static deleteTemplate(templateCode: string): Promise<boolean>;
    /**
     * Replace template variables with actual values
     */
    static replaceVariables(template: string, variables: Record<string, any>): string;
    /**
     * Format currency
     */
    static formatCurrency(amount: number): string;
    /**
     * Format date
     */
    static formatDate(date: Date | string): string;
}
//# sourceMappingURL=NotificationTemplateService.d.ts.map