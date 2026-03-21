import { BaseFeature } from './BaseFeature.js';
import { createRequire } from 'module';
import { botManager } from '../core/BotManager.js';
const require = createRequire(import.meta.url);
const { plugin: pvp } = require('mineflayer-pvp');

const HOSTILE_MOBS = new Set([
    'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider', 'enderman',
    'witch', 'slime', 'phantom', 'drowned', 'husk', 'stray', 'blaze',
    'ghast', 'magma_cube', 'wither_skeleton', 'piglin_brute', 'vindicator',
    'evoker', 'ravager', 'pillager', 'vex', 'hoglin', 'zoglin', 'warden',
    'guardian', 'elder_guardian', 'shulker', 'silverfish', 'endermite',
    'breeze', 'bogged'
]);

export class Combat extends BaseFeature {
    constructor(botClient) {
        super(botClient);
        this.killauraEnabled = false;
        this.killauraConfig = {
            attackRange: 4,
            followRange: 6,
            viewDistance: 16,
            attackPlayers: true,
            attackHostileMobs: true,
            attackPassiveMobs: false
        };
    }

    init() {
        this.botClient.bot.loadPlugin(pvp);

        this.botClient.bot.on('physicsTick', () => {
            if (this.killauraEnabled) {
                this.killauraLoop();
            }
        });
    }

    applyPvpConfig() {
        const bot = this.botClient.bot;
        if (!bot || !bot.pvp) return;
        bot.pvp.attackRange = this.killauraConfig.attackRange;
        bot.pvp.followRange = this.killauraConfig.followRange;
        bot.pvp.viewDistance = this.killauraConfig.viewDistance;
    }

    updateConfig(config) {
        this.killauraConfig = { ...this.killauraConfig, ...config };
        if (typeof this.killauraConfig.attackRange === 'string') this.killauraConfig.attackRange = parseFloat(this.killauraConfig.attackRange) || 4;
        if (typeof this.killauraConfig.followRange === 'string') this.killauraConfig.followRange = parseFloat(this.killauraConfig.followRange) || 6;
        if (typeof this.killauraConfig.viewDistance === 'string') this.killauraConfig.viewDistance = parseFloat(this.killauraConfig.viewDistance) || 16;
        this.applyPvpConfig();
        this.botClient.log(`Killaura config updated`, 'info');
    }

    getConfig() {
        return { ...this.killauraConfig };
    }

    matchesFilter(entity) {
        if (!entity || entity === this.botClient.bot.entity) return false;
        if (entity.type === 'player') {
            const name = entity.username || '';
            if (botManager.getBot(name) || botManager.globalFriends.includes(name)) return false;
            if (this.killauraConfig.attackPlayers) return true;
        }
        if (entity.type === 'mob') {
            const name = entity.name || '';
            if (HOSTILE_MOBS.has(name) && this.killauraConfig.attackHostileMobs) return true;
            if (!HOSTILE_MOBS.has(name) && this.killauraConfig.attackPassiveMobs) return true;
        }
        return false;
    }

    killauraLoop() {
        if (!this.botClient.bot || !this.botClient.bot.entity) return;

        const entity = this.botClient.bot.nearestEntity(e =>
            this.matchesFilter(e) &&
            e.position.distanceTo(this.botClient.bot.entity.position) < this.killauraConfig.attackRange
        );

        if (entity) {
            this.botClient.bot.pvp.attack(entity);
        } else if (this.botClient.bot.pvp && this.botClient.bot.pvp.target) {
            this.botClient.bot.pvp.stop();
        }
    }

    toggleKillaura(enabled) {
        this.killauraEnabled = enabled;
        if (enabled) {
            this.applyPvpConfig();
            this.botClient.log('Killaura enabled', 'success');
        } else {
            this.botClient.log('Killaura disabled', 'warning');
            if (this.botClient.bot && this.botClient.bot.pvp) {
                this.botClient.bot.pvp.stop();
            }
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
            maxDistance: 64
        });
        if (lava) {
            const pathfinder = this.botClient.featureManager.getFeature('navigation');
            if (pathfinder) {
                this.botClient.log('Walking to lava...', 'info');
                pathfinder.moveTo(lava.position.x, lava.position.y, lava.position.z);
                return;
            }
        }

        bot.chat('/kill');
        this.botClient.log('Used /kill command', 'info');
    }
}
