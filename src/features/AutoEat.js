import { BaseFeature } from './BaseFeature.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const autoEat = require('mineflayer-auto-eat');

export class AutoEat extends BaseFeature {
    init() {
        this.enabled = this.botClient.config.autoEat || false;
        const bot = this.botClient.bot;

        const load = () => {
            try {
                if (!bot.autoEat) {
                    bot.loadPlugin(autoEat.loader || autoEat);
                }
                
                if (bot.autoEat) {
                    bot.autoEat.options = {
                        priority: 'foodPoints',
                        startAt: 14,
                        bannedFood: []
                    };
                    // Restore enabled state from config
                    if (this.enabled) {
                        bot.autoEat.enableAuto();
                    }
                }
            } catch (err) {
                this.botClient.log(`AutoEat plugin failed to load: ${err.message}`, 'error');
            }
        };

        if (bot.entity) load();
        else bot.once('spawn', load);
    }

    toggle(enabled) {
        this.enabled = enabled;
        const bot = this.botClient.bot;
        if (bot && bot.autoEat) {
            if (enabled) {
                bot.autoEat.enableAuto();
                this.botClient.log('AutoEat enabled.', 'success');
            } else {
                bot.autoEat.disableAuto();
                this.botClient.log('AutoEat disabled.', 'info');
            }
        }
    }

    enable() {
        this.toggle(true);
    }

    disable() {
        this.toggle(false);
    }
}
