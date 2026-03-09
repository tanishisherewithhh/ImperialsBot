import mineflayer from 'mineflayer';
import { EventEmitter } from 'events';
import { FeatureManager } from '../features/FeatureManager.js';
import { PluginManager } from './PluginManager.js';
import { ConfigLoader } from '../config/ConfigLoader.js';
import inventoryViewer from 'mineflayer-web-inventory';
import { NetworkUtils } from '../utils/NetworkUtils.js';
import { MinecraftColorUtils } from '../utils/MinecraftColorUtils.js';
import { Logger } from '../utils/Logger.js';
import { ProxyAgent } from 'proxy-agent';

export class BotClient extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.config.plugins = this.config.plugins || {};
        this.username = config.username;
        this.bot = null;
        this.featureManager = new FeatureManager(this);
        this.pluginManager = new PluginManager(this);
        this.status = 'Offline';
        this.chatHistory = [];
        this.viewerPort = null;
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
        this.manuallyStopped = false;
        this.recentMessages = new Set();
        this.inventoryPort = null;
        this.packetDebugEnabled = false;
        this._packetListener = null;

        this.pluginManager.on('pluginsUpdated', (data) => {
            this.emit('pluginsUpdated', data);
        });

        this.on('viewerStarted', (data) => {
            this.viewerPort = data.port;
        });

        this.mcColors = MinecraftColorUtils;

        this.log('Bot initialized but offline. Click the "Join" button to start!', 'info');
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

    async updateConfig(newConfig) {
        const criticalFields = [
            'host', 'port', 'version', 'auth', 'password',
            'proxyType', 'proxyHost', 'proxyPort', 'proxyUser', 'proxyPass',
            'realms'
        ];

        let needsRejoin = false;
        for (const field of criticalFields) {
            const oldVal = JSON.stringify(this.config[field]);
            const newVal = JSON.stringify(newConfig[field]);
            if (oldVal !== newVal) {
                needsRejoin = true;
                break;
            }
        }

        // Apply new config
        this.config = { ...this.config, ...newConfig };

        // Soft updates (apply without restart)

        if (needsRejoin && this.status !== 'Offline') {
            this.log('Configuration change detected requiring rejoin...', 'warning');
            this.rejoin();
        } else {
            this.log('Configuration updated', 'info');
            // Emit status update to refresh dashboard info (like version)
            this.updateStatus(this.status);
        }
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
        this.manuallyStopped = false;
        this.stop();
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.init();
        }, 1000);
    }

    async sendWebhook(title, description, color) {
        const discord = this.featureManager.getFeature('discord');
        if (discord && (discord.webhookUrl || (discord.botToken && discord.channelId))) {
            discord.sendEmbed('info', title, description);
            return;
        }

        if (!this.config.webhookUrl) return;

        const payload = {
            embeds: [
                {
                    title: title,
                    description: description,
                    color: color,
                    timestamp: new Date().toISOString()
                }
            ]
        };

        try {
            await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            this.log(`Failed to send Discord webhook: ${error.message}`, 'error', false);
        }
    }

    setLook(yaw, pitch) {
        if (this.bot) {
            this.bot.look(yaw, pitch);
        }
    }

    async init() {
        this.manuallyStopped = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.bot) {
            try {
                this.bot.removeAllListeners();
                this.bot.quit();
                this.bot = null;
            } catch (e) {
            }
        }

        if (this.manuallyStopped === false && !this.reconnectTimer) {
            this.reconnectAttempts = 0;
        }

        this.updateStatus('Connecting');

        // Load plugins early to allow pre-join hooks to execute
        try {
            await this.pluginManager.loadPlugins();
            await this.pluginManager.runPreJoinHooks();
        } catch (err) {
            this.log(`PreJoin hook error: ${err.message}`, 'error');
        }

        try {
            const settings = await ConfigLoader.loadSettings();
            if (settings && settings.randomProxy && settings.proxyList) {
                const proxies = settings.proxyList.split('\n').map(p => p.trim()).filter(p => p.length > 0 && p.includes('://'));
                if (proxies.length > 0) {
                    const randomProxyStr = proxies[Math.floor(Math.random() * proxies.length)];
                    try {
                        const parsed = new URL(randomProxyStr);
                        this.config.proxyType = parsed.protocol.replace(':', '');
                        this.config.proxyHost = parsed.hostname;
                        this.config.proxyPort = parsed.port || (this.config.proxyType.startsWith('socks') ? 1080 : 80);
                        this.config.proxyUser = decodeURIComponent(parsed.username || '');
                        this.config.proxyPass = decodeURIComponent(parsed.password || '');
                        this.log(`Selected random proxy: ${this.config.proxyHost}`, 'info');
                    } catch (e) {
                        this.log(`Failed to parse random proxy URL: ${randomProxyStr}`, 'warning');
                    }
                }
            }
        } catch (err) {
            this.log(`Failed to load global settings: ${err.message}`, 'warning');
        }

        const botOptions = {
            username: this.config.username,
            password: this.config.password,
            auth: this.config.auth || 'offline',
            version: this.config.version,
            connectTimeout: 30000
        };

        if (this.config.realms) {
            if ((this.config.auth || 'offline') === 'offline') {
                this.log('Realms requires Microsoft authentication. Cannot use offline/cracked auth.', 'error');
                this.updateStatus('Error: Realms requires Microsoft auth');
                return;
            }
            botOptions.realms = this.config.realms;
        } else {
            botOptions.host = this.config.host;
            botOptions.port = this.config.port;
        }

        if (this.config.proxyType && this.config.proxyType !== 'none') {
            const { proxyType, proxyHost, proxyPort, proxyUser, proxyPass } = this.config;
            let authStr = '';
            if (proxyUser && proxyPass) {
                authStr = `${encodeURIComponent(proxyUser)}:${encodeURIComponent(proxyPass)}@`;
            } else if (proxyUser) {
                authStr = `${encodeURIComponent(proxyUser)}@`;
            }

            const proxyUrl = `${proxyType}://${authStr}${proxyHost}:${proxyPort}`;
            try {
                this.log(`Attempting connection via proxy: ${proxyType}://${proxyHost}:${proxyPort}`, 'info');
                botOptions.agent = new ProxyAgent({ getProxyForUrl: () => proxyUrl });
            } catch (proxyErr) {
                this.log(`Failed to create proxy agent: ${proxyErr.message}`, 'error');
            }
        }

        try {
            this.bot = mineflayer.createBot(botOptions);

            // INDEPENDENT ERROR BINDING (Immediate)
            // This ensures connection errors are caught before bindEvents
            this.bot.on('error', (err) => {
                let msg = err.message;
                if (err.name === 'AggregateError' && err.errors && err.errors.length > 0) {
                    msg = err.errors[0].message || msg;
                }
                this.emit('error', err);
                this.updateStatus(`Error: ${msg}`);
                this.log(`${this.username} connection error: ${msg}`, 'error');
            });

            this.pluginManager.onBotCreated();
        } catch (err) {
            this.log(`Fatal Initialization Error: ${err.message}`, 'error');
            this.updateStatus(`Fatal Error: ${err.message}`);
            return;
        }

        this.bindEvents();
        try {
            this.featureManager.loadFeatures();
            // Plugins are now loaded at the start of init()
        } catch (err) {
            console.error(`Failed to load features for ${this.username}:`, err);
            this.log(`Load error: ${err.message}`, 'error');
        }
    }

    async savePluginStates() {
        try {
            await ConfigLoader.addBotConfig(this.config);
        } catch (e) {
            this.log(`Failed to save plugin config: ${e.message}`, 'error');
        }
    }

    bindEvents() {
        const instance = this.bot;
        instance.on('spawn', () => {
            if (this.bot !== instance) return; // Ignore if this is an old instance

            this.reconnectAttempts = 0;
            this.updateStatus('Online');
            this.emit('spawn');
            this.log(`${this.username} spawned`, 'success');
            this.lastSpawnTime = Date.now();

            // Start Web Inventory ONLY on spawn
            if (true) {
                const startPort = this.inventoryPort || (4000 + Math.floor(Math.random() * 1000));
                NetworkUtils.findFreePort(startPort).then(port => {
                    this.inventoryPort = port;
                    try {
                        inventoryViewer(instance, { port: this.inventoryPort, startOnLoad: true });
                        this.log(`Web Inventory started on port ${this.inventoryPort}`, 'info');
                        this.updateStatus(this.status); // Push status to update port in UI
                    } catch (err) {
                        this.log(`Web Inventory error: ${err.message}`, 'error');
                    }
                });
            }

            const autoAuth = this.featureManager.getFeature('autoauth');
            const needsAuth = autoAuth && autoAuth.enabled;

            if (needsAuth) {
                this.log('Waiting for AutoAuth to complete before starting plugins...', 'info');
                this.once('authCompleted', () => {
                    if (this.bot !== instance) return;
                    this.log('AutoAuth complete! Starting plugins.', 'success');
                    this.pluginManager.onBotSpawn();
                });
            } else {
                this.pluginManager.onBotSpawn();
            }
            if (instance.inventory) {
                instance.inventory.removeAllListeners('updateSlot');
                let invUpdateTimeout = null;
                instance.inventory.on('updateSlot', () => {
                    if (this.bot !== instance) return;
                    if (invUpdateTimeout) clearTimeout(invUpdateTimeout);
                    invUpdateTimeout = setTimeout(() => {
                        if (this.bot !== instance) return;
                        const inventory = instance.inventory.items().map(item => ({
                            slot: item.slot,
                            name: item.name,
                            displayName: item.displayName,
                            count: item.count
                        }));
                        this.emit('inventoryUpdate', inventory);
                    }, 300);
                });
            }
        });

        instance.on('physicsTick', () => {
            if (this.bot !== instance || this.reconnectTimer) return;
            this.pluginManager.onTick();

            if (instance.entity) {
                const now = Date.now();
                if (now - (this.lastDataEmit || 0) > 250) {
                    this.lastDataEmit = now;
                    this.emit('dataUpdate', {
                        position: instance.entity.position,
                        health: instance.health,
                        food: instance.food,
                        yaw: instance.entity.yaw,
                        pitch: instance.entity.pitch,
                        dimension: instance.game ? instance.game.dimension : 'overworld'
                    });
                }
            }
        });

        instance.on('end', async () => {
            if (this.bot !== instance || this.manuallyStopped || this.reconnectTimer) return;

            const isAuto = this.config.autoReconnect === true || this.config.autoReconnect === 'true';
            if (isAuto || this.isTransferring) {
                this.updateStatus('Transferring');
            } else {
                this.updateStatus('Offline');
            }

            if (this.isTransferring) {
                this.isTransferring = false;
            } else {
                this.log(`${this.username} disconnected`, 'error');
            }

            this.emit('end');

            if (isAuto) {
                const settings = await ConfigLoader.loadSettings() || {};
                let baseDelay = parseInt(settings.reconnectDelay) || 5000;
                if (baseDelay < 2000) baseDelay = 2000;

                const maxDelay = 60000;
                let delay = baseDelay * Math.pow(1.5, this.reconnectAttempts);
                if (delay > maxDelay) delay = maxDelay;
                this.reconnectAttempts++;

                this.log(`Reconnecting in ${Math.round(delay / 1000)}s (Attempt ${this.reconnectAttempts})...`, 'info');

                this.reconnectTimer = setTimeout(() => {
                    this.reconnectTimer = null;
                    if (!this.manuallyStopped) this.init();
                }, delay);
            }
        });

        instance.on('respawn', () => {
            if (this.bot !== instance) return;
            this.log('Dimension/World change detected.', 'info');
            this.lastSpawnTime = Date.now();
            this.emitChat('[Server]', '\x1b[1;36mDIMENSION CHANGE\x1b[0m', 'chat');
        });

        instance.on('kicked', (reason) => {
            if (this.bot !== instance) return;
            const reasonStr = this.parseReason(reason);
            this.log(`Kicked: ${reasonStr}`, 'error');
            this.updateStatus('Kicked');

            if (this.config.webhookUrl) {
                this.sendWebhook(`**${this.username}** was kicked!`, `**Reason:**\n${reasonStr}`, 16711680);
            }
        });

        instance.on('error', (err) => {
            if (this.bot !== instance) return;
            if (err.code === 'ECONNRESET' && this.lastSpawnTime && (Date.now() - this.lastSpawnTime) < 10000) {
                this.log('Connection reset during server transfer, reconnecting...', 'info');
                this.isTransferring = true;
                return;
            }

            let msg = err.message;
            if (err.name === 'AggregateError' && err.errors && err.errors.length > 0) {
                msg = err.errors[0].message || msg;
            }

            this.emit('error', err);
            this.updateStatus(`Error: ${msg}`);
            this.log(`${this.username} error: ${msg}`, 'error');
        });

        let playerUpdateTimeout = null;
        const emitPlayerList = () => {
            if (this.bot !== instance || this.isHeadless) return;
            if (playerUpdateTimeout) clearTimeout(playerUpdateTimeout);
            playerUpdateTimeout = setTimeout(() => {
                if (this.bot !== instance || !instance.players) return;
                const players = Object.values(instance.players).map(p => ({
                    username: p.username,
                    uuid: p.uuid,
                    ping: p.ping
                }));
                this.emit('playerList', players);
            }, 500);
        };

        instance.on('playerJoined', emitPlayerList);
        instance.on('playerLeft', emitPlayerList);
        instance.on('spawn', emitPlayerList);
        instance.on('message', (jsonMsg, position) => {
            if (this.bot !== instance) return;
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
            if (this.bot !== instance) return;
            const fullAnsi = jsonMsg.unsigned?.toAnsi?.() || jsonMsg.toAnsi();
            this.emitChat('[Server]', fullAnsi, type, fullAnsi);
        };

        instance.on('chat', (username, message, translate, jsonMsg) => {
            handleRichEvent(username, message, 'chat', jsonMsg);
        });

        instance.on('whisper', (username, message, translate, jsonMsg) => {
            handleRichEvent(`[WHISPER] ${username}`, message, 'whisper', jsonMsg);
        });

        instance.on('death', () => {
            if (this.bot !== instance) return;
            let posStr = 'unknown location';
            if (instance.entity) {
                const pos = instance.entity.position;
                posStr = `${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)}`;
            }
            this.updateStatus(`Died at ${posStr}`);

            this.emitChat('[Server]', `\x1b[1;36mBOT DIED AT ${posStr}\x1b[0m`, 'chat');

            if (this.config.webhookUrl) {
                this.sendWebhook(`**${this.username}** died!`, `Location: ${posStr}`, 16711680);
            }
        });

        instance.on('playerJoined', (player) => {
            if (this.bot !== instance) return;
            if (player.username !== this.username) {
                this.log(`[+] ${player.username} joined the game`, 'success');
            }
        });

        instance.on('playerLeft', (player) => {
            if (this.bot !== instance) return;
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
        this.disablePacketDebug();
        if (this.bot) {
            try {
                if (typeof this.bot.quit === 'function') {
                    this.bot.quit();
                } else if (typeof this.bot.end === 'function') {
                    this.bot.end();
                }
            } catch (err) {
                this.log(`Error while quitting bot: ${err.message}`, 'error');
            }
            this.bot = null;
        }
        this.log(`${this.username} manually stopped.`, 'warning');
        this.updateStatus('Disconnected');
    }

    enablePacketDebug() {
        if (this.packetDebugEnabled || !this.bot || !this.bot._client) return;
        this.packetDebugEnabled = true;
        let packetCount = 0;
        const MAX_PER_SECOND = 50;
        let resetInterval = setInterval(() => { packetCount = 0; }, 1000);
        this._packetResetInterval = resetInterval;

        this._packetListener = (data, meta) => {
            if (packetCount >= MAX_PER_SECOND) return;
            packetCount++;

            const summary = {};
            if (data && typeof data === 'object') {
                for (const key of Object.keys(data).slice(0, 8)) {
                    const val = data[key];
                    if (val === null || val === undefined) {
                        summary[key] = null;
                    } else if (typeof val === 'object' && val.x !== undefined) {
                        summary[key] = `{x:${val.x?.toFixed?.(1) ?? val.x}, y:${val.y?.toFixed?.(1) ?? val.y}, z:${val.z?.toFixed?.(1) ?? val.z}}`;
                    } else if (typeof val === 'object') {
                        const subs = Object.keys(val).slice(0, 3).map(k => `${k}:${val[k] !== null && typeof val[k] === 'object' ? '[Obj]' : RegExp('function').test(val[k]) ? 'fn()' : val[k]}`).join(',');
                        summary[key] = `{${subs}}`;
                    } else if (typeof val === 'string' && val.length > 50) {
                        summary[key] = val.substring(0, 50) + '...';
                    } else {
                        summary[key] = val;
                    }
                }
            }

            this.emit('packetDebug', {
                direction: 'S→C',
                name: meta.name,
                state: meta.state,
                size: JSON.stringify(data).length,
                summary,
                timestamp: Date.now()
            });
        };
        this.bot._client.on('packet', this._packetListener);
        this.log('Packet Debugger enabled', 'success');
    }

    disablePacketDebug() {
        this.packetDebugEnabled = false;
        if (this._packetResetInterval) {
            clearInterval(this._packetResetInterval);
            this._packetResetInterval = null;
        }
        if (this.bot && this.bot._client && this._packetListener) {
            this.bot._client.removeListener('packet', this._packetListener);
            this._packetListener = null;
        }
    }
}
