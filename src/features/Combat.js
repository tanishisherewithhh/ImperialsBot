import { BaseFeature } from './BaseFeature.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { plugin: pvp } = require('mineflayer-pvp');

export class Combat extends BaseFeature {
    constructor(botClient) {
        super(botClient);
        this.killauraEnabled = false;
        this.killauraRange = 6;
    }

    init() {
        this.botClient.bot.loadPlugin(pvp);

        this.botClient.bot.on('physicsTick', () => {
            if (this.killauraEnabled) {
                this.killauraLoop();
            }
        });
    }

    killauraLoop() {
        // Safety check to prevent crashing/kicks during world switches or if bot is dead
        if (!this.botClient.bot || !this.botClient.bot.entity) return;

        const filter = e => e.type === 'mob' || e.type === 'player';
        const entity = this.botClient.bot.nearestEntity(e =>
            filter(e) && e.position.distanceTo(this.botClient.bot.entity.position) < this.killauraRange
        );

        if (entity) {
            this.botClient.bot.pvp.attack(entity);
        }
    }

    toggleKillaura(enabled) {
        this.killauraEnabled = enabled;
        if (enabled) {
            this.botClient.log('Killaura enabled', 'success');
        } else {
            this.botClient.log('Killaura disabled', 'warning');
            this.botClient.bot.pvp.stop();
        }
    }

    async suicide() {
        const bot = this.botClient.bot;
        if (!bot) return;

        this.botClient.log('Attempting suicide...', 'warning');

        const flint = bot.inventory.items().find(item => item.name === 'flint_and_steel');
        if (flint) {
            try {
                await bot.equip(flint, 'hand');
                await bot.lookAt(bot.entity.position.offset(0, -1, 0));
                await bot.activateItem();
                this.botClient.log('Used Flint and Steel', 'success');
                return;
            } catch (e) {
                this.botClient.log(`Flint and Steel failed: ${e.message}`, 'error');
            }
        }

        const lava = bot.findBlock({
            matching: block => block.name === 'lava',
            maxDistance: 32
        });
        if (lava) {
            const pathfinder = this.botClient.featureManager.getFeature('navigation');
            if (pathfinder) {
                this.botClient.log('Walking to lava...', 'info');
                pathfinder.moveTo(lava.position);
                return;
            }
        }

        bot.chat('/kill');
        this.botClient.log('Used /kill command', 'info');
    }
}
