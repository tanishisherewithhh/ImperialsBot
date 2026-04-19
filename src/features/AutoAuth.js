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
            if (lowerMsg.includes('/register') || lowerMsg.includes('register') || 
                lowerMsg.includes('/login') || lowerMsg.includes('login with')) {
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
        if (this.lastAuth && now - this.lastAuth < 2000) return;
        this.lastAuth = now;

        if (!this.enabled) return;
        if (!this.botClient.bot || !this.botClient.bot._client) return;

        const password = this.botClient.config.password;
        if (!password) return;

        this.botClient.log('AutoAuth: Attempting authentication...', 'info');

        try {
            // Small delay to ensure server ready
            await new Promise(resolve => setTimeout(resolve, 1000));
            const settings = await ConfigLoader.loadSettings() || {};
            let registerCmdStr = settings.autoAuthRegister || '/register {password} {password}';
            let loginCmdStr = settings.autoAuthLogin || '/login {password}';

            const registerCmd = registerCmdStr.replace(/{password}/g, password);
            const loginCmd = loginCmdStr.replace(/{password}/g, password);

            const safeChat = (cmd) => {
                const tryChat = (attempts = 0) => {
                    try {
                        if (this.botClient.bot && this.botClient.bot.chat) {
                            this.botClient.bot.chat(cmd);
                        }
                    } catch (e) {
                        if (attempts < 3) setTimeout(() => tryChat(attempts + 1), 2000);
                        else this.botClient.log(`Auth failed for: ${cmd}`, 'error');
                    }
                };
                tryChat();
            };

            safeChat(registerCmd);
            await new Promise(resolve => setTimeout(resolve, 1200));
            safeChat(loginCmd);

            // Signal completion
            setTimeout(() => {
                this.botClient.emit('authCompleted');
            }, 1000);
        } catch (err) {
            this.botClient.log(`AutoAuth Error: ${err.message}`, 'error');
        }
    }
}
