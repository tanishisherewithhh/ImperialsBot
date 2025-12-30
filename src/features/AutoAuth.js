import { BaseFeature } from './BaseFeature.js';

export class AutoAuth extends BaseFeature {
    init() {
        this.enabled = this.botClient.config.autoAuth !== false;

        this.botClient.bot.on('spawn', () => {
            if (this.enabled) this.handleAuth();
        });

        this.botClient.bot.on('messagestr', (msg) => {
            if (!this.enabled) return;
            const lowerMsg = msg.toLowerCase();
            if (lowerMsg.includes('/register') || lowerMsg.includes('/login')) {
                this.handleAuth();
            }
        });
    }

    enable() {
        this.enabled = true;
        this.botClient.log('AutoAuth enabled', 'success');
        if (this.botClient.bot && this.botClient.bot.entity) {
            this.handleAuth();
        }
    }

    disable() {
        this.enabled = false;
        this.botClient.log('AutoAuth disabled', 'warning');
    }

    async handleAuth() {
        if (!this.enabled) return;

        const password = this.botClient.config.password;
        if (!password) return;

        this.botClient.log('AutoAuth: Attempting authentication...', 'info');

        const registerCmd = this.botClient.config.registerConfirm !== false
            ? `/register ${password} ${password}`
            : `/register ${password}`;

        try {
            if (typeof this.botClient.bot.chat === 'function') {
                this.botClient.bot.chat(registerCmd);
                await new Promise(resolve => setTimeout(resolve, 1200));
                this.botClient.bot.chat(`/login ${password}`);
            } else {
                this.botClient.log('AutoAuth: chat function missing', 'error');
            }
        } catch (err) {
            this.botClient.log(`AutoAuth Error: ${err.message}`, 'error');
        }
    }
}
