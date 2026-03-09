import { BaseFeature } from './BaseFeature.js';

export class ConditionalEvents extends BaseFeature {
    constructor(botClient) {
        super(botClient);
        this.config = this.botClient.config.conditionalEvents || [];
    }

    init() {
        if (!Array.isArray(this.config)) return;

        this.onChat = (data) => this.handleChat(data);
        this.onSpawn = () => this.handleEvent('spawn');
        this.onDeath = () => this.handleEvent('death');
        this.onKicked = (reason) => this.handleEvent('kicked', reason);
        this.onError = (err) => this.handleEvent('error', err.message);

        this.botClient.on('chat', this.onChat);

        this.botClient.on('spawn', this.onSpawn);

        this.botClient.on('death', this.onDeath);

        this.botClient.on('kicked', this.onKicked);

        this.botClient.on('error', this.onError);
    }

    dispose() {
        if (this.onChat) this.botClient.removeListener('chat', this.onChat);
        if (this.onSpawn) this.botClient.removeListener('spawn', this.onSpawn);
        if (this.onDeath) this.botClient.removeListener('death', this.onDeath);
        if (this.onKicked) this.botClient.removeListener('kicked', this.onKicked);
        if (this.onError) this.botClient.removeListener('error', this.onError);
    }

    handleChat(data) {
        const chatEvents = this.config.filter(e => e.type === 'chat');
        for (const event of chatEvents) {
            try {
                const regex = new RegExp(event.pattern);
                const match = data.message.match(regex);
                if (match) {
                    let msg = event.message || 'Chat pattern matched';
                    // Replace $1, $2, etc.
                    for (let i = 0; i < match.length; i++) {
                        msg = msg.replace(`$${i}`, match[i]);
                    }
                    this.fireWebhook(event.webhookUrl, msg);
                }
            } catch (err) {
                console.error('Error processing conditional event regex:', err);
            }
        }
    }

    handleEvent(eventType, payload = '') {
        const events = this.config.filter(e => e.type === eventType);
        for (const event of events) {
            let msg = event.message || `Event ${eventType} triggered`;
            if (payload) {
                msg += `\nPayload: ${payload}`;
            }
            this.fireWebhook(event.webhookUrl, msg);
        }
    }

    async fireWebhook(url, content) {
        if (!url) return;
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            this.botClient.log(`Conditional Webhook fired for ${url}`, 'success');
        } catch (err) {
            this.botClient.log(`Failed to fire webhook: ${err.message}`, 'error');
        }
    }
}
