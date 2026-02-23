import { BaseFeature } from './BaseFeature.js';

export class Security extends BaseFeature {
    init() {
        this.botClient.bot.on('entitySpawn', (entity) => {
            if (entity.type === 'player' && entity.username !== this.botClient.username) {
                const bot = this.botClient.bot;
                const username = entity.username;


                const isRealPlayer = bot.players[username] !== undefined;
                const hasValidUUID = entity.uuid && /^[0-9a-f-]{36}$/i.test(entity.uuid);


                const hasStandardName = /^[a-zA-Z0-9_]{3,16}$/.test(username);

                if (!isRealPlayer || !hasValidUUID || !hasStandardName) {


                    this.botClient.log(`[Anti-Bot] Entity ${username} (NPC/Bot) detected at ${Math.floor(entity.position.x)}, ${Math.floor(entity.position.y)}, ${Math.floor(entity.position.z)}`, 'debug');
                    return;
                }


                const pos = entity.position;
                const posStr = `\x1b[3m\x1b[90mat (${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)})\x1b[0m`;



                const securityMsg = `\x1b[1;31mSecurity Alert: \x1b[1;33m${username} \x1b[0m\x1b[1;31mdetected!\x1b[0m ${posStr}`;

                const discordFeature = this.botClient.featureManager.getFeature('discord');
                if (discordFeature) {
                    discordFeature.sendWebhookMessage(`⚠️ Security Alert: Player **${username}** entered render distance at (${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)})`);
                }

                this.botClient.log(securityMsg, 'warning');
            }
        });
    }
}
