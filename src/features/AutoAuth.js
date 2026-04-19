import { BaseFeature } from './BaseFeature.js';
import { ConfigLoader } from '../config/ConfigLoader.js';

export class AutoAuth extends BaseFeature {
    init() {
        this.enabled = this.botClient.config.autoAuth === true;

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
            // Wait a moment for bot core to fully initialize state
            await new Promise(resolve => setTimeout(resolve, 1500));

            const settings = await ConfigLoader.loadSettings() || {};
            let registerCmdStr = settings.autoAuthRegister || '/register {password} {password}';
            let loginCmdStr = settings.autoAuthLogin || '/login {password}';

            const registerCmd = registerCmdStr.replace(/{password}/g, password);
            const loginCmd = loginCmdStr.replace(/{password}/g, password);

            const safeChat = (cmd) => {
                try {
                    this.botClient.bot.chat(cmd);
                } catch (e) {
                    this.botClient.log(`Standard chat failed, using fallback for: ${cmd}`, 'warning');
                    try {
                        if (this.botClient.bot.supportFeature && this.botClient.bot.supportFeature('chatCommands')) {
                            this.botClient.bot._client.write('chat_command', {
                                command: cmd.substring(1),
                                timestamp: BigInt(Date.now()),
                                salt: 0n,
                                argumentSignatures: [],
                                signedPreview: false,
                                messageCount: 0,
                                acknowledged: Buffer.alloc(3),
                                previousMessages: []
                            });
                        } else {
                            this.botClient.bot._client.write('chat', { message: cmd });
                        }
                    } catch (e2) {
                        this.botClient.log(`Fallback chat failed: ${e2.message}`, 'error');
                    }
                }
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
