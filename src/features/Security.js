import { BaseFeature } from './BaseFeature.js';

export class Security extends BaseFeature {
    init() {
        this.botClient.bot.on('entitySpawn', (entity) => {
            if (entity.type === 'player' && entity.username !== this.botClient.username) {

                const discordFeature = this.botClient.featureManager.getFeature('discord');
                if (discordFeature) {
                    discordFeature.sendWebhookMessage(`⚠️ Security Alert: Player **${entity.username}** entered render distance!`);
                }

                this.botClient.log(`Security Alert: Player ${entity.username} detected!`, 'warning');
            }
        });
    }
}
