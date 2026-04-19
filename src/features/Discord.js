import { BaseFeature } from './BaseFeature.js';

export class Discord extends BaseFeature {
    constructor(botClient) {
        super(botClient);
        this.webhookUrl = null;
        this.botToken = null;
        this.channelId = null;
        this.queue = [];
        this.processing = false;
        setInterval(() => this.processQueue(), 1200);
    }

    init() {
        const mode = this.botClient.config.discordIntegrationMode || 'none';

        if (mode === 'webhook') {
            this.webhookUrl = this.botClient.config.webhookUrl;
            this.botToken = null;
            this.channelId = null;
        } else if (mode === 'bot') {
            this.webhookUrl = null;
            this.botToken = this.botClient.config.discordBotToken;
            this.channelId = this.botClient.config.discordChannelId;
        } else {
            this.webhookUrl = null;
            this.botToken = null;
            this.channelId = null;
        }

        if (this.webhookUrl || (this.botToken && this.channelId)) {
            this.sendEmbed('info', 'System', 'Bot Initialized');
        }

        if (this.botClient.bot) {
            this.botClient.bot.on('spawn', () => {
                this.sendEmbed('spawn', 'Status', 'Spawned Successfully');
            });

            this.botClient.bot.on('death', () => {
                this.sendEmbed('death', 'Status', 'Died');
            });

            this.botClient.bot.on('kicked', (reason) => {
                const reasonStr = this.botClient.parseReason(reason);
                this.sendEmbed('kick', `${this.botClient.username} was kicked!`, `**Reason:**\n${reasonStr}`);
            });

            this.botClient.bot.on('error', (err) => {
                this.sendEmbed('kick', 'Error', err.message);
            });
        }

        this.chatListener = (data) => {
            if (this.isSensitive(data.message)) return;
            const senderName = data.sender === '[Server]' ? 'Server Status' : (data.sender || 'Unknown');
            this.sendEmbed('chat', senderName, data.raw || data.message);
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
        if (this.queue.length === 0 || this.processing) return;
        this.processing = true;

        const mode = this.botClient.config.discordIntegrationMode || 'none';
        const payload = this.queue.shift();

        if (mode === 'bot' && this.botToken && this.channelId) {
            this.sendToBot(payload).finally(() => { this.processing = false; });
        } else if (mode === 'webhook' && this.webhookUrl) {
            this.postToWebhook(payload).finally(() => { this.processing = false; });
        } else {
            this.processing = false;
        }
    }

    sendWebhookMessage(content) {
        this.sendEmbed('info', 'System', content);
    }

    stripAnsi(str) {
        if (typeof str !== 'string') return str;
        return str.replace(/\x1b\[[0-9;]*m/g, '').trim();
    }

    sendEmbed(type, title, description) {
        if (!this.webhookUrl && !(this.botToken && this.channelId)) return;

        let color = 0x5865F2;

        switch (type) {
            case 'spawn': color = 0x57F287; break;
            case 'death': color = 0xED4245; break;
            case 'kick': color = 0xFEE75C; break;
            case 'chat': color = 0xFFFFFF; break;
            case 'info': color = 0x3498db; break;
            case 'verification': color = 0xFFA500; break;
        }

        const embed = {
            title: `${this.stripAnsi(title)}`,
            description: this.stripAnsi(description),
            color: color,
            footer: {
                text: `ImperialsBot`
            },
            timestamp: new Date().toISOString()
        };

        this.queue.push({
            content: null,
            embeds: [embed]
        });
    }

    async sendToBot(payload) {
        try {
            await fetch(`https://discord.com/api/v10/channels/${this.channelId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bot ${this.botToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        } catch (err) { }
    }

    async postToWebhook(payload) {
        try {
            const webhookPayload = {
                username: `${this.botClient.username} (ImperialsBot)`,
                avatar_url: `https://minotar.net/avatar/${this.botClient.username}/64`,
                ...payload
            };
            await fetch(this.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookPayload)
            });
        } catch (err) { }
    }

    dispose() {
        if (this.chatListener) {
            this.botClient.removeListener('chat', this.chatListener);
        }
    }
}
