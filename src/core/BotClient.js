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

        const plainText = typeof message === 'string' ? message.trim() : message.toString().trim();
        if (plainText.length === 0) return;

        const msgKey = `${username}:${plainText}`;
        if (this.recentMessages.has(msgKey)) return;

        this.recentMessages.add(msgKey);
        setTimeout(() => this.recentMessages.delete(msgKey), 500);

        const displayMessage = ansi || message;

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

        // 1. If it's a Mineflayer/Prismarine chat component, use toAnsi()
        if (typeof reason.toAnsi === 'function') {
            return reason.toAnsi();
        }

        // 2. If it's an NBT-style object or complex JSON
        if (typeof reason === 'object' && reason !== null) {
            const parsed = this.mcColors.nbtToAnsi(reason);
            if (parsed && parsed.trim().length > 0) return parsed;
        }

        // 3. If it's a string, may contain § codes
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

        // Convert Minecraft codes if present
        if (typeof msgStr === 'string' && msgStr.includes('§')) {
            msgStr = this.mcColors.minecraftToAnsi(msgStr);
        }

        // Save to history
        this.chatHistory.push({ message: msgStr, type, timestamp: Date.now() });
        if (this.chatHistory.length > 100) {
            this.chatHistory.shift();
        }

        if (broadcast) {
            this.emit('log', { message: msgStr, type });
        }

        // Persistent file logging
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
        this.manuallyStopped = false; // Ensure it's false when starting
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

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

        // Global message handling (Ensures we catch unparsed or system messages)
        this.bot.on('message', (jsonMsg, position) => {
            if (position === 'game_info') return;

            const plainText = jsonMsg.toString();
            if (!plainText || plainText.trim().length === 0) return;

            // For chat/whisper positions, we let the specific 'chat' and 'whisper' 
            // events below handle it. They are more reliable for name extraction.
            if (position === 'chat' || position === 'whisper') return;

            const ansi = jsonMsg.toAnsi();

            // Deduplicate exact ANSI packets
            const recentKey = `msg:${ansi}`;
            if (this.recentMessages.has(recentKey)) return;
            this.recentMessages.add(recentKey);
            setTimeout(() => this.recentMessages.delete(recentKey), 500);

            // Forward to UI as a system log/message
            this.emitChat('[Server]', plainText, 'chat', ansi);
        });

        // Chat event handling (Primary source for player messages with accurate names)
        const handleRichEvent = (username, message, type, jsonMsg) => {
            const fullAnsi = jsonMsg.toAnsi();
            const fullPlain = jsonMsg.toString();

            // Clean the username if it's a whisper event ([WHISPER] Tanish -> Tanish)
            const plainUsername = username.replace(/^[\[\(]WHISPER[\]\)]\s?/, '').trim();

            // Intelligence Check: Does the full server line already contain the username?
            // If so, we use '[Server]' to avoid 'Player: <Player> Hello' redundancy.
            // If not, we use the detached 'username' to ensure the dashboard shows WHO said it.
            if (fullPlain.includes(plainUsername) && fullPlain.length > message.length + 1) {
                // The full formatted line is complete (e.g. "<Tanish> Hello" or "[Admin] Tanish: Hello")
                this.emitChat('[Server]', fullPlain, type, fullAnsi);
            } else {
                // The full line is missing the name or is just the body
                // (e.g. from some custom chat plugins or strange server formats)
                this.emitChat(username, message, type, fullAnsi);
            }
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
