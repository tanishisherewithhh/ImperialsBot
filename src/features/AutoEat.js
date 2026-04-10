import { BaseFeature } from './BaseFeature.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const autoEat = require('mineflayer-auto-eat');

export class AutoEat extends BaseFeature {
    init() {
        const bot = this.botClient.bot;

        // Load plugin only after spawn to avoid "undefined yaw" crashes
        bot.once('spawn', () => {
            try {
                bot.loadPlugin(autoEat.loader || autoEat);
                
                if (bot.autoEat) {
                    bot.autoEat.options = {
                        priority: 'foodPoints',
                        startAt: 14,
                        bannedFood: []
                    };
                    this.botClient.log('AutoEat plugin loaded and configured.', 'success');
                } else {
                    this.botClient.log('AutoEat plugin property not found after load.', 'error');
                }
            } catch (err) {
                this.botClient.log(`AutoEat plugin failed to load: ${err.message}`, 'error');
            }
        });
    }
}
