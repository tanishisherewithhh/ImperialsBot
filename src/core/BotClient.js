import mineflayer from 'mineflayer';
import { EventEmitter } from 'events';
import { FeatureManager } from '../features/FeatureManager.js';
import { PluginManager } from './PluginManager.js';

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
    }

    extractText(obj) {
        if (!obj) return '';
        if (typeof obj === 'string') return obj;

        if (typeof obj === 'number' || typeof obj === 'boolean') {
            return String(obj);
        }

        if (obj.type === 'string' && typeof obj.value === 'string') {
            return obj.value;
        }

        let text = '';

        if (obj.text !== undefined) {
            text += this.extractText(obj.text);
        }

        if (obj.translate) {
            text += obj.translate;
            if (obj.with && Array.isArray(obj.with)) {
                const args = obj.with.map(w => this.extractText(w)).filter(t => t);
                if (args.length > 0) {
                    text += ' ' + args.join(' ');
                }
            }
        }

        if (obj.extra && Array.isArray(obj.extra)) {
            text += obj.extra.map(e => this.extractText(e)).join('');
        }

        if (Array.isArray(obj)) {
            text += obj.map(item => this.extractText(item)).join('');
        }

        if (!text && obj.value !== undefined) {
            text = String(obj.value);
        }

        if (!text && typeof obj.toString === 'function') {
            const str = obj.toString();
            if (str !== '[object Object]') {
                text = str;
            }
        }

        return text;
    }

    parseReason(reason) {
        if (!reason) return 'Unknown reason';
        if (typeof reason === 'string') return reason;

        const extracted = this.extractText(reason);
        if (extracted && extracted.trim().length > 0) {
            return extracted;
        }

        if (typeof reason.toString === 'function') {
            const str = reason.toString();
            if (str !== '[object Object]') {
                return str;
            }
        }

        try {
            return JSON.stringify(reason);
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
        this.log('Rejoining server...', 'warning');
        this.stop();
        setTimeout(() => this.init(), 1000);
    }

    setLook(yaw, pitch) {
        if (this.bot) {
            this.bot.look(yaw, pitch);
        }
    }

    init() {
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

        this.bot.on('end', () => {
            this.updateStatus('Offline');
            this.emit('end');
            this.log(`${this.username} disconnected`, 'error');

            this.log(`AutoReconnect Check: ${this.config.autoReconnect} (${typeof this.config.autoReconnect})`, 'info');

            if (this.config.autoReconnect === true || this.config.autoReconnect === 'true') {
                this.updateStatus('Reconnecting in 5s...');
                setTimeout(() => this.init(), 5000);
            }
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
            this.lastChatTime = Date.now();
            // console.log(`[Chat] ${username}: ${message}`); 
            // Log everything received from server (including own messages echoed back)
            this.log(`${username}: ${message}`, 'chat');
            this.emit('chat', { username, message, message });
            this.addToHistory(username, message, 'chat');
        });

        this.bot.on('whisper', (username, message, translate, jsonMsg, matches) => {
            this.lastChatTime = Date.now();
            const content = `[WHISPER] ${username} whispers: ${message}`;
            this.log(content, 'whisper');
            this.emit('chat', { username: `[WHISPER] ${username}`, message, content });
            this.addToHistory(`[WHISPER] ${username}`, message, 'whisper');
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

            const isChatOrWhisper = jsonMsg.translate && (
                jsonMsg.translate.startsWith('chat.type') ||
                jsonMsg.translate.startsWith('commands.message.display')
            );

            if (isChatOrWhisper) {
                return; // Try to catch standard chat
            }

            const text = this.extractText(jsonMsg);
            if (!text || text.trim().length === 0) return;

            // Timelock Deduplication Strategy
            // Delay processing by 50ms. If a 'chat' event fired in the meantime (or just before),
            // we assume this message frame was the source of that chat event, and ignore it.
            setTimeout(() => {
                const timeSinceChat = Date.now() - (this.lastChatTime || 0);
                if (timeSinceChat < 200) {
                    // A chat event occurred recently (within 200ms window surrounding this message)
                    return;
                }

                this.emit('chat', { username: '[Server]', message: text });
                this.addToHistory('[Server]', text, 'chat');
            }, 50);
        });

    }

    addToHistory(username, message, type = 'chat') {
        this.chatHistory.push({ username, message, type, timestamp: Date.now() });
        if (this.chatHistory.length > 100) {
            this.chatHistory.shift();
        }
    }

    stop() {
        if (this.bot) {
            this.bot.quit();
        }
    }
}
