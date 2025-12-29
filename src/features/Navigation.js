import { BaseFeature } from './BaseFeature.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
import minecraftData from 'minecraft-data';

export class Navigation extends BaseFeature {
    init() {
        this.botClient.bot.loadPlugin(pathfinder);
        const mcData = minecraftData(this.botClient.bot.version);
        this.movements = new Movements(this.botClient.bot, mcData);

        if (this.botClient.bot.pathfinder) {
            this.botClient.bot.pathfinder.setMovements(this.movements);
        } else {
            this.botClient.bot.once('spawn', () => {
                if (this.botClient.bot.pathfinder) {
                    this.botClient.bot.pathfinder.setMovements(this.movements);
                }
            });
        }
    }

    moveTo(x, y, z) {
        if (!this.botClient.bot.pathfinder) {
            this.botClient.log('Pathfinder not loaded/ready', 'error');
            return;
        }

        const goal = new goals.GoalBlock(x, y, z);
        this.botClient.bot.pathfinder.setGoal(goal);
        this.botClient.updateStatus(`Moving to ${x},${y},${z}`);
        this.botClient.log(`Starting navigation to ${x}, ${y}, ${z}`);

        // Track progress
        if (this.navInterval) clearInterval(this.navInterval);

        this.navInterval = setInterval(() => {
            if (!this.botClient.bot || !this.botClient.bot.entity) {
                this.stop();
                return;
            }
            const pos = this.botClient.bot.entity.position;
            const dist = Math.sqrt(
                Math.pow(x - pos.x, 2) +
                Math.pow(y - pos.y, 2) +
                Math.pow(z - pos.z, 2)
            ).toFixed(1);

            this.botClient.updateStatus(`Moving to ${x},${y},${z} (Dist: ${dist})`);

            if (dist < 2) {
                // Let pathfinder finish naturally
            }
        }, 1000);

        this.botClient.bot.once('goal_reached', () => {
            clearInterval(this.navInterval);
            this.botClient.updateStatus('Arrived');
            this.botClient.log(`Arrived at ${x}, ${y}, ${z}`, 'success');
        });
    }

    stop() {
        if (this.navInterval) clearInterval(this.navInterval);

        if (this.botClient.bot.pathfinder) {
            this.botClient.bot.pathfinder.setGoal(null);
            this.botClient.updateStatus('Navigation Stopped');
            this.botClient.log('Navigation stopped manually', 'warning');
        }
    }

    follow(target) {
        const goal = new goals.GoalFollow(target, 1);
        this.botClient.bot.pathfinder.setGoal(goal, true);
    }
}
