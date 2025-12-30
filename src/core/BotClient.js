import mineflayer from 'mineflayer';
import { EventEmitter } from 'events';
import { FeatureManager } from '../features/FeatureManager.js';
import { PluginManager } from './PluginManager.js';
import { ConfigLoader } from '../config/ConfigLoader.js';

export class BotClient extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.username = config.username;
        this.bot = null;
        this.featureManager = new FeatureManager(this);
        this.pluginManager = new PluginManager(this);
        this.status = 'Created';
        this.chatHistory = [];
        this.viewerPort = null;
        this.reconnectTimer = null;
        this.manuallyStopped = false;
        this.recentMessages = new Set();
    }

    extractText(obj) {
        if (!obj) return '';
        if (typeof obj === 'string') return obj;
        if (typeof obj.toString === 'function') {
            const str = obj.toString();
            if (str !== '[object Object]') return str;
        }
        return '';
    }

    emitChat(username, message, type = 'chat') {
        if (!message) return;

        // Clean up text
        message = message.trim();
        if (message.length === 0) return;

        // Deduplication Logic
        const msgKey = `${username}:${message}`;
        if (this.recentMessages.has(msgKey)) {
            return; // Skip duplicate
        }

        this.recentMessages.add(msgKey);
        setTimeout(() => this.recentMessages.delete(msgKey), 500);

        this.log(`${username}: ${message}`, type);
        this.emit('chat', { username, message, type });
        this.addToHistory(username, message, type);
    }

    parseReason(reason) {
        if (!reason) return 'Unknown reason';

        // Log raw reason for debugging
        console.log('Raw Kick Reason:', reason);

        if (typeof reason === 'string') return reason;

        const extracted = this.extractText(reason);
        if (extracted && extracted.trim().length > 0 && extracted !== '[object Object]') {
            return extracted;
        }

        try {
            return JSON.stringify(reason, null, 2);
        } catch (e) {
            return 'Unable to parse kick reason';
        }
    }

    updateStatus(status) {
        this.status = status;
        this.emit('status', { status, version: this.config.version });
    }

    log(message, type = 'info') {
        const msgStr = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;

        // Save to history
        this.chatHistory.push({ message: msgStr, type, timestamp: Date.now() });
        if (this.chatHistory.length > 100) {
            this.chatHistory.shift();
        }

        this.emit('log', { message: msgStr, type });
    }


    rejoin() {
        this.log('Manual rejoin triggered...', 'warning');
        this.manuallyStopped = false; // Reset flag
        this.stop();
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.init();
        }, 1000);
    }

    setLook(yaw, pitch) {
        if (this.bot) {
            this.bot.look(yaw, pitch);
        }
    }

    init() {
        this.manuallyStopped = false; // Ensure it's false when starting
        // Clear any pending reconnection timer if init is called manually
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // If we already have a bot instance, stop it properly first
        if (this.bot) {
            try {
                this.bot.removeAllListeners();
                this.bot.quit();
            } catch (e) {
                // Ignore errors during cleanup
            }
        }

        this.updateStatus('Connecting');
        this.bot = mineflayer.createBot({
            host: this.config.host,
            port: this.config.port,
            username: this.config.username,
            password: this.config.password,
            auth: this.config.auth || 'offline',
            version: this.config.version
        });

        this.bindEvents();
        try {
            this.featureManager.loadFeatures();
            this.pluginManager.loadPlugins();
        } catch (err) {
            console.error(`Failed to load features/plugins for ${this.username}:`, err);
            this.log(`Load error: ${err.message}`, 'error');
        }
    }

    bindEvents() {
        this.bot.on('spawn', () => {
            this.updateStatus('Online');
            this.emit('spawn');
            this.log(`${this.username} spawned`, 'success');
            this.lastSpawnTime = Date.now();

            this.pluginManager.onBotSpawn();
            if (this.bot.inventory) {
                this.bot.inventory.removeAllListeners('updateSlot');
                let invUpdateTimeout = null;
                this.bot.inventory.on('updateSlot', () => {
                    if (invUpdateTimeout) clearTimeout(invUpdateTimeout);
                    invUpdateTimeout = setTimeout(() => {
                        const inventory = this.bot.inventory.items().map(item => ({
                            slot: item.slot,
                            name: item.name,
                            displayName: item.displayName,
                            count: item.count
                        }));
                        this.emit('inventoryUpdate', inventory);
                    }, 100);
                });
            }
        });

        this.bot.on('physicsTick', () => {
            if (this.reconnectTimer) return; // Don't tick while reconnecting (safety)
            this.pluginManager.onTick();

            // Throttle updates (every 500ms)
            if (this.bot.entity) {
                const now = Date.now();
                if (now - (this.lastDataEmit || 0) > 500) {
                    this.lastDataEmit = now;
                    this.emit('dataUpdate', {
                        position: this.bot.entity.position,
                        health: this.bot.health,
                        food: this.bot.food,
                        yaw: this.bot.entity.yaw,
                        pitch: this.bot.entity.pitch
                    });
                }
            }
        });

        this.bot.on('end', async () => {
            if (this.manuallyStopped || this.reconnectTimer) return;

            const wasRecentlySpawned = (Date.now() - (this.lastSpawnTime || 0)) < 15000;

            this.updateStatus('Offline');
            this.emit('end');
            this.log(`${this.username} disconnected`, 'error');

            const isAuto = this.config.autoReconnect === true || this.config.autoReconnect === 'true';
            if (isAuto) {
                const settings = await ConfigLoader.loadSettings() || {};
                let delay = parseInt(settings.reconnectDelay) || 5000;

                // Faster reconnect for suspected server swaps (moved from lobby to game)
                if (wasRecentlySpawned) {
                    delay = 1000;
                    this.log('Suspected server transition. Reconnecting quickly...', 'info');
                }

                this.updateStatus(`Reconnecting in ${delay / 1000}s...`);

                this.reconnectTimer = setTimeout(() => {
                    this.reconnectTimer = null;
                    if (!this.manuallyStopped) this.init();
                }, delay);
            }
        });

        this.bot.on('respawn', () => {
            this.log('Dimension/World change detected.', 'info');
            this.lastSpawnTime = Date.now();
        });

        this.bot.on('kicked', (reason) => {
            const reasonStr = this.parseReason(reason);
            this.log(`Kicked: ${reasonStr}`, 'error');
            this.updateStatus('Kicked');
        });

        this.bot.on('error', (err) => {
            this.emit('error', err);
            this.updateStatus(`Error: ${err.message}`);
            this.log(`${this.username} error: ${err.message}`, 'error');
        });

        // Player Updates
        let playerUpdateTimeout = null;
        const emitPlayerList = () => {
            if (playerUpdateTimeout) clearTimeout(playerUpdateTimeout);
            playerUpdateTimeout = setTimeout(() => {
                if (!this.bot || !this.bot.players) return;

                const players = Object.values(this.bot.players).map(p => ({
                    username: p.username,
                    uuid: p.uuid,
                    ping: p.ping
                }));

                // Debug log to trace empty updates
                if (players.length === 0) {
                    this.log('Warning: Emitting empty player list', 'debug');
                }

                this.emit('playerList', players);
            }, 500); // 500ms debounce to dampen spam and race conditions
        };

        this.bot.on('playerJoined', emitPlayerList);
        this.bot.on('playerLeft', emitPlayerList);
        this.bot.on('spawn', emitPlayerList);

        this.bot.on('chat', (username, message, translate, jsonMsg, matches) => {
            this.emitChat(username, message, 'chat');
        });

        this.bot.on('whisper', (username, message, translate, jsonMsg, matches) => {
            this.emitChat(`[WHISPER] ${username}`, message, 'whisper');
        });

        this.bot.on('death', () => {
            let posStr = 'unknown location';
            if (this.bot.entity) {
                const pos = this.bot.entity.position;
                posStr = `${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)}`;
            }
            this.updateStatus(`Died at ${posStr}`);
        });

        this.bot.on('playerJoined', (player) => {
            if (player.username !== this.username) {
                this.log(`[+] ${player.username} joined the game`, 'success');
            }
        });

        this.bot.on('playerLeft', (player) => {
            if (player.username !== this.username) {
                this.log(`[-] ${player.username} left the game`, 'error');
            }
        });

        this.bot.on('message', (jsonMsg, position) => {
            if (position === 'game_info') return;

            // Use mineflayer's built-in conversion to plain text for accuracy
            const text = jsonMsg.toString();
            if (!text || text.trim().length === 0) return;

            this.emitChat('[Server]', text, 'chat');
        });

    }

    addToHistory(username, message, type = 'chat') {
        this.chatHistory.push({ username, message, type, timestamp: Date.now() });
        if (this.chatHistory.length > 100) {
            this.chatHistory.shift();
        }
    }

    stop() {
        this.manuallyStopped = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.bot) {
            this.bot.quit();
        }
    }
}
