import { BaseFeature } from './BaseFeature.js';
import { botManager } from '../core/BotManager.js';

export class Swarm extends BaseFeature {
    constructor(botClient) {
        super(botClient);
        this.role = 'none'; // 'none', 'leader', 'follower'
        this.leaderName = null;
        this.followInterval = null;
    }

    init() {
        this.botClient.bot.on('end', () => {
            if (this.role !== 'none') {
                this.setRole('none');
            }
        });
    }

    setRole(role, leaderName = null) {
        this.role = role;
        this.leaderName = leaderName;

        if (this.followInterval) {
            clearInterval(this.followInterval);
            this.followInterval = null;
        }

        if (this.role === 'follower' && this.leaderName) {
            this.startFollowing();
            this.botClient.log(`Swarm: Now following ${this.leaderName}`, 'info');
        } else if (this.role === 'leader') {
            this.botClient.log('Swarm: Designated as Leader', 'success');
        } else {
            this.botClient.log('Swarm: Detached from swarm', 'info');
            const nav = this.botClient.featureManager.getFeature('navigation');
            if (nav) nav.stop();
        }
        
        this.botClient.emit('swarmUpdate', {
            username: this.botClient.username,
            role: this.role,
            leaderName: this.leaderName
        });
    }

    startFollowing() {
        this.followInterval = setInterval(() => {
            if (!this.botClient.bot || !this.botClient.bot.entity) return;
            
            const leaderClient = botManager.getBot(this.leaderName);
            if (!leaderClient || !leaderClient.bot || !leaderClient.bot.entity) return;

            const leaderPos = leaderClient.bot.entity.position;
            const myPos = this.botClient.bot.entity.position;

            if (leaderPos.distanceTo(myPos) > 3) {
                const nav = this.botClient.featureManager.getFeature('navigation');
                if (nav) {
                    nav.moveTo(leaderPos.x, leaderPos.y, leaderPos.z);
                }
            }
        }, 1000);
    }
}
