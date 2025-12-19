import { BaseFeature } from './BaseFeature.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const autoEat = require('mineflayer-auto-eat');

export class AutoEat extends BaseFeature {
    init() {
        this.botClient.bot.loadPlugin(autoEat.loader || autoEat);

        this.botClient.bot.once('spawn', () => {
            if (this.botClient.bot.autoEat) {
                this.botClient.bot.autoEat.options = {
                    priority: 'foodPoints',
                    startAt: 14,
                    bannedFood: []
                };
            } else {
                this.botClient.log('AutoEat plugin failed to load', 'error');
            }
        });
    }
}
