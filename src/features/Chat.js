import { BaseFeature } from './BaseFeature.js';

export class Chat extends BaseFeature {
    constructor(botClient) {
        super(botClient);
        this.webhookUrl = botClient.config.webhookUrl;
    }

    async send(message) {
        if (!message) return;
        try {
            console.log(`[Chat Feature] Sending: ${message}`);
            this.bot.chat(message);
            // Logging is handled by the 'chat' event listener (server echo)
        } catch (err) {
            this.botClient.log(`Failed to send chat: ${err.message}`, 'error');
        }
    }
}