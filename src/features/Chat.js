import { BaseFeature } from './BaseFeature.js';

export class Chat extends BaseFeature {
    constructor(botClient) {
        super(botClient);
        this.webhookUrl = botClient.config.webhookUrl;
    }

    async send(message) {
        if (!message) return;
        try {
            if (this.botClient.bot && typeof this.botClient.bot.chat === 'function') {
                this.botClient.bot.chat(message);
            } else {
                this.botClient.log('Chat failed: Bot not connected', 'warning');
            }
        } catch (err) {
            this.botClient.log(`Failed to send chat: ${err.message}`, 'error');
        }
    }
}