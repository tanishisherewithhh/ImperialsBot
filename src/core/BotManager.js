import { EventEmitter } from 'events';
import { BotClient } from './BotClient.js';
import { ConfigLoader } from '../config/ConfigLoader.js';

class BotManager extends EventEmitter {
    constructor() {
        super();
        this.bots = new Map();
    }

    async createBot(config, save = true) {
        if (this.bots.has(config.username)) {
            throw new Error(`Bot ${config.username} already exists`);
        }

        if (save) await ConfigLoader.addBotConfig(config);

        const bot = new BotClient(config);
        this.bots.set(config.username, bot);
        this.emit('botCreated', config.username);

        bot.on('spawn', () => this.emit('botSpawn', config.username));
        bot.on('error', (err) => console.error(`Bot ${config.username} error:`, err.message));
        bot.on('end', () => this.emit('botEnd', config.username));

        bot.on('error', (err) => {
            this.emit('botError', { username: config.username, error: err });
        });

        bot.on('log', (data) => {
            this.emit('botLog', { username: config.username, message: data.message, type: data.type });
        });

        bot.on('dataUpdate', (data) => {
            this.emit('botData', { username: config.username, data });
        });

        bot.on('inventoryUpdate', (items) => {
            this.emit('botInventory', { username: config.username, items });
        });

        bot.on('playerList', (players) => {
            this.emit('botPlayers', { username: config.username, players });
        });

        bot.on('chat', (data) => {
            this.emit('botChat', { username: config.username, ...data });
        });

        bot.on('status', (payload) => {
            this.emit('botStatus', { username: config.username, ...payload });
        });

        bot.on('dataUpdate', (data) => {
            this.emit('botData', { username: config.username, data });
        });

        bot.on('inventoryUpdate', (data) => {
            this.emit('botInventory', { username: config.username, data });
        });

        bot.on('playerList', (players) => {
            this.emit('botPlayers', { username: config.username, players });
        });

        bot.on('viewerStarted', (data) => {
            this.emit('botViewer', { username: config.username, ...data });
        });

        return bot;
    }

    getBot(username) {
        return this.bots.get(username);
    }

    stopBot(username) {
        const bot = this.bots.get(username);
        if (bot) bot.stop();
    }

    async removeBot(username) {
        const bot = this.bots.get(username);
        if (bot) {
            bot.stop();
            this.bots.delete(username);
            await ConfigLoader.removeBotConfig(username);
            this.emit('botRemoved', username);
        }
    }

    async loadSavedBots() {
        const savedBots = await ConfigLoader.loadBots();
        for (const config of savedBots) {
            try {
                await this.createBot(config, false);
            } catch (err) {
                console.error(`Failed to load saved bot ${config.username}:`, err);
            }
        }
    }

    getAllBots() {
        return Array.from(this.bots.values()).map(bot => ({
            username: bot.username,
            status: bot.status,
            host: bot.config.host,
            port: bot.config.port,
            config: bot.config,
            inventoryPort: bot.inventoryPort
        }));
    }

    async updateBot(config) {
        const bot = this.bots.get(config.username);
        if (!bot) {
            throw new Error(`Bot ${config.username} not found`);
        }

        // Update config on disk
        await ConfigLoader.addBotConfig(config);

        bot.config = config;

        // If we wanted to auto-restart:
        // if (bot.status === 'Online') bot.rejoin();
    }
}

export const botManager = new BotManager();
