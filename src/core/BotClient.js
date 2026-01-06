import mineflayer from 'mineflayer';
import { EventEmitter } from 'events';
import { FeatureManager } from '../features/FeatureManager.js';
import { PluginManager } from './PluginManager.js';
import { ConfigLoader } from '../config/ConfigLoader.js';
import inventoryViewer from 'mineflayer-web-inventory';
import { NetworkUtils } from '../utils/NetworkUtils.js';
import { MinecraftColorUtils } from '../utils/MinecraftColorUtils.js';
import { Logger } from '../utils/Logger.js';

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

        this.mcColors = MinecraftColorUtils;
    }


    emitChat(username, message, type = 'chat', ansi = null) {
        if (!message) return;

        const displayMessage = ansi || message;

        const plainText = displayMessage.replace(/\x1b\[[0-9;]*m/g, '').trim();
        if (plainText.length === 0) return;

        for (const recent of this.recentMessages) {
            if (recent === plainText) return;
        }

        this.recentMessages.add(plainText);
        setTimeout(() => this.recentMessages.delete(plainText), 1000);

        this.emit('chat', {
            message: displayMessage,
            type,
            raw: plainText,
            sender: username || '[Server]'
        });

        this.addToHistory(username || '[Server]', displayMessage, type);
    }

    parseReason(reason) {
        if (!reason) return 'Unknown reason';

        console.log('Raw Kick Reason:', reason);

        if (typeof reason.toAnsi === 'function') {
            return reason.toAnsi();
        }

        if (typeof reason === 'object' && reason !== null) {
            const parsed = this.mcColors.nbtToAnsi(reason);
            if (parsed && parsed.trim().length > 0) return parsed;
        }

        if (typeof reason === 'string') {
            return this.mcColors.minecraftToAnsi(reason);
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
        let msgStr;
        try {
            msgStr = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
        } catch (e) {
            msgStr = '[Circular or Unserializable Object]';
        }

        if (typeof msgStr === 'string' && msgStr.includes('§')) {
            msgStr = this.mcColors.minecraftToAnsi(msgStr);
        }

        this.chatHistory.push({ message: msgStr, type, timestamp: Date.now() });
        if (this.chatHistory.length > 100) {
            this.chatHistory.shift();
        }

        if (broadcast) {
            this.emit('log', { message: msgStr, type });
        }

        Logger.log(`[${this.username}] ${msgStr}`, type);
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
        this.manuallyStopped = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.bot) {
            try {
                this.bot.removeAllListeners();
                this.bot.quit();
            } catch (e) {
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

        try {
            this.bot = mineflayer.createBot(botOptions);
        } catch (err) {
            this.log(`Fatal Initialization Error: ${err.message}`, 'error');
            this.updateStatus(`Fatal Error: ${err.message}`);
            return;
        }

        // Web Inventory Integration
        const startInvPort = 4000 + Math.floor(Math.random() * 1000);
        NetworkUtils.findFreePort(startInvPort).then(port => {
            this.inventoryPort = port;
            try {
                inventoryViewer(this.bot, { port: this.inventoryPort, startOnLoad: true });
                this.log(`Web Inventory started on safe port ${this.inventoryPort}`, 'info');
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
            if (this.reconnectTimer) return;
            this.pluginManager.onTick();

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
            this.updateStatus('Offline');
            this.emit('end');
            this.log(`${this.username} disconnected`, 'error');

            const isAuto = this.config.autoReconnect === true || this.config.autoReconnect === 'true';
            if (isAuto) {
                const settings = await ConfigLoader.loadSettings() || {};
                let delay = parseInt(settings.reconnectDelay) || 5000;
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
            // Rich Aqua Notification
            this.emitChat('[Server]', '\x1b[1;36mBOT RESPAWNED\x1b[0m', 'chat');
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
                this.emit('playerList', players);
            }, 500);
        };

        this.bot.on('playerJoined', emitPlayerList);
        this.bot.on('playerLeft', emitPlayerList);
        this.bot.on('spawn', emitPlayerList);
        this.bot.on('message', (jsonMsg, position) => {
            if (position === 'game_info') return;

            const getBestAnsi = (comp) => {
                if (!comp) return '';
                if (comp.unsigned && typeof comp.unsigned.toAnsi === 'function') {
                    return comp.unsigned.toAnsi();
                }
                if (typeof comp.toAnsi === 'function') {
                    return comp.toAnsi();
                }
                return comp.toString();
            };

            const fullAnsi = getBestAnsi(jsonMsg);
            const plainText = jsonMsg.toString();
            if (!plainText || plainText.trim().length === 0) return;

            this.emitChat('[Server]', fullAnsi, 'chat', fullAnsi);
        });

        const handleRichEvent = (username, message, type, jsonMsg) => {
            const fullAnsi = jsonMsg.unsigned?.toAnsi?.() || jsonMsg.toAnsi();
            this.emitChat('[Server]', fullAnsi, type, fullAnsi);
        };

        this.bot.on('chat', (username, message, translate, jsonMsg) => {
            handleRichEvent(username, message, 'chat', jsonMsg);
        });

        this.bot.on('whisper', (username, message, translate, jsonMsg) => {
            handleRichEvent(`[WHISPER] ${username}`, message, 'whisper', jsonMsg);
        });

        this.bot.on('death', () => {
            let posStr = 'unknown location';
            if (this.bot.entity) {
                const pos = this.bot.entity.position;
                posStr = `${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)}`;
            }
            this.updateStatus(`Died at ${posStr}`);
            // Rich Aqua Notification
            this.emitChat('[Server]', `\x1b[1;36mBOT DIED AT ${posStr}\x1b[0m`, 'chat');
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
