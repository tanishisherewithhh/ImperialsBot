import { BaseFeature } from './BaseFeature.js';

export class Watchlist extends BaseFeature {
    constructor(botClient) {
        super(botClient);
        this.watchedPlayers = new Set();
    }

    init() {
        if (!this.botClient.bot) return;

        this.botClient.bot.on('playerJoined', (player) => {
            if (this.watchedPlayers.has(player.username)) {
                this.alert('join', player.username);
            }
        });

        this.botClient.bot.on('playerLeft', (player) => {
            if (this.watchedPlayers.has(player.username)) {
                this.alert('leave', player.username);
            }
        });
    }

    updateWatchlist(list) {
        this.watchedPlayers = new Set(list.map(name => name.toLowerCase()));
    }

    alert(type, username) {
        const action = type === 'join' ? 'joined' : 'left';
        const msg = `[Watchlist] ${username} has ${action} the server!`;

        // Log to dashboard
        this.botClient.log(msg, type === 'join' ? 'success' : 'warning');

        // Emit to dashboard for toast/ui notification
        this.botClient.emit('watchlistAlert', {
            type,
            username,
            message: msg,
            bot: this.botClient.username
        });

        // Send to Discord if enabled
        const discord = this.botClient.featureManager.getFeature('discord');
        if (discord) {
            const icon = type === 'join' ? '🔔' : '🔕';
            discord.sendEmbed('info', `${icon} Player Watchlist`, msg);
        }
    }
}
