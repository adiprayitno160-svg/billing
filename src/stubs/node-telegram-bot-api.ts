/**
 * Stub for node-telegram-bot-api
 * Temporary replacement to avoid "Illegal instruction" crash on old CPUs
 */

export default class TelegramBot {
    constructor(token: string, options?: any) {
        console.log('[TelegramBot Stub] Initialized (disabled)');
    }

    on(event: string, callback: Function) {
        // No-op
    }

    onText(regexp: RegExp, callback: Function) {
        // No-op
    }

    sendMessage(chatId: string | number, text: string, options?: any): Promise<any> {
        console.log('[TelegramBot Stub] sendMessage disabled');
        return Promise.resolve({ message_id: 0, text });
    }

    sendPhoto(chatId: string | number, photo: any, options?: any): Promise<any> {
        console.log('[TelegramBot Stub] sendPhoto disabled');
        return Promise.resolve({ message_id: 0 });
    }

    answerCallbackQuery(queryId: string, options?: any): Promise<boolean> {
        return Promise.resolve(true);
    }

    setWebHook(url: string): Promise<boolean> {
        return Promise.resolve(true);
    }

    deleteWebHook(): Promise<boolean> {
        return Promise.resolve(true);
    }

    getMe(): Promise<any> {
        return Promise.resolve({
            id: 0,
            is_bot: true,
            first_name: 'Stub Bot',
            username: 'stub_bot'
        });
    }
}

// Export as module
module.exports = TelegramBot;
