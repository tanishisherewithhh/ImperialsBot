import { BaseFeature } from './BaseFeature.js';
import { ConfigLoader } from '../config/ConfigLoader.js';

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
        const now = Date.now();
        if (this.lastAuth && now - this.lastAuth < 5000) return;
        this.lastAuth = now;

        if (!this.enabled) return;
        if (!this.botClient.bot || !this.botClient.bot._client) return;

        const password = this.botClient.config.password;
        if (!password) return;

        this.botClient.log('AutoAuth: Attempting authentication...', 'info');

        try {
            const settings = await ConfigLoader.loadSettings() || {};
            let registerCmdStr = settings.autoAuthRegister || '/register {password} {password}';
            let loginCmdStr = settings.autoAuthLogin || '/login {password}';

            const registerCmd = registerCmdStr.replace(/{password}/g, password);
            const loginCmd = loginCmdStr.replace(/{password}/g, password);

            if (typeof this.botClient.bot.chat === 'function') {
                this.botClient.bot.chat(registerCmd);
                await new Promise(resolve => setTimeout(resolve, 1200));
                this.botClient.bot.chat(loginCmd);

                // Signal completion
                setTimeout(() => {
                    this.botClient.emit('authCompleted');
                }, 1000);
            } else {
                this.botClient.log('AutoAuth: chat function missing', 'error');
            }
        } catch (err) {
            this.botClient.log(`AutoAuth Error: ${err.message}`, 'error');
        }
    }
}
