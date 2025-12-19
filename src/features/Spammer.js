import { BaseFeature } from './BaseFeature.js';

export class Spammer extends BaseFeature {
    constructor(botClient) {
        super(botClient);
        this.intervalId = null;
        this.config = {
            enabled: false,
            delay: 3000,
            messages: ['ImperialsBot on top!'],
            order: 'random',
            appendRandom: false,
            randomLength: 5,
            ...botClient.config.spammer // Load saved config
        };
        this.currentIndex = 0;
    }

    init() {
        this.botClient.log('Spammer initialized', 'success');
    }

    start() {
        if (this.intervalId) clearInterval(this.intervalId);

        if (!this.botClient.bot || !this.botClient.bot.entity) {
            this.botClient.log('Spammer waiting for spawn...', 'warning');
            this.botClient.bot.once('spawn', () => {
                if (this.config.enabled) this.start();
            });
            return;
        }

        this.config.enabled = true;
        this.botClient.log(`Spammer started (Delay: ${this.config.delay}ms)`, 'success');

        this.intervalId = setInterval(() => {
            this.spam();
        }, this.config.delay);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.config.enabled = false;
        this.botClient.log('Spammer stopped', 'warning');
    }

    setConfig(config) {
        this.config = { ...this.config, ...config };
        if (typeof this.config.messages === 'string') {
            this.config.messages = this.config.messages.split('\n').filter(m => m.trim().length > 0);
        }

        if (this.config.enabled) {
            this.start();
        }
    }

    spam() {
        if (!this.config.enabled) return;

        if (!this.botClient.bot) {
            this.botClient.log('Spammer stopped: Bot not initialized', 'warning');
            this.stop();
            return;
        }

        if (!this.botClient.bot.entity) {
            return;
        }

        if (!this.botClient.bot._client || !this.botClient.bot._client.socket) {
            this.botClient.log('Spammer stopped: Bot disconnected', 'warning');
            this.stop();
            return;
        }

        let msg = '';
        if (this.config.order === 'sequential') {
            msg = this.config.messages[this.currentIndex % this.config.messages.length];
            this.currentIndex++;
        } else {
            msg = this.config.messages[Math.floor(Math.random() * this.config.messages.length)];
        }

        if (this.config.appendRandom) {
            const randomStr = this.generateRandomString(this.config.randomLength);
            msg += ` ${randomStr}`;
        }

        try {
            this.botClient.bot.chat(msg);
        } catch (err) {
            this.botClient.log(`Spammer error: ${err.message}`, 'error');
            this.stop();
        }
    }

    generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}
