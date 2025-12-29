/**
 * ExamplePlugin.js
 * 
 * This is a template for creating your own plugins for ImperialBot.
 * Use this as a reference for handling events, logging, and controlling the bot.
 */
export default class ExamplePlugin {
    constructor() {
        // Plugin metadata
        this.name = 'ExamplePlugin';
        this.description = 'A guide plugin for beginners';
        this.enabled = false;

        // Internal state
        this.bot = null; // The Mineflayer bot instance
        this.api = null; // ImperialBot API for logging and communication
    }

    /**
     * Called when the plugin is first loaded.
     * Use this to setup initial listeners or references.
     */
    init(bot, api) {
        this.bot = bot;
        this.api = api;

        this.api.log(`[${this.name}] initialized!`, 'info');

        // Example: Listen for chat messages
        this.bot.on('chat', (username, message) => {
            if (!this.enabled) return;
            if (username === this.bot.username) return; // Don't respond to self

            if (message.toLowerCase() === '!hello') {
                this.bot.chat(`Hello ${username}! I am running ImperialBot.`);
            }
        });
    }

    /**
     * Called when the user enables the plugin via the UI.
     */
    enable() {
        this.enabled = true;
        this.api.log(`[${this.name}] module enabled. Type !hello in game chat!`, 'success');

        // Example: Perform a simple action
        if (this.bot && this.bot.entity) {
            this.bot.chat('ExamplePlugin is now active.');
        }
    }

    /**
     * Called when the user disables the plugin via the UI.
     */
    disable() {
        this.enabled = false;
        this.api.log(`[${this.name}] module disabled.`, 'warning');
    }

    /**
     * Called every physics tick (20 times per second) if the bot is spawned.
     * Note: Use carefully to avoid performance issues.
     */
    onTick() {
        if (!this.enabled) return;

        // You can put constant checks or movements here
        // Example: Look at the nearest player (commented out to avoid spinning)
        /*
        const player = this.bot.nearestEntity(e => e.type === 'player');
        if (player) {
            this.bot.lookAt(player.position.offset(0, player.height, 0));
        }
        */
    }
}
