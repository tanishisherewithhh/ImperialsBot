import { BaseFeature } from './BaseFeature.js';

export class Chat extends BaseFeature {
    constructor(botClient) {
        super(botClient);
        this.webhookUrl = botClient.config.webhookUrl;
    }

    async send(message) {
        if (!message) return;
        try {
            this.bot.chat(message);
            // Log outgoing message to UI immediately (will be deduplicated if echoed)
            this.botClient.emitChat(this.botClient.username, message, 'chat');
        } catch (err) {
            this.botClient.log(`Failed to send chat: ${err.message}`, 'error');
        }
    }
}