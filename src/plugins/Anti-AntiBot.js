export default class AntiAntiBot {
    constructor() {
        this.name = 'Anti-AntiBot';
        this.description = 'Bypasses XCord, BotSentry, BungeeCord BotFilter, and custom captchas.';
        this.color = 'b';

        this.settings = {
            bypassXCord: { type: 'boolean', label: 'Bypass XCord Checks', value: true },
            bypassBotSentry: { type: 'boolean', label: 'Bypass BotSentry Checks', value: true },
            bypassBotFilter: { type: 'boolean', label: 'Bypass BungeeCord BotFilter', value: true },
            randomizeIdentity: { type: 'boolean', label: 'Randomize Client Identity', value: false },
            jitterMode: { type: 'boolean', label: 'Passive Human Jitter', value: true },
            useBridge: { type: 'boolean', label: 'Use CAPTCHA Bridge', value: true },
            solveMath: { type: 'boolean', label: 'Solve Math Captchas', value: true },
            solveInventory: { type: 'boolean', label: 'Solve Inventory Captchas', value: true },
            simulateGravity: { type: 'boolean', label: 'Simulate Gravity (Fake Lobby)', value: true },
            emulateVanillaPackets: { type: 'boolean', label: 'Emulate Vanilla Client Packets', value: true },
            smartBackoffMinutes: { type: 'number', label: 'Denial Backoff (Minutes)', value: 5 }
        };

        this.jitterTimer = null;
        this.jitterTimeout = null;
        this.gravityTimer = null;
        this.tickTimer = null;

        this.spawnTime = 0;
        this.hasLanded = false;
        this.pendingGravity = false;
        this.lastGroundY = null;
        this.consecutiveKicks = 0;
        this.lastKickTime = 0;

        this.botFilterState = {
            active: false,
            spawnY: 450,
            spawnX: 7,
            spawnZ: 7,
            velocity: 0,
            currentY: 450,
            packetsSent: 0,
            startTime: 0
        };
    }

    init(bot, api) {
        this.bot = bot;
        this.api = api;
    }

    enable() {
        this.api.on('messagestr', (msg) => this.handleChat(msg));
        this.api.on('windowOpen', (window) => this.handleWindow(window));
        this.api.on('spawn', () => this.handleSpawn());
        this.api.on('kicked', (reason) => this.handleKicked(reason));

        if (this.settings.jitterMode.value) {
            this.startJitter();
        }

        if (this.settings.bypassBotFilter.value) {
            this._hookBotFilterPackets();
        }
    }

    disable() {
        this._clearAllTimers();
    }

    _clearAllTimers() {
        if (this.jitterTimeout) { clearTimeout(this.jitterTimeout); this.jitterTimeout = null; }
        if (this.jitterTimer) { clearInterval(this.jitterTimer); this.jitterTimer = null; }
        if (this.gravityTimer) { clearInterval(this.gravityTimer); this.gravityTimer = null; }
        if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
    }

    onConfigUpdate(newConfig) {
        for (const [key, val] of Object.entries(newConfig)) {
            if (this.settings[key]) {
                this.settings[key].value = val;
            }
        }

        if (this.settings.jitterMode.value) {
            this.startJitter();
        } else {
            if (this.jitterTimeout) { clearTimeout(this.jitterTimeout); this.jitterTimeout = null; }
            if (this.jitterTimer) { clearInterval(this.jitterTimer); this.jitterTimer = null; }
        }
    }

    startJitter() {
        if (this.jitterTimer || this.jitterTimeout) return;
        this.jitterTimeout = setTimeout(() => {
            this.jitterTimeout = null;
            if (!this.settings.jitterMode.value) return;
            this.jitterTimer = setInterval(() => {
                if (!this._isBotAlive()) return;
                const yaw = this.bot.entity.yaw + (Math.random() - 0.5) * 0.03;
                let pitch = this.bot.entity.pitch + (Math.random() - 0.5) * 0.02;
                pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
                try { this.bot.look(yaw, pitch, true).catch(() => {}); } catch (e) {}
            }, 3000 + Math.random() * 4000);
        }, 8000 + Math.random() * 4000);
    }

    _hookBotFilterPackets() {
        if (!this.bot?._client) return;
        const client = this.bot._client;

        client.on('position', (data) => {
            if (!this.settings.bypassBotFilter.value) return;

            const teleportId = data.teleportId;
            if (teleportId === undefined || teleportId === null) return;

            const isBotFilter = (teleportId === 9876) ||
                (data.y >= 400 && Math.abs(data.x) < 50 && Math.abs(data.z) < 50);

            if (!isBotFilter) return;

            this.botFilterState.active = true;
            this.botFilterState.spawnX = data.x;
            this.botFilterState.spawnY = data.y;
            this.botFilterState.spawnZ = data.z;
            this.botFilterState.velocity = 0;
            this.botFilterState.currentY = data.y;
            this.botFilterState.packetsSent = 0;
            this.botFilterState.startTime = Date.now();

            this.log(`BotFilter detected (id=${teleportId}, y=${data.y}). Starting bypass...`, 'info');

            setTimeout(() => {
                try {
                    client.write('teleport_confirm', { teleportId: teleportId });
                } catch (e) {}
                this._startBotFilterFall();
            }, 50 + Math.random() * 80);
        });

        this.bot.on('move', () => {
            if (this.botFilterState.active || !this.settings.bypassBotFilter.value) return;
            if (this.bot.entity.position.y > 150 && !this.pendingGravity && !this.hasLanded) {
                this._handleFakeLobby();
            }
        });
    }

    _startBotFilterFall() {
        if (this.gravityTimer) { clearInterval(this.gravityTimer); this.gravityTimer = null; }
        
        if (this.bot) this.bot.physicsEnabled = true;
        this.botFilterState.active = false;
        this.hasLanded = true;
        this.botClient.log('Physics enabled, falling simulation removed.', 'info');
    }

    handleSpawn() {
        this.spawnTime = Date.now();
        this.hasLanded = false;
        this.pendingGravity = false;
        this.lastGroundY = null;

        if (this.settings.emulateVanillaPackets.value) {
            this._emulateVanillaLogin();
        }



        if (this.settings.simulateGravity.value) {
            this._handleFakeLobby();
        } else if (this.settings.bypassXCord.value || this.settings.bypassBotSentry.value) {
            this.bot.physicsEnabled = false;
            setTimeout(() => {
                if (this.bot) this.bot.physicsEnabled = true;
            }, 10000);
        }
    }

    _emulateVanillaLogin() {
        if (!this.bot?._client) return;
        const client = this.bot._client;

        try {
            const settingsPayload = {
                locale: 'en_US',
                viewDistance: 10,
                chatFlags: 0,
                chatColors: true,
                skinParts: 0x7F,
                mainHand: 1,
                enableTextFiltering: false,
                enableServerListing: true
            };

            setTimeout(() => {
                try { if (client.write) client.write('settings', settingsPayload); } catch (e) {}
            }, 200 + Math.random() * 300);

            setTimeout(() => {
                try {
                    if (client.write) {
                        client.write('custom_payload', {
                            channel: 'minecraft:brand',
                            data: Buffer.from('\x07vanilla')
                        });
                    }
                } catch (e) {}
            }, 500 + Math.random() * 500);

            setTimeout(() => {
                try { if (client.write) client.write('held_item_slot', { slotId: 0 }); } catch (e) {}
            }, 800 + Math.random() * 400);
        } catch (e) {}
    }

    _handleFakeLobby() {
        this.bot.physicsEnabled = false;
        this.pendingGravity = true;

        let tickCount = 0;

        this.gravityTimer = setInterval(() => {
            if (!this._isBotAlive() || this.hasLanded) {
                this._stopGravitySim();
                return;
            }

            tickCount++;
            const pos = this.bot.entity.position;
            const fallSpeed = Math.min(0.08 * tickCount, 3.92);
            const newY = pos.y - fallSpeed * 0.05;

            if (newY <= 0 || tickCount > 200) {
                this.hasLanded = true;
                this._stopGravitySim();
                setTimeout(() => {
                    if (this.bot) this.bot.physicsEnabled = true;
                }, 500);
                return;
            }

            try {
                if (this.bot._client && this.bot._client.write) {
                    this.bot._client.write('position', {
                        x: pos.x, y: newY, z: pos.z, onGround: false
                    });
                }
                pos.y = newY;
            } catch (e) {}
        }, 50);

        setTimeout(() => {
            if (this.pendingGravity && this.bot) {
                this._stopGravitySim();
                this.bot.physicsEnabled = true;
            }
        }, 15000);
    }

    _stopGravitySim() {
        this.pendingGravity = false;
        this.botFilterState.active = false;
        if (this.gravityTimer) { clearInterval(this.gravityTimer); this.gravityTimer = null; }
    }

    async handleChat(msg) {
        const lower = msg.toLowerCase();

        if (this.settings.solveMath.value) {
            const mathPatterns = [
                /(?:solve|answer|what\s+is|calculate|type|enter)\s*:?\s*(\d+)\s*([\+\-\*\/x])\s*(\d+)/i,
                /(\d+)\s*([\+\-\*\/x])\s*(\d+)\s*(?:=\s*\?|solve|answer)/i,
                /(\d+)\s*([\+\-\*\/x])\s*(\d+)/
            ];

            for (const pattern of mathPatterns) {
                const match = msg.match(pattern);
                if (match && (lower.includes('solve') || lower.includes('what') ||
                    lower.includes('calculate') || lower.includes('answer') ||
                    lower.includes('type') || lower.includes('enter') ||
                    lower.includes('captcha') || lower.includes('verify'))) {

                    const num1 = parseInt(match[1]);
                    const op = match[2] === 'x' ? '*' : match[2];
                    const num2 = parseInt(match[3]);
                    let ans;

                    switch (op) {
                        case '+': ans = num1 + num2; break;
                        case '-': ans = num1 - num2; break;
                        case '*': ans = num1 * num2; break;
                        case '/': ans = Math.floor(num1 / num2); break;
                        default: continue;
                    }

                    this.log(`Math captcha solved: ${num1} ${op} ${num2} = ${ans}`, 'success');
                    const delay = 1500 + Math.random() * 2000;
                    setTimeout(() => { this.api.chat(ans.toString()); }, delay);
                    return;
                }
            }
        }

        if (this.botFilterState.active && this.settings.bypassBotFilter.value) {
            if (lower.includes('введите') || lower.includes('капч') ||
                lower.includes('captcha') || lower.includes('номер') ||
                lower.includes('картинк') || lower.includes('number from')) {
                this.log('BotFilter captcha detected. Forwarding to dashboard/Discord.', 'warning');
                this.triggerBridgeAlert(`botfilter-captcha://${msg}`);
            }
        }

        const linkMatch = msg.match(/(https?:\/\/[^\s]+)/);
        if (linkMatch) {
            const url = linkMatch[1];
            const isXCord = lower.includes('xcord') || lower.includes('verify');
            const isBotSentry = lower.includes('botsentry') || lower.includes('notbot.es');

            if ((isXCord && this.settings.bypassXCord.value) || (isBotSentry && this.settings.bypassBotSentry.value)) {
                this.log(`Verification link detected: ${url}`, 'info');
                this.triggerBridgeAlert(url);
            }
        }

        if (this.settings.bypassBotSentry.value) {
            if (lower.includes('type the color') || lower.includes('enter the color')) {
                const colorMatch = msg.match(/§([0-9a-fk-or])([a-zA-Z]+)/);
                if (colorMatch) {
                    const colorCodes = {
                        '0': 'black', '1': 'dark blue', '2': 'dark green', '3': 'dark aqua',
                        '4': 'dark red', '5': 'dark purple', '6': 'gold', '7': 'gray',
                        '8': 'dark gray', '9': 'blue', 'a': 'green', 'b': 'aqua',
                        'c': 'red', 'd': 'light purple', 'e': 'yellow', 'f': 'white'
                    };
                    const colorName = colorCodes[colorMatch[1]] || colorMatch[2];
                    this.log(`BotSentry color challenge: answering "${colorName}"`, 'success');
                    setTimeout(() => this.api.chat(colorName), 1000 + Math.random() * 1500);
                    return;
                }
            }

            if (lower.includes('enter the code') || lower.includes('type the code')) {
                const codeMatch = msg.match(/(?:code|number)[:\s]*(\d+)/i);
                if (codeMatch) {
                    this.log(`BotSentry code challenge: answering "${codeMatch[1]}"`, 'success');
                    setTimeout(() => this.api.chat(codeMatch[1]), 1000 + Math.random() * 1500);
                    return;
                }
                this.log('BotSentry code challenge detected but could not parse.', 'warning');
            }

            if (lower.includes('/captcha') || lower.includes('run /captcha')) {
                const captchaCode = msg.match(/\/captcha\s+(\S+)/i);
                if (captchaCode) {
                    this.log(`Auto-executing: /captcha ${captchaCode[1]}`, 'success');
                    setTimeout(() => this.api.chat(`/captcha ${captchaCode[1]}`), 800 + Math.random() * 1000);
                    return;
                }
            }
        }
    }

    async triggerBridgeAlert(url) {
        let finalUrl = url;

        if (this.settings.useBridge.value) {
            try {
                const settings = await this.api.botClient.config.constructor.loadSettings() || {};
                const baseUrl = settings.publicDashboardUrl;
                if (baseUrl) {
                    finalUrl = `${baseUrl.replace(/\/$/, '')}/bridge/solve?bot=${encodeURIComponent(this.api.botClient.username)}&target=${encodeURIComponent(url)}`;
                }
            } catch (e) {}
        }

        const discord = this.api.botClient.featureManager?.getFeature('discord');
        if (discord) {
            discord.sendWebhookMessage(
                `**Anti-AntiBot Alert**\nBot **${this.api.botClient.username}** requires verification.\n\n[Solve via Bot IP](${finalUrl})\n[Original Link](${url})`
            );
        }
        this.log(`Verification required: ${finalUrl}`, 'warning');

        this.api.botClient.emitChat(
            'System',
            `Verification required! Link: ${finalUrl}`,
            'info',
            `\x1b[1;33m[Anti-AntiBot]\x1b[0m \x1b[36mVerification required! \x1b[4m${finalUrl}\x1b[0m`
        );
    }

    async handleWindow(window) {
        if (!this.settings.solveInventory.value) return;

        let title = '';
        try {
            if (typeof window.title === 'string') {
                if (window.title.startsWith('{') || window.title.startsWith('"')) {
                    const parsed = JSON.parse(window.title);
                    title = parsed.text || parsed.translate || parsed.extra?.map(e => e.text).join('') || '';
                } else {
                    title = window.title;
                }
            }
        } catch (e) {
            title = String(window.title || '');
        }

        const cleanTitle = title.replace(/§[0-9a-fk-or]/gi, '').toLowerCase().trim();

        const isCaptchaWindow = cleanTitle.includes('captcha') || cleanTitle.includes('verify') ||
            cleanTitle.includes('click the') || cleanTitle.includes('select') ||
            cleanTitle.includes('bot check') || cleanTitle.includes('anti-bot');

        if (!isCaptchaWindow) return;

        this.log(`Captcha GUI detected: "${cleanTitle}"`, 'info');

        const items = window.slots || [];
        let targetMaterial = cleanTitle.match(/click (?:the |on )?([a-z_ ]+)/)?.[1]?.trim().replace(/ /g, '_');

        await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));

        if (targetMaterial) {
            const target = items.find(item =>
                item && item.type !== -1 && item.name &&
                (item.name.includes(targetMaterial) ||
                    (item.displayName && item.displayName.toLowerCase().includes(targetMaterial.replace(/_/g, ' '))))
            );
            if (target) {
                this.log(`Clicking target: ${target.name || target.displayName} (slot ${target.slot})`, 'success');
                try { this.bot.clickWindow(target.slot, 0, 0); } catch (e) {}
                return;
            }
        }

        const verifyItem = items.find(item =>
            item && item.type !== -1 && item.displayName &&
            (item.displayName.toLowerCase().includes('click') ||
                item.displayName.toLowerCase().includes('verify') ||
                item.displayName.toLowerCase().includes('confirm') ||
                item.displayName.toLowerCase().includes('✔') ||
                item.displayName.toLowerCase().includes('✓'))
        );
        if (verifyItem) {
            this.log(`Clicking verify: ${verifyItem.displayName} (slot ${verifyItem.slot})`, 'success');
            try { this.bot.clickWindow(verifyItem.slot, 0, 0); } catch (e) {}
            return;
        }

        const fillerNames = new Set(['gray_stained_glass_pane', 'black_stained_glass_pane', 'white_stained_glass_pane', 'air']);
        const clickable = items.find(item =>
            item && item.type !== -1 && item.name && !fillerNames.has(item.name)
        );
        if (clickable) {
            this.log(`Clicking first available: ${clickable.name} (slot ${clickable.slot})`, 'info');
            try { this.bot.clickWindow(clickable.slot, 0, 0); } catch (e) {}
            return;
        }

        this.log('Captcha GUI: no clickable items found.', 'warning');
    }

    handleKicked(reason) {
        const reasonStr = typeof reason === 'string' ? reason : JSON.stringify(reason);
        const lower = reasonStr.toLowerCase();
        const now = Date.now();

        if (now - this.lastKickTime < 120000) {
            this.consecutiveKicks++;
        } else {
            this.consecutiveKicks = 1;
        }
        this.lastKickTime = now;

        if (!this.settings.bypassXCord.value && !this.settings.bypassBotSentry.value && !this.settings.bypassBotFilter.value) return;

        if (lower.includes('не прошли проверку') || lower.includes('возможно вы бот') ||
            lower.includes('bot filter') || lower.includes('botfilter') ||
            lower.includes('failed position') || lower.includes('failed falling') ||
            lower.includes('failed captcha')) {
            this.log('BotFilter check failed. Retrying in 15 seconds...', 'warning');
            this.api.botClient.customReconnectDelay = 15000;
            this.botFilterState.active = false;
            return;
        }

        if (lower.includes('verified') || lower.includes('complete') ||
            lower.includes('passthrough') || lower.includes('re-join') ||
            lower.includes('rejoin') || lower.includes('success') ||
            lower.includes('приятной игры') || lower.includes('проверка пройдена')) {
            this.log('Verification complete! Auto-rejoining...', 'success');
            this.consecutiveKicks = 0;
            setTimeout(() => this.api.reconnect(), 1500 + Math.random() * 1000);
            return;
        }

        if (lower.includes('denied') || lower.includes('wait a few minutes') ||
            lower.includes('too many') || lower.includes('rate limit') ||
            lower.includes('temporarily banned') || lower.includes('try again later') ||
            lower.includes('подозрительная активность') || lower.includes('повторите попытку')) {
            const baseMinutes = this.settings.smartBackoffMinutes.value || 5;
            const multiplier = Math.min(this.consecutiveKicks, 4);
            const backoffMs = baseMinutes * multiplier * 60000;
            this.log(`IP denial (kick #${this.consecutiveKicks}). Backoff: ${(backoffMs / 60000).toFixed(1)}min`, 'error');
            this.api.botClient.customReconnectDelay = backoffMs;
            return;
        }

        if (lower.includes('not verified') || lower.includes('false positive') ||
            lower.includes('bot verification') || lower.includes('высокий пинг') ||
            lower.includes('big ping')) {
            this.log('Verification failed. Retrying in 30 seconds...', 'warning');
            this.api.botClient.customReconnectDelay = 30000;
            return;
        }
    }

    _isBotAlive() {
        return this.bot?.entity &&
            this.bot?._client?.socket &&
            !this.bot._client.socket.destroyed;
    }

    log(msg, type = 'info') {
        this.api.log(msg, type);
    }
}
