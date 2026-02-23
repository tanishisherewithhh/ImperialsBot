import { BaseFeature } from './BaseFeature.js';

export class Discord extends BaseFeature {
    constructor(botClient) {
        super(botClient);
        this.webhookUrl = null;
        this.queue = [];
        this.processing = false;


        setInterval(() => this.processQueue(), 1200);
    }

    init() {
        this.webhookUrl = this.botClient.config.webhookUrl;
        if (this.webhookUrl) this.sendEmbed('info', 'System', 'Bot Initialized');

        if (this.botClient.bot) {
            this.botClient.bot.on('spawn', () => {
                if (this.webhookUrl) this.sendEmbed('spawn', 'Status', 'Spawned Successfully');
            });

            this.botClient.bot.on('end', () => {
                if (this.webhookUrl) this.sendEmbed('kick', 'Status', 'Disconnected');
            });

            this.botClient.bot.on('death', () => {
                if (this.webhookUrl) this.sendEmbed('death', 'Status', 'Died');
            });

            this.botClient.bot.on('kicked', (reason) => {
                const reasonStr = typeof reason === 'object' ? JSON.stringify(reason) : reason;
                if (this.webhookUrl) this.sendEmbed('kick', 'Kicked', reasonStr);
            });

            this.botClient.bot.on('error', (err) => {
                if (this.webhookUrl) this.sendEmbed('kick', 'Error', err.message);
            });
        }

        this.chatListener = (data) => {
            if (this.webhookUrl) {
                if (this.isSensitive(data.message)) return;
                this.sendEmbed('chat', data.username, data.message);
            }
        };
        this.botClient.on('chat', this.chatListener);
    }

    isSensitive(msg) {
        if (!msg) return false;
        const lower = msg.toLowerCase();
        if (lower.startsWith('/login') || lower.startsWith('/register') || lower.startsWith('/changepassword')) return true;
        return false;
    }

    processQueue() {
        if (this.queue.length === 0) return;
        const payload = this.queue.shift();
        this.postToWebhook(payload);
    }

    sendWebhookMessage(content) {

        this.sendEmbed('info', 'System', content);
    }

    sendEmbed(type, title, description) {
        if (!this.webhookUrl) return;

        let color = 0x5865F2;
        let prefix = '';

        switch (type) {
            case 'spawn': color = 0x57F287; break;
            case 'death': color = 0xED4245; break;
            case 'kick': color = 0xFEE75C; break;
            case 'chat': color = 0xFFFFFF; break;
            case 'info': color = 0x3498db; break;
        }

        const embed = {
            description: `**${title}**: ${description}`,
            color: color,
            footer: {
                text: new Date().toLocaleTimeString()
            }
        };


        this.queue.push({
            username: `${this.botClient.username} (${this.botClient.config.host}) ImperialsBot`,
            embeds: [embed]
        });
    }

    async postToWebhook(payload) {
        try {
            await fetch(this.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (err) {

        }
    }

    dispose() {
        if (this.chatListener) {
            this.botClient.removeListener('chat', this.chatListener);
        }
    }
}
