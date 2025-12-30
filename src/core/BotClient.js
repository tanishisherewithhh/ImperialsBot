import mineflayer from 'mineflayer';
import { EventEmitter } from 'events';
import { FeatureManager } from '../features/FeatureManager.js';
import { PluginManager } from './PluginManager.js';
import { ConfigLoader } from '../config/ConfigLoader.js';
import inventoryViewer from 'mineflayer-web-inventory';
import { NetworkUtils } from '../utils/NetworkUtils.js';

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
        this.inventoryPort = null;

        this.on('viewerStarted', (data) => {
            this.viewerPort = data.port;
        });
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

    emitChat(username, message, type = 'chat', ansi = null) {
        if (!message) return;

        const plainText = typeof message === 'string' ? message.trim() : message.toString().trim();
        if (plainText.length === 0) return;

        const msgKey = `${username}:${plainText}`;
        if (this.recentMessages.has(msgKey)) return;

        this.recentMessages.add(msgKey);
        setTimeout(() => this.recentMessages.delete(msgKey), 500);

        const displayMessage = ansi || message;

        // Log locally for console/file, but don't broadcast as 'log' to UI
        // and avoid double-pushing to chatHistory since emitChat calls addToHistory.
        const msgStr = `${username}: ${displayMessage}`;
        // The original `this.log` call had `broadcast = false`, meaning it only added to history
        // and did not emit a 'log' event. We replicate that by only calling `addToHistory` later.

        this.emit('chat', {
            message: displayMessage,
            type,
            raw: plainText,
            sender: username
        });

        this.addToHistory(username, displayMessage, type);
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
        this.emit('status', { status, version: this.config.version, inventoryPort: this.inventoryPort });
    }

    log(message, type = 'info', broadcast = true) {
        const msgStr = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;

        // Save to history
        this.chatHistory.push({ message: msgStr, type, timestamp: Date.now() });
        if (this.chatHistory.length > 100) {
            this.chatHistory.shift();
        }

        if (broadcast) {
            this.emit('log', { message: msgStr, type });
        }
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
        const botOptions = {
            username: this.config.username,
            password: this.config.password,
            auth: this.config.auth || 'offline',
            version: this.config.version
        };

        if (this.config.realms) {
            botOptions.realms = this.config.realms;
        } else {
            botOptions.host = this.config.host;
            botOptions.port = this.config.port;
        }

        this.bot = mineflayer.createBot(botOptions);

        // Web Inventory Integration
        // Assign a unique safe port
        const startInvPort = 4000 + Math.floor(Math.random() * 1000);
        NetworkUtils.findFreePort(startInvPort).then(port => {
            this.inventoryPort = port;
            try {
                inventoryViewer(this.bot, { port: this.inventoryPort, startOnLoad: true });
                this.log(`Web Inventory started on safe port ${this.inventoryPort}`, 'info');
                // Re-emit status to update frontend with the actual port
                this.updateStatus(this.status);
            } catch (err) {
                this.log(`Failed to start Web Inventory: ${err.message}`, 'error');
            }
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

                // Ensure a safe minimum delay for server transitions
                if (delay < 2000) delay = 2000;

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

        // Rich Chat handling
        this.bot.on('chat', (username, message, translate, jsonMsg, matches) => {
            this.emitChat(username, message, 'chat', jsonMsg.toAnsi());
        });

        this.bot.on('whisper', (username, message, translate, jsonMsg, matches) => {
            this.emitChat(`[WHISPER] ${username}`, message, 'whisper', jsonMsg.toAnsi());
        });

        this.bot.on('message', (jsonMsg, position) => {
            if (position === 'game_info') return;

            // Only handle system messages here (chat/whisper are handled above)
            if (position === 'chat' || position === 'whisper') return;

            const plainText = jsonMsg.toString();
            if (!plainText || plainText.trim().length === 0) return;

            this.emitChat('[Server]', plainText, 'chat', jsonMsg.toAnsi());
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

        // Removed redundant 'message' listener as it's consolidated above

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
