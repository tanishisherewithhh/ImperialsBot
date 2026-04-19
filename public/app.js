const socket = io();

let currentBot = null;
let currentTab = 'controls';
let bots = new Map();
let activeKeys = new Set();
let spammerEnabled = false;
let lowPerformanceEnabled = false;
let chatVisible = true;
let watchlist = [];
let isCloudMode = false;
const step = 3;


const chatToggleBtn = document.getElementById('chatToggleBtn');
if (chatToggleBtn) {
    chatToggleBtn.onclick = () => {
        chatVisible = !chatVisible;
        chatToggleBtn.title = chatVisible ? 'Hide Chat' : 'Show Chat';

        if (chatVisible) {
            chatToggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        } else {
            chatToggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a22.19 22.19 0 0 1 1.63-2.17M9.91 4.39A10.29 10.29 0 0 1 12 4c7 0 10 7 10 7a20.44 20.44 0 0 1-2.14 2.86"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
        }

        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) chatContainer.style.display = chatVisible ? '' : 'none';
    };
}

const keyMap = {
    'w': 'forward',
    's': 'back',
    'a': 'left',
    'd': 'right',
    ' ': 'jump',
    'shift': 'sneak',
    'control': 'sprint'
};

function isTyping() {
    const el = document.activeElement;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

const botList = document.getElementById('botList');
const connectionStatus = document.getElementById('connectionStatus');
const viewerContainer = document.getElementById('viewerContainer');
const inventoryGridEl = document.getElementById('inventoryGrid');
let chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');
const loadingOverlay = document.getElementById('loadingOverlay');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

const healthVal = document.getElementById('healthVal');
const foodVal = document.getElementById('foodVal');
const posVal = document.getElementById('posVal');

const yawSlider = document.getElementById('yawSlider');
const yawVal = document.getElementById('yawVal');
const pitchSlider = document.getElementById('pitchSlider');
const pitchVal = document.getElementById('pitchVal');

const spammerList = document.getElementById('spammerList');
const addSpamMsgBtn = document.getElementById('addSpamMsgBtn');
const spammerDelay = document.getElementById('spammerDelay');
const spammerOrder = document.getElementById('spammerOrder');
const spammerBtn = document.getElementById('spammerBtn');
const spammerAppend = document.getElementById('spammerAppend');
const spammerLen = document.getElementById('spammerLen');

const suicideBtn = document.getElementById('suicideBtn');
const respawnBtn = document.getElementById('respawnBtn');
const rejoinBtn = document.getElementById('rejoinBtn');
const viewModeBtn = document.getElementById('viewModeBtn');


const addBotModal = document.getElementById('addBotModal');
const editBotModal = document.getElementById('editBotModal');
const addBotBtn = document.getElementById('addBotBtn');
const cancelAddBot = document.getElementById('cancelAddBot');
const cancelEditBot = document.getElementById('cancelEditBot');
const addBotForm = document.getElementById('addBotForm');
const editBotForm = document.getElementById('editBotForm');
const chatForm = document.getElementById('chatForm');

const bulkGenerateModal = document.getElementById('bulkGenerateModal');
const bulkGenerateBtn = document.getElementById('bulkGenerateBtn');
const cancelBulkGenerate = document.getElementById('cancelBulkGenerate');
const bulkGenerateForm = document.getElementById('bulkGenerateForm');
const bulkPluginsList = document.getElementById('bulkPluginsList');

let chatInputHistory = [];
let chatInputHistoryIndex = -1;

if (chatForm) {
    chatForm.onsubmit = (e) => {
        e.preventDefault();
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (text && currentBot) {
            socket.emit('botAction', { username: currentBot, action: 'chat', payload: { message: text } });


            if (chatInputHistory[0] !== text) {
                chatInputHistory.unshift(text);
                if (chatInputHistory.length > 10) chatInputHistory.pop();
            }
            chatInputHistoryIndex = -1;

            input.value = '';
        } else if (!currentBot) {
            showNotification('Select a bot to chat', 'warning');
        }
    };
}

if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (chatInputHistory.length > 0) {
                if (chatInputHistoryIndex < chatInputHistory.length - 1) {
                    chatInputHistoryIndex++;
                    chatInput.value = chatInputHistory[chatInputHistoryIndex];
                }
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (chatInputHistoryIndex > 0) {
                chatInputHistoryIndex--;
                chatInput.value = chatInputHistory[chatInputHistoryIndex];
            } else if (chatInputHistoryIndex === 0) {
                chatInputHistoryIndex = -1;
                chatInput.value = '';
            }
        }
    });
}

const closeSelectionTip = document.getElementById('closeSelectionTip');
const selectionTip = document.getElementById('selectionTip');
if (closeSelectionTip && selectionTip) {
    closeSelectionTip.onclick = () => {
        selectionTip.style.display = 'none';
        localStorage.setItem('hideSelectionTip', 'true');
    };
    if (localStorage.getItem('hideSelectionTip') === 'true') {
        selectionTip.style.display = 'none';
    }
}


const notificationContainer = document.createElement('div');
notificationContainer.className = 'notification-container';
document.body.appendChild(notificationContainer);

function showNotification(message, type = 'info') {
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerText = message;
    notificationContainer.appendChild(notif);

    setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transform = 'translateY(10px)';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

socket.on('connect', () => {
    connectionStatus.style.background = '#22c55e';
    connectionStatus.title = 'Connected to Server';
    loadingOverlay.classList.remove('active');
});

window.toggleDiscordFields = (val, prefix = '') => {
    const webhookGroup = document.getElementById(prefix ? `${prefix}DiscordWebhookFields` : 'discordWebhookFields');
    const botGroup = document.getElementById(prefix ? `${prefix}DiscordBotFields` : 'discordBotFields');
    if (webhookGroup) webhookGroup.style.display = val === 'webhook' ? 'block' : 'none';
    if (botGroup) botGroup.style.display = val === 'bot' ? 'block' : 'none';

    // Update the other modal if it exists to keep them in sync or just for safety
    const otherPrefix = prefix === 'add' ? '' : 'add';
    const otherWebhookGroup = document.getElementById(otherPrefix ? `${otherPrefix}DiscordWebhookFields` : 'discordWebhookFields');
    const otherBotGroup = document.getElementById(otherPrefix ? `${otherPrefix}DiscordBotFields` : 'discordBotFields');
};

socket.on('disconnect', () => {
    connectionStatus.style.background = '#ef4444';
    connectionStatus.title = 'Disconnected';
    loadingOverlay.classList.add('active');
});

let selectedBots = new Set();

socket.on('botList', (data) => {
    botList.innerHTML = '';
    data.forEach(bot => {
        bots.set(bot.username, bot);
        const item = document.createElement('div');
        item.className = `bot-item compact ${currentBot === bot.username ? 'active' : ''}`;

        if (selectedBots.has(bot.username)) {
            item.classList.add('selected');
        }

        item.onclick = (e) => {
            if (!e.target.closest('.btn-icon') && !e.target.closest('.bot-avatar')) {
                if (e.ctrlKey || e.metaKey) {
                    // Toggle selection with Ctrl/Meta key
                    if (selectedBots.has(bot.username)) {
                        selectedBots.delete(bot.username);
                        item.classList.remove('selected');
                    } else {
                        selectedBots.add(bot.username);
                        item.classList.add('selected');
                    }
                    updateSelectedCount();
                }

                // Always switch view on item click (if not an icon/avatar)
                selectBot(bot.username);
            }
        };

        const statusClass = bot.status === 'online' ? 'online' : (bot.status === 'offline' ? 'offline' : 'connecting');

        item.innerHTML = '';

        const avatar = document.createElement('div');
        avatar.className = 'bot-avatar small';
        avatar.style.backgroundImage = `url('https://mc-heads.net/avatar/${bot.username}')`;
        avatar.title = 'Click to select for bulk actions';
        avatar.onclick = (e) => {
            e.stopPropagation();
            if (selectedBots.has(bot.username)) {
                selectedBots.delete(bot.username);
                item.classList.remove('selected');
            } else {
                selectedBots.add(bot.username);
                item.classList.add('selected');
            }
            updateSelectedCount();
        };
        item.appendChild(avatar);

        const name = document.createElement('div');
        name.className = 'bot-name';
        name.style.cssText = 'flex: 1; margin: 0 8px; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; display: flex; align-items: center; gap: 6px;';
        name.innerText = bot.username;
        item.appendChild(name);
        item.appendChild(name);

        const dot = document.createElement('div');
        dot.className = `status-dot ${statusClass}`;
        dot.style.marginRight = '8px';
        item.appendChild(dot);

        const actionGroup = document.createElement('div');
        actionGroup.style.display = 'flex';
        actionGroup.style.gap = '4px';
        actionGroup.innerHTML = `
            <button class="btn-icon small" data-action="edit" title="Edit Bot">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn-icon small delete" data-action="delete-item" title="Delete Bot">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        `;
        item.appendChild(actionGroup);

        const editBtn = item.querySelector('[data-action="edit"]');
        editBtn.onclick = (e) => {
            e.stopPropagation();
            openEditModal(bot);
        };

        const delBtn = item.querySelector('[data-action="delete-item"]');
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Permanently DELETE ${bot.username}?`)) {
                socket.emit('botAction', { username: bot.username, action: 'delete' });
            }
        };

        botList.appendChild(item);
    });

    updateSelectedCount();

    if (!currentBot && data.length > 0) {
        selectBot(data[0].username);
    } else if (currentBot) {
        const bot = bots.get(currentBot);
        if (bot && viewModeBtn) {
            viewModeBtn.innerText = bot.config.firstPerson ? 'Third Person' : 'First Person';
        }
    }
});

function updateSelectedCount() {
    const el = document.getElementById('selectedCount');
    if (el) el.innerText = selectedBots.size;
}

const searchInputBox = document.getElementById('botSearchInput');
if (searchInputBox) {
    searchInputBox.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const items = botList.querySelectorAll('.bot-item');
        items.forEach(item => {
            const nameEl = item.querySelector('.bot-name');
            if (nameEl) {
                const name = nameEl.innerText.toLowerCase();
                item.style.display = name.includes(query) ? 'flex' : 'none';
            }
        });
    });
}

socket.on('logs', (payload) => {
    if (!payload.username) return;
    const targetBox = getChatBox(payload.username);
    if (!chatVisible) return;
    const { message, type } = payload;

    const div = document.createElement('div');
    div.className = `chat-message ${type}`;

    const time = new Date().toLocaleTimeString();

    const timeSpan = document.createElement('span');
    timeSpan.style.opacity = '0.5';
    timeSpan.style.fontSize = '0.8em';
    timeSpan.innerText = `[${time}] `;

    div.appendChild(timeSpan);

    const formattedMessage = document.createElement('span');
    formattedMessage.innerHTML = formatChat(message);
    div.appendChild(formattedMessage);

    targetBox.appendChild(div);
    const isAtBottom = (targetBox.scrollHeight - targetBox.scrollTop - targetBox.clientHeight) < 50;
    if (isAtBottom) {
        targetBox.scrollTop = targetBox.scrollHeight;
    }
});

let chatBoxes = new Map();
chatBoxes.set('default', chatBox);

function getChatBox(username) {
    if (!username) return chatBox;
    if (!chatBoxes.has(username)) {
        const box = document.createElement('div');
        box.className = 'chat-box';
        box.id = `chatBox_${username}`;
        box.style.display = 'none';
        
        const welcome = document.createElement('div');
        welcome.className = 'chat-message info';
        welcome.innerText = `Chat interface for ${username}`;
        box.appendChild(welcome);

        const container = document.querySelector('.chat-container');
        if (container) container.appendChild(box);
        
        chatBoxes.set(username, box);
    }
    return chatBoxes.get(username);
}


function formatMinecraftText(text) {
    if (!text) return '';

    const colorMap = {
        '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
        '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
        '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
        'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF'
    };

    const styleMap = {
        'l': 'font-weight:bold;',
        'm': 'text-decoration:line-through;',
        'n': 'text-decoration:underline;',
        'o': 'font-style:italic;',
        'r': 'reset'
    };

    let html = '';
    let currentStyle = '';
    let currentColor = '';

    const parts = text.split(/§([0-9a-fk-or])/g);

    if (parts[0]) {
        html += escapeHtml(parts[0]);
    }

    for (let i = 1; i < parts.length; i += 2) {
        const code = parts[i];
        const content = parts[i + 1];

        if (colorMap[code]) {
            currentColor = `color:${colorMap[code]};`;
            currentStyle = '';
        } else if (styleMap[code]) {
            if (code === 'r') {
                currentColor = '';
                currentStyle = '';
            } else {
                currentStyle += styleMap[code];
            }
        }

        if (content) {
            const style = `${currentColor}${currentStyle}`;
            if (style) {
                html += `<span style="${style}">${escapeHtml(content)}</span>`;
            } else {
                html += escapeHtml(content);
            }
        }
    }

    return html;
}

function ansiToHtml(text) {
    if (!text) return '';

    const ansiMap = {
        '30': '#000000', '31': '#AA0000', '32': '#00AA00', '33': '#FFAA00',
        '34': '#0000AA', '35': '#AA00AA', '36': '#00AAAA', '37': '#AAAAAA',
        '90': '#555555', '91': '#FF5555', '92': '#55FF55', '93': '#FFFF55',
        '94': '#5555FF', '95': '#FF55FF', '96': '#55FFFF', '97': '#FFFFFF',
        '40': 'background:#000000;', '41': 'background:#AA0000;', '42': 'background:#00AA00;', '43': 'background:#FFAA00;',
        '44': 'background:#0000AA;', '45': 'background:#AA00AA;', '46': 'background:#00AAAA;', '47': 'background:#AAAAAA;'
    };

    const styles = {
        '1': 'font-weight:bold;',
        '2': 'opacity:0.7;',
        '3': 'font-style:italic;',
        '4': 'text-decoration:underline;',
        '5': 'animation: blink 1s infinite;',
        '7': 'filter: invert(100%);',
        '8': 'opacity:0;',
        '9': 'text-decoration:line-through;'
    };

    let html = '';
    let currentColor = '';
    let currentBackground = '';
    let currentStyles = new Set();
    
    let currentHover = null;
    let currentClick = null;

    const parts = text.split(/([\u001b\x1b]\[[0-9;]*m|[\u001b\x1b]\]imc;.*?\x1b\\|[\u001b\x1b]\]imc;.*?\x07)/);

    for (const part of parts) {
        if (!part) continue;

        if (part.startsWith('\x1b[') || part.startsWith('\u001b[')) {
            const codes = part.substring(2, part.length - 1).split(';');
            for (const code of codes) {
                if (code === '0' || code === '') {
                    currentColor = '';
                    currentBackground = '';
                    currentStyles.clear();
                } else if (ansiMap[code]) {
                    if (code.startsWith('4')) currentBackground = ansiMap[code];
                    else currentColor = ansiMap[code];
                } else if (styles[code]) {
                    currentStyles.add(styles[code]);
                }
            }
        } else if (part.startsWith('\x1b]') || part.startsWith('\u001b]')) {
            const content = part.substring(2, part.length - 2);
            if (content.startsWith('imc;')) {
                const cmd = content.substring(4);
                if (cmd.startsWith('h:')) {
                    try {
                        currentHover = atob(cmd.substring(2));
                    } catch(e) {}
                } else if (cmd === 'h') {
                    currentHover = null;
                } else if (cmd.startsWith('c:')) {
                    try {
                        currentClick = atob(cmd.substring(2));
                    } catch(e) {}
                } else if (cmd === 'c') {
                    currentClick = null;
                }
            }
        } else {
            const styleArr = Array.from(currentStyles);
            if (currentColor) styleArr.push(`color:${currentColor};`);
            if (currentBackground) styleArr.push(currentBackground);

            let content = escapeHtml(part);
            let cls = [];
            let attrs = `style="${styleArr.join('')}"`;

            if (currentHover) {
                cls.push('mc-hover');
                const hoverHtml = ansiToHtml(currentHover);
                attrs += ` data-mc-hover="${encodeURIComponent(hoverHtml)}"`;
            }
            if (currentClick) {
                cls.push('mc-click');
                attrs += ` data-mc-click="${encodeURIComponent(currentClick)}"`;
            }

            if (cls.length > 0) {
                html += `<span class="${cls.join(' ')}" ${attrs}>${content}</span>`;
            } else if (styleArr.length > 0) {
                html += `<span ${attrs}>${content}</span>`;
            } else {
                html += content;
            }
        }
    }

    return html;
}

function formatChat(text) {
    if (!text) return '';
    let result = text;


    if (result.includes('\u001b') || result.includes('\x1b')) {
        result = ansiToHtml(result);



    } else {

        result = formatMinecraftText(result);
    }

    return result;
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

socket.on('botStatus', (payload) => {

    const { username, status } = payload;

    if (bots.has(username)) {
        const bot = bots.get(username);
        bot.status = status.toLowerCase();
        if (payload.inventoryPort) bot.inventoryPort = payload.inventoryPort;
    }


    const items = botList.querySelectorAll('.bot-item');
    items.forEach(item => {
        const nameEl = item.querySelector('.bot-name');
        if (nameEl && nameEl.innerText === username) {
            const dot = item.querySelector('.status-dot');
            if (dot) {
                dot.className = 'status-dot ' + status.toLowerCase();
            }
        }
    });


    if (currentBot === username) {
        document.getElementById('botStatus').innerText = status;
        document.getElementById('botStatus').className = `status-indicator ${status.toLowerCase()}`;

        const rejoinBtn = document.getElementById('rejoinBtn');
        if (rejoinBtn) {
            const lowStatus = status.toLowerCase();
            const isOffline = lowStatus === 'offline' || lowStatus === 'created';
            rejoinBtn.innerHTML = rejoinBtn.innerHTML.replace(isOffline ? 'Rejoin' : 'Join', isOffline ? 'Join' : 'Rejoin');
        }

        updateInventoryFrame();
    }
});

let lastBotDataUpdate = 0;
socket.on('botData', (payload) => {
    if (currentBot !== payload.username) return;
    const now = Date.now();

    // Throttle: 250ms normally, 1000ms in Low Performance Mode
    const throttle = lowPerformanceEnabled ? 1000 : 250;
    if (now - lastBotDataUpdate < throttle) return;

    lastBotDataUpdate = now;
    const data = payload.data;

    if (data.health !== undefined) {
        const healthStat = document.getElementById('healthStat');
        const healthBarFill = document.getElementById('healthBarFill');
        const roundedHealth = Math.round(data.health);
        if (healthStat) healthStat.innerText = roundedHealth;
        if (healthBarFill) healthBarFill.style.width = `${Math.min(100, Math.max(0, (data.health / 20) * 100))}%`;
    }
    if (data.food !== undefined) {
        const foodStat = document.getElementById('foodStat');
        const foodBarFill = document.getElementById('foodBarFill');
        const roundedFood = Math.round(data.food);
        if (foodStat) foodStat.innerText = roundedFood;
        if (foodBarFill) foodBarFill.style.width = `${Math.min(100, Math.max(0, (data.food / 20) * 100))}%`;
    }
    if (data.position) {
        const owPosStat = document.getElementById('owPosStat');
        const netherPosStat = document.getElementById('netherPosStat');
        const x = parseFloat(data.position.x);
        const y = parseFloat(data.position.y);
        const z = parseFloat(data.position.z);
        const dim = data.dimension || 'overworld';

        let owX, owY, owZ, nX, nY, nZ;

        if (dim.includes('nether')) {
            nX = x; nY = y; nZ = z;
            owX = x * 8; owY = y; owZ = z * 8;
        } else {
            owX = x; owY = y; owZ = z;
            nX = x / 8; nY = y; nZ = z / 8;
        }

        if (owPosStat) owPosStat.innerText = `${owX.toFixed(0)}, ${owY.toFixed(0)}, ${owZ.toFixed(0)}`;
        if (netherPosStat) netherPosStat.innerText = `${nX.toFixed(0)}, ${nY.toFixed(0)}, ${nZ.toFixed(0)}`;
    }
    if (data.yaw !== undefined && document.activeElement !== yawSlider) {
        const yawDeg = Math.round(data.yaw * 180 / Math.PI);
        yawSlider.value = yawDeg;
        if (yawVal) yawVal.innerText = yawDeg;
    }
    if (data.pitch !== undefined && document.activeElement !== pitchSlider) {
        const pitchDeg = Math.round(data.pitch * 180 / Math.PI);
        pitchSlider.value = pitchDeg;
        pitchVal.innerText = pitchDeg;
    }
});

function trim(num) {
    return Number(num).toFixed(2);
}

socket.on('botPlayers', (payload) => {
    if (currentBot !== payload.username) return;
    renderPlayerList(payload.players || []);
});

function renderPlayerList(players) {
    const playerList = document.getElementById('playerList');
    const playerCount = document.getElementById('playerCount');

    if (playerCount) playerCount.innerText = players.length;
    if (!playerList) return;


    const existingEls = new Map();
    playerList.querySelectorAll('.player-item').forEach(el => {
        existingEls.set(el.dataset.username, el);
    });

    const activeUsernames = new Set();

    players.forEach(p => {
        activeUsernames.add(p.username);
        let el = existingEls.get(p.username);

        if (el) {

            const pingEl = el.querySelector('.ping-text');
            if (pingEl && pingEl.innerText !== `${p.ping}ms`) {
                pingEl.innerText = `${p.ping}ms`;
                let pingColor = '#22c55e';
                if (p.ping > 150) pingColor = '#fbbf24';
                if (p.ping > 300) pingColor = '#ef4444';
                pingEl.style.color = pingColor;
            }
        } else {

            el = document.createElement('div');
            el.className = 'player-item';
            el.dataset.username = p.username;
            el.style.cssText = 'display:flex; align-items:center; gap:8px; padding:4px; animate: fadeIn 0.2s;';
            let pingColor = '#22c55e';
            if (p.ping > 150) pingColor = '#fbbf24';
            if (p.ping > 300) pingColor = '#ef4444';
            el.innerHTML = `
                <span style="flex:1;">${p.username}</span>
                <span class="ping-text" style="color:${pingColor}; font-size:0.8rem;">${p.ping}ms</span>
            `;
            playerList.appendChild(el);
        }
    });


    existingEls.forEach((el, username) => {
        if (!activeUsernames.has(username)) {
            el.remove();
        }
    });
}

let lastSpammerConfigStr = '';

socket.on('spammerConfig', (payload) => {
    if (currentBot !== payload.username) return;
    const config = payload.config;

    if (config) {

        const currentConfigStr = JSON.stringify(config);
        if (currentConfigStr === lastSpammerConfigStr) return;
        lastSpammerConfigStr = currentConfigStr;

        spammerList.innerHTML = '';
        if (config.messages && config.messages.length > 0) {
            config.messages.forEach(msg => addSpammerInput(msg));
        } else {
            addSpammerInput('ImperialsBot OP');
        }

        if (document.activeElement !== spammerDelay) {
            if (config.delay) spammerDelay.value = config.delay;
        }
        if (document.activeElement !== spammerOrder) {
            if (config.order) spammerOrder.value = config.order;
        }
        if (config.appendRandom !== undefined) {
            spammerAppend.checked = config.appendRandom;
        }
        if (document.activeElement !== spammerLen) {
            if (config.randomLength) spammerLen.value = config.randomLength;
        }
    }
});

socket.on('pluginList', (payload) => {
    if (currentBot !== payload.username) return;
    renderPlugins(payload.plugins || []);
});

function renderPlugins(plugins) {
    const pluginsList = document.getElementById('pluginsList');
    if (!pluginsList) return;
    pluginsList.innerHTML = '';

    if (plugins.length === 0) {
        pluginsList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">No plugins loaded</div>';
        return;
    }

    plugins.forEach(plugin => {
        const item = document.createElement('div');
        item.className = 'plugin-item';

        const isEnabled = plugin.enabled;
        const hasError = plugin.hasError;
        const hasSettings = plugin.settings && Object.keys(plugin.settings).length > 0;

        let settingsBtnHtml = '';
        if (hasSettings) {
            settingsBtnHtml = `
                <button class="btn compact" style="padding: 4px 8px; margin-right: 8px; background: rgba(148, 163, 184, 0.1); border: 1px solid var(--text-muted); color: var(--text-muted); display: flex; align-items: center; justify-content: center;" onclick="openPluginSettings('${plugin.name}', '${encodeURIComponent(JSON.stringify(plugin.settings))}', '${encodeURIComponent(JSON.stringify(plugin.config || {}))}')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                </button>
            `;
        }

        item.innerHTML = `
            <div class="plugin-info">
                <div class="plugin-name">${plugin.name}</div>
                <div class="plugin-desc">${plugin.description}</div>
            </div>
            <div style="display: flex; align-items: center;">
                ${settingsBtnHtml}
                <label class="switch">
                    <input type="checkbox" ${isEnabled ? 'checked' : ''} ${hasError ? 'disabled' : ''} 
                        onchange="togglePlugin('${plugin.name}', this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
        `;
        pluginsList.appendChild(item);
    });
}

window.togglePlugin = (name, enabled) => {
    if (!currentBot) return;
    socket.emit('botAction', {
        username: currentBot,
        action: 'togglePlugin',
        payload: { pluginName: name, enabled }
    });
};

window.openPluginSettings = (name, settingsJson, configJson) => {
    const settings = JSON.parse(decodeURIComponent(settingsJson));
    const config = JSON.parse(decodeURIComponent(configJson));

    const titleEl = document.getElementById('pluginSettingsTitle');
    if (titleEl) titleEl.innerText = `${name} Settings`;

    const nameEl = document.getElementById('pluginSettingsName');
    if (nameEl) nameEl.value = name;

    const container = document.getElementById('pluginSettingsContainer');
    if (!container) return;
    container.innerHTML = '';
    container.style.marginTop = '20px'; // Space from heading

    for (const [key, schema] of Object.entries(settings)) {
        const val = config[key] !== undefined ? config[key] : (schema.value !== undefined ? schema.value : (schema.default !== undefined ? schema.default : ''));

        const group = document.createElement('div');
        group.className = 'form-group';
        group.style.background = 'rgba(0,0,0,0.15)';
        group.style.padding = '12px';
        group.style.borderRadius = '8px';
        group.style.marginBottom = '8px';
        group.style.border = '1px solid rgba(255,255,255,0.05)';

        const labelText = schema.label || key;

        if (schema.type === 'boolean') {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.width = '100%';

            const label = document.createElement('label');
            label.innerText = labelText;
            label.style.margin = '0';
            label.style.fontSize = '0.9rem';
            label.style.color = 'var(--text-main)';
            row.appendChild(label);

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = key;
            checkbox.checked = !!val;
            checkbox.style.width = '18px';
            checkbox.style.height = '18px';
            checkbox.style.cursor = 'pointer';
            row.appendChild(checkbox);

            group.appendChild(row);
        } else {
            const label = document.createElement('label');
            label.innerText = labelText;
            label.style.marginBottom = '8px';
            label.style.display = 'block';
            label.style.fontSize = '0.85rem';
            label.style.color = 'var(--text-muted)';
            group.appendChild(label);

            const input = document.createElement('input');
            input.type = schema.type === 'number' ? 'number' : 'text';
            input.name = key;
            input.value = val;
            input.style.width = '100%';
            input.style.padding = '8px';
            input.style.background = 'rgba(0,0,0,0.2)';
            input.style.border = '1px solid var(--glass-border)';
            input.style.borderRadius = '4px';
            input.style.color = 'white';
            group.appendChild(input);
        }

        container.appendChild(group);
    }

    const modal = document.getElementById('pluginSettingsModal');
    if (modal) modal.classList.add('active');
};

const closePluginSettingsBtn = document.getElementById('closePluginSettingsBtn');
if (closePluginSettingsBtn) {
    closePluginSettingsBtn.onclick = () => {
        document.getElementById('pluginSettingsModal').classList.remove('active');
    };
}

const pluginSettingsForm = document.getElementById('pluginSettingsForm');
if (pluginSettingsForm) {
    pluginSettingsForm.onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(pluginSettingsForm);
        const name = formData.get('pluginName');
        const config = {};

        const container = document.getElementById('pluginSettingsContainer');
        container.querySelectorAll('input').forEach(input => {
            if (input.type === 'checkbox') {
                config[input.name] = input.checked;
            } else if (input.type === 'number') {
                config[input.name] = parseFloat(input.value) || 0;
            } else {
                config[input.name] = input.value;
            }
        });

        socket.emit('botAction', {
            username: currentBot,
            action: 'updatePluginConfig',
            payload: { pluginName: name, config }
        });

        document.getElementById('pluginSettingsModal').classList.remove('active');
        showNotification(`${name} settings applied`, 'success');
    };
}

socket.on('notification', (data) => {
    console.log('Notification:', data);
    showNotification(data.message, data.type);
});

function selectBot(username) {
    currentBot = username;
    lastSpammerConfigStr = '';

    // Emit selection to server to join specific room
    socket.emit('selectBot', username);

    // Clear dashboard data for a clean switch
    analyticsData = {};
    if (typeof renderPlugins === 'function') renderPlugins([]);

    const playerList = document.getElementById('playerList');
    if (playerList) playerList.innerHTML = '';

    const healthStat = document.getElementById('healthStat');
    if (healthStat) healthStat.innerText = '0';
    const healthBarFill = document.getElementById('healthBarFill');
    if (healthBarFill) healthBarFill.style.width = '0%';

    const foodStat = document.getElementById('foodStat');
    if (foodStat) foodStat.innerText = '0';
    const foodBarFill = document.getElementById('foodBarFill');
    if (foodBarFill) foodBarFill.style.width = '0%';

    const owPosStat = document.getElementById('owPosStat');
    if (owPosStat) owPosStat.innerText = '0, 0, 0';
    const netherPosStat = document.getElementById('netherPosStat');
    if (netherPosStat) netherPosStat.innerText = '0, 0, 0';

    document.querySelectorAll('.bot-item').forEach(el => {
        if (el.innerText.includes(username)) el.classList.add('active');
        else el.classList.remove('active');
    });

    // Hide all chat boxes
    document.querySelectorAll('.chat-box').forEach(cb => {
        cb.style.display = 'none';
    });

    chatBox = getChatBox(username);
    if (chatBox) {
        chatBox.style.display = 'block';
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    const botNameHeader = document.getElementById('currentBotName');
    if (botNameHeader) botNameHeader.innerText = username;

    socket.emit('requestBotData', { username });
    socket.emit('requestAnalyticsHistory', { username });

    const resetBtn = (btn, label) => {
        if (!btn) return;
        btn.classList.remove('active');
        btn.innerText = `Start ${label}`;
    };
    resetBtn(autoReconnectBtn, 'Auto-Reconnect');
    resetBtn(autoAuthBtn, 'AutoAuth');
    resetBtn(antiAfkBtn, 'Anti-AFK');
    resetBtn(killauraBtn, 'Killaura');
    resetBtn(document.getElementById('autoEatBtn'), 'AutoEat');
    resetBtn(spammerBtn, 'Spammer');
    const kaSettings = document.getElementById('killauraSettings');
    if (kaSettings) kaSettings.style.display = 'none';

    updateInventoryFrame();

    viewerContainer.innerHTML = '<div class="placeholder">Viewer Offline</div>';
}

function updateInventoryFrame() {
    const iframe = document.getElementById('inventoryIframe');
    const placeholder = document.getElementById('inventoryPlaceholder');
    const bot = bots.get(currentBot);

    const status = (bot.status || '').toLowerCase();

    if (bot && status === 'online' && bot.inventoryPort) {

        let url;
        if (isCloudMode) {
            url = `/inventory/${bot.inventoryPort}`;
        } else {
            url = `http://${window.location.hostname}:${bot.inventoryPort}`;
        }
        if (iframe.src !== url) {
            iframe.src = url;
            console.log(`Setting inventory iframe for ${currentBot} to ${url}`);
        }
        iframe.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        iframe.style.display = 'none';
        iframe.src = '';
        placeholder.style.display = 'flex';
        if (!bot) {
            placeholder.innerText = 'Select a bot to view inventory';
        } else if (status !== 'online') {
            placeholder.innerText = 'Bot is offline';
        } else {
            placeholder.innerText = 'Inventory loading...';
        }
    }
}

function updateViewer(port) {
    if (!port) return;
    const viewerFrame = viewerContainer.querySelector('iframe');
    let newSrc;
    if (isCloudMode) {
        newSrc = `/viewer/${port}`;
    } else {
        newSrc = `http://${window.location.hostname}:${port}`;
    }
    if (!viewerFrame) {
        viewerContainer.innerHTML = `<iframe src="${newSrc}" style="width:100%; height:100%; border:none;"></iframe>`;
    } else if (viewerFrame.src !== newSrc) {
        viewerFrame.src = newSrc;
    }
}

socket.on('botViewer', (data) => {

    if (bots.has(data.username)) {
        const botConfig = bots.get(data.username).config;
        botConfig.viewerPort = data.port;
        if (data.firstPerson !== undefined) {
            botConfig.firstPerson = data.firstPerson;
        }
    }
    if (currentBot === data.username) {
        updateViewer(data.port);
        if (viewModeBtn) {
            viewModeBtn.innerText = data.firstPerson ? 'Third Person' : 'First Person';
        }
    }
});

socket.on('chatHistory', (payload) => {
    const username = payload.username;
    const history = payload.history;

    const targetBox = getChatBox(username);

    targetBox.innerHTML = '';
    const welcome = document.createElement('div');
    welcome.className = 'chat-message info';
    welcome.innerText = `Chat history for ${username}`;
    targetBox.appendChild(welcome);

    history.forEach(msg => {
        renderChatMessage(msg, targetBox);
    });
    targetBox.scrollTop = targetBox.scrollHeight;
});

socket.on('botChat', (payload) => {
    if (!payload.username) return;

    const targetBox = getChatBox(payload.username);
    const lastMsg = targetBox.lastElementChild;
    const now = Date.now();
    const compareText = payload.raw || payload.message;
    const sender = payload.sender || '[Server]';

    if (lastMsg && lastMsg.dataset.rawMessage === compareText && lastMsg.dataset.sender === sender) {
        let count = parseInt(lastMsg.dataset.repeatCount) || 1;
        count++;
        lastMsg.dataset.repeatCount = count;
        lastMsg.dataset.timestamp = now;

        let repeatSpan = lastMsg.querySelector('.repeat-count');
        if (!repeatSpan) {
            repeatSpan = document.createElement('span');
            repeatSpan.className = 'repeat-count';
            repeatSpan.style.cssText = 'color: var(--primary); font-weight: bold; margin-left: 8px; font-size: 0.85em; opacity: 0.8;';
            lastMsg.appendChild(repeatSpan);
        }
        repeatSpan.innerText = `(x${count})`;

        // Keep scroll at bottom if it was already there
        const isAtBottom = (targetBox.scrollHeight - targetBox.scrollTop - targetBox.clientHeight) < 100;
        if (isAtBottom) {
            targetBox.scrollTop = targetBox.scrollHeight;
        }
        return;
    }

    const msgObj = {
        username: sender,
        message: payload.message,
        type: payload.type || 'chat',
        raw: compareText,
        timestamp: now
    };

    if (chatVisible) {
        const isAtBottom = (targetBox.scrollHeight - targetBox.scrollTop - targetBox.clientHeight) < 50;
        renderChatMessage(msgObj, targetBox);
        if (isAtBottom) {
            targetBox.scrollTop = targetBox.scrollHeight;
        }
    }
});

function renderChatMessage(msg, targetBox = chatBox) {
    const div = document.createElement('div');
    div.className = `chat-message ${msg.type || 'info'}`;

    div.dataset.rawMessage = msg.raw || msg.message;
    div.dataset.sender = msg.username || '[Server]';
    div.dataset.timestamp = msg.timestamp || Date.now();
    div.dataset.repeatCount = "1";

    const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();

    const timeSpan = document.createElement('span');
    timeSpan.style.opacity = '0.5';
    timeSpan.style.fontSize = '0.8em';
    timeSpan.innerText = `[${time}] `;
    div.appendChild(timeSpan);

    if (msg.username && msg.username !== '[Server]') {
        const nameSpan = document.createElement('span');
        nameSpan.style.fontWeight = 'bold';
        nameSpan.style.marginRight = '5px';
        nameSpan.innerHTML = formatChat(msg.username) + ':';
        div.appendChild(nameSpan);
    }

    const textSpan = document.createElement('span');
    textSpan.className = 'message-content';
    textSpan.innerHTML = formatChat(msg.message);
    div.appendChild(textSpan);

    targetBox.appendChild(div);
}

tabBtns.forEach(btn => {
    btn.onclick = () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
        currentTab = btn.dataset.tab;

        if (currentTab === 'inventory' || currentTab === 'analyticsPane') {
            if (currentTab === 'inventory') updateInventoryFrame();
            else updateAnalyticsGraphs();
        }
        if (currentTab === 'watchlistPane') {
            renderWatchlist();
        }
    };
});

const watchlistInput = document.getElementById('watchlistInput');
const addWatchlistBtn = document.getElementById('addWatchlistBtn');
const watchlistContainer = document.getElementById('watchlistContainer');
const watchlistCount = document.getElementById('watchlistCount');

if (addWatchlistBtn) {
    addWatchlistBtn.onclick = () => addWatchlistPlayer();
}

if (watchlistInput) {
    watchlistInput.onkeydown = (e) => {
        if (e.key === 'Enter') addWatchlistPlayer();
    };
}

function addWatchlistPlayer() {
    const name = watchlistInput.value.trim().toLowerCase();
    if (!name) return;
    if (watchlist.includes(name)) {
        showNotification('Player already in watchlist', 'warning');
        return;
    }
    watchlist.push(name);
    watchlistInput.value = '';
    saveWatchlist();
    renderWatchlist();
}

function removeWatchlistPlayer(name) {
    watchlist = watchlist.filter(n => n !== name);
    saveWatchlist();
    renderWatchlist();
}

function saveWatchlist() {
    socket.emit('updateWatchlist', watchlist);
    const settings = { watchlist: watchlist };
    socket.emit('saveSettings', settings);
}

function renderWatchlist() {
    if (!watchlistContainer) return;
    watchlistContainer.innerHTML = '';
    watchlistCount.innerText = `${watchlist.length} Players`;

    if (watchlist.length === 0) {
        watchlistContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; width: 100%; text-align: center; padding: 20px;">No players in watchlist</div>';
        return;
    }

    watchlist.forEach(name => {
        const tag = document.createElement('div');
        tag.className = 'watchlist-tag';
        tag.style.cssText = 'background: rgba(59, 130, 246, 0.1); border: 1px solid var(--primary); color: var(--text-primary); padding: 5px 12px; border-radius: 20px; display: flex; align-items: center; gap: 8px; font-size: 0.9rem; animate: fadeIn 0.2s;';

        tag.innerHTML = `
            <span>${name}</span>
            <span class="remove-btn" style="cursor: pointer; opacity: 0.6; hover: opacity: 1; font-weight: bold;">&times;</span>
        `;

        tag.querySelector('.remove-btn').onclick = () => removeWatchlistPlayer(name);
        watchlistContainer.appendChild(tag);
    });
}

socket.on('watchlistUpdate', (list) => {
    watchlist = list;
    renderWatchlist();
});

socket.on('watchlistAlert', (data) => {
    showNotification(data.message, data.type === 'join' ? 'success' : 'warning');
});

let packetDebugActive = false;
const togglePacketDebugBtn = document.getElementById('togglePacketDebugBtn');
const clearPacketsBtn = document.getElementById('clearPacketsBtn');
const packetStream = document.getElementById('packetStream');
const packetAutoscroll = document.getElementById('packetAutoscroll');
const packetFilter = document.getElementById('packetFilter');

if (togglePacketDebugBtn) {
    togglePacketDebugBtn.onclick = () => {
        if (!currentBot) return showNotification('Select a bot first', 'warning');
        packetDebugActive = !packetDebugActive;
        togglePacketDebugBtn.innerText = packetDebugActive ? 'Stop Capture' : 'Start Capture';
        togglePacketDebugBtn.style.backgroundColor = packetDebugActive ? 'var(--danger)' : '';
        socket.emit('botAction', {
            username: currentBot,
            action: 'togglePacketDebug',
            payload: { enabled: packetDebugActive }
        });
        const header = document.getElementById('packetHeader');
        if (header) header.style.display = packetDebugActive ? 'flex' : 'none';

        if (packetDebugActive) {
            const placeholder = document.getElementById('packetPlaceholder');
            if (placeholder) {
                placeholder.style.display = 'block';
                placeholder.innerText = 'Listening for packets...';
            }
            if (packetAutoscroll && packetAutoscroll.checked && packetStream) {
                setTimeout(() => {
                    packetStream.scrollTop = packetStream.scrollHeight;
                }, 50);
            }
        }
    };
}

if (packetAutoscroll) {
    packetAutoscroll.onchange = () => {
        if (packetAutoscroll.checked && packetStream) {
            packetStream.scrollTop = packetStream.scrollHeight;
        }
    };
}

if (clearPacketsBtn) {
    clearPacketsBtn.onclick = () => {
        if (!packetStream) return;
        Array.from(packetStream.children).forEach(c => {
            if (c.id !== 'packetHeader' && c.id !== 'packetPlaceholder') {
                c.remove();
            }
        });
    };
}

socket.on('packetDebug', (data) => {
    if (!packetStream || data.username !== currentBot) return;

    const filterVal = packetFilter ? packetFilter.value.toLowerCase() : '';
    if (filterVal && !data.name.toLowerCase().includes(filterVal)) return;

    const placeholder = document.getElementById('packetPlaceholder');
    if (placeholder) placeholder.style.display = 'none';

    const header = document.getElementById('packetHeader');
    if (header) header.style.display = 'flex';

    const row = document.createElement('div');
    row.style.cssText = 'padding: 3px 6px; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; gap: 10px; align-items: baseline;';

    const time = new Date(data.timestamp).toLocaleTimeString();
    const sizeKB = (data.size / 1024).toFixed(1);

    // Color code by packet type for visual scanning
    let nameColor = '#60a5fa';
    if (data.name.includes('position') || data.name.includes('move')) nameColor = '#34d399';
    else if (data.name.includes('chat') || data.name.includes('message')) nameColor = '#fbbf24';
    else if (data.name.includes('entity')) nameColor = '#a78bfa';
    else if (data.name.includes('block')) nameColor = '#f87171';

    const summaryStr = data.summary ? Object.entries(data.summary).map(([k, v]) => `${k}=${v}`).join(' ') : '';

    row.innerHTML = `
        <span style="color: var(--text-muted); min-width: 60px;">${time}</span>
        <span style="color: #94a3b8; min-width: 30px;">${data.direction}</span>
        <span style="color: ${nameColor}; font-weight: 600; min-width: 130px; word-break: break-all;">${data.name}</span>
        <span style="color: var(--text-muted); min-width: 45px;">${sizeKB}KB</span>
        <span style="color: #64748b; flex: 1; word-break: break-all; white-space: pre-wrap;">${summaryStr}</span>
    `;

    // Click to show full summary in a notification
    row.style.cursor = 'pointer';
    row.onclick = () => {
        const detail = JSON.stringify(data.summary, null, 2);
        showNotification(`${data.name}: ${detail.substring(0, 200)}`, 'info');
    };

    packetStream.appendChild(row);

    // Cap at 500 lines (or 100 in Low Performance Mode)
    const maxPackets = lowPerformanceEnabled ? 100 : 500;
    while (packetStream.children.length > maxPackets) {
        packetStream.removeChild(packetStream.firstChild);
    }

    const autoscrollEnabled = packetAutoscroll ? packetAutoscroll.checked : true;
    if (autoscrollEnabled) {
        const scrollBottom = packetStream.scrollTop + packetStream.clientHeight;
        const isAtBottom = (packetStream.scrollHeight - scrollBottom) < 300;

        if (isAtBottom) {
            requestAnimationFrame(() => {
                packetStream.scrollTop = packetStream.scrollHeight;
            });
        }
    }
});

addBotBtn.onclick = () => {
    addBotModal.classList.add('active');
};
window.toggleRealmsFields = function (select, prfx) {
    const isRealms = select.value === 'realms';
    document.getElementById(`${prfx}ServerFields`).style.display = isRealms ? 'none' : 'block';
    document.getElementById(`${prfx}RealmsFields`).style.display = isRealms ? 'block' : 'none';
    const authSelect = document.querySelector(`#${prfx}BotForm [name="auth"]`);
    if (authSelect && isRealms) {
        authSelect.value = 'microsoft';
        authSelect.disabled = true;
    } else if (authSelect) {
        authSelect.disabled = false;
    }
};

cancelAddBot.onclick = () => {
    addBotModal.classList.remove('active');
};

window.toggleProxyFields = function (prfx) {
    const typeSelect = document.getElementById(`${prfx}BotProxyType`);
    const detailsDiv = document.getElementById(`${prfx}BotProxyDetails`);
    if (typeSelect && detailsDiv) {
        if (typeSelect.value === 'none') {
            detailsDiv.style.display = 'none';
        } else {
            detailsDiv.style.display = 'block';
        }
    }
};

window.toggleBulkServerFields = function (val) {
    const srv = document.getElementById('bulkServerFields');
    const rlm = document.getElementById('bulkRealmsFields');
    if (val === 'server') {
        srv.style.display = 'block';
        rlm.style.display = 'none';
    } else {
        srv.style.display = 'none';
        rlm.style.display = 'block';
    }
};

if (bulkGenerateBtn) {
    bulkGenerateBtn.onclick = () => {
        bulkGenerateModal.classList.add('active');
        // Populate initial plugins list
        const firstBot = Array.from(bots.values())[0];
        if (firstBot && firstBot.plugins) {
            renderBulkPlugins(firstBot.plugins);
        } else {
            socket.emit('getAvailablePlugins');
        }
    };
}

socket.on('availablePlugins', (plugins) => {
    renderBulkPlugins(plugins);
});

function renderBulkPlugins(plugins) {
    if (!bulkPluginsList) return;
    bulkPluginsList.innerHTML = plugins.map(p => `
        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-muted); cursor: pointer;">
            <input type="checkbox" name="plugin_${p.name}" ${p.name === 'Pre-Join Ping' ? 'checked' : ''}>
            <span>${p.name}</span>
        </label>
    `).join('');
}

if (cancelBulkGenerate) {
    cancelBulkGenerate.onclick = () => {
        bulkGenerateModal.classList.remove('active');
    };
}

if (bulkGenerateForm) {
    bulkGenerateForm.onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(bulkGenerateForm);
        const rawData = Object.fromEntries(formData.entries());

        const count = parseInt(rawData.count) || 1;
        const nameFormat = rawData.nameFormat || 'bot_%d';

        const baseConfig = {
            host: rawData.host,
            port: parseInt(rawData.port) || 25565,
            version: rawData.version || '1.21.11',
            auth: rawData.auth || 'offline',
            password: rawData.password || '',
            autoReconnect: formData.get('autoReconnect') === 'on',
            firstPerson: formData.get('firstPerson') === 'on',
            reconnectDelay: formData.get('reconnectDelay'),
            globalAnalytics: formData.get('globalAnalytics') === 'on',
            dashboardFont: formData.get('dashboardFont'),
            plugins: {}
        };

        if (rawData.connectionType === 'realms') {
            baseConfig.realms = {
                [rawData.realmType === 'id' ? 'realmId' : (rawData.realmType === 'name' ? 'realmName' : 'realmInvite')]: rawData.realmIdentifier
            };
            baseConfig.host = '';
            baseConfig.port = 0;
        }

        const enabledPlugins = [];
        for (const key in rawData) {
            if (key.startsWith('plugin_')) {
                enabledPlugins.push(key.replace('plugin_', ''));
            }
        }

        const configs = [];
        for (let i = 1; i <= count; i++) {
            const botName = nameFormat.replace('%d', i);
            
            // VALIDATION: Minecraft names must be 3-16 chars, alphanumeric/underscores
            const isValid = /^[a-zA-Z0-9_]{3,16}$/.test(botName);
            if (!isValid) {
                showNotification(`Invalid bot name generated: "${botName}". Names must be 3-16 characters and only contain alphanumeric characters or underscores.`, 'error');
                return;
            }

            const config = {
                ...baseConfig,
                username: botName,
                plugins: {}
            };

            enabledPlugins.forEach(pName => {
                config.plugins[pName] = { enabled: true, config: {} };
            });

            configs.push(config);
        }

        socket.emit('bulkCreateBots', configs);
        bulkGenerateModal.classList.remove('active');
        bulkGenerateForm.reset();
        showNotification(`Generating ${count} bots...`, 'info');
    };
}

addBotForm.onsubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(addBotForm);
    const data = Object.fromEntries(formData.entries());


    if (data.connectionType === 'realms') {
        if (data.auth === 'offline') {
            showNotification('Realms requires Microsoft authentication.', 'error');
            return;
        }
        data.realms = {
            [data.realmType === 'id' ? 'realmId' : (data.realmType === 'name' ? 'realmName' : 'realmInvite')]: data.realmIdentifier
        };

        data.host = '';
        data.port = 0;
    }


    data.port = parseInt(data.port) || 0;
    data.proxyPort = parseInt(data.proxyPort) || 0;
    data.firstPerson = formData.get('firstPerson') === 'on';
    data.autoReconnect = formData.get('autoReconnect') === 'on';
    data.registerConfirm = formData.get('registerConfirm') === 'on';
    if (data.discordIntegrationMode === 'none') {
        data.webhookUrl = '';
        data.discordBotToken = '';
        data.discordChannelId = '';
    } else if (data.discordIntegrationMode === 'webhook') {
        data.discordBotToken = '';
        data.discordChannelId = '';
    } else if (data.discordIntegrationMode === 'bot') {
        data.webhookUrl = '';
    }

    socket.emit('createBot', data);
    addBotModal.classList.remove('active');
    addBotForm.reset();

    document.getElementById('addServerFields').style.display = 'block';
    document.getElementById('addRealmsFields').style.display = 'none';
};

function openEditModal(bot) {
    const form = editBotForm;
    form.username.value = bot.username;
    form.host.value = bot.host || '';
    form.port.value = bot.port || 25565;
    if (form.version) form.version.value = bot.config.version || '';
    if (form.password) form.password.value = bot.config.password || '';
    if (form.auth) form.auth.value = bot.config.auth || 'offline';
    if (form.discordIntegrationMode) form.discordIntegrationMode.value = bot.config.discordIntegrationMode || 'none';
    if (form.webhookUrl) form.webhookUrl.value = bot.config.webhookUrl || '';
    if (form.discordBotToken) form.discordBotToken.value = bot.config.discordBotToken || '';
    if (form.discordChannelId) form.discordChannelId.value = bot.config.discordChannelId || '';

    if (window.toggleDiscordFields) window.toggleDiscordFields(form.discordIntegrationMode.value);

    if (form.proxyType) form.proxyType.value = bot.config.proxyType || 'none';
    if (form.proxyHost) form.proxyHost.value = bot.config.proxyHost || '';
    if (form.proxyPort) form.proxyPort.value = bot.config.proxyPort || '';
    if (form.proxyUser) form.proxyUser.value = bot.config.proxyUser || '';
    if (form.proxyPass) form.proxyPass.value = bot.config.proxyPass || '';


    if (bot.config.realms) {
        form.connectionType.value = 'realms';
        document.getElementById('editServerFields').style.display = 'none';
        document.getElementById('editRealmsFields').style.display = 'block';

        const realms = bot.config.realms;
        if (realms.realmId) {
            form.realmType.value = 'id';
            form.realmIdentifier.value = realms.realmId;
        } else if (realms.realmName) {
            form.realmType.value = 'name';
            form.realmIdentifier.value = realms.realmName;
        } else if (realms.realmInvite) {
            form.realmType.value = 'invite';
            form.realmIdentifier.value = realms.realmInvite;
        }
    } else {
        form.connectionType.value = 'server';
        document.getElementById('editServerFields').style.display = 'block';
        document.getElementById('editRealmsFields').style.display = 'none';
    }


    if (form.firstPerson) form.firstPerson.checked = !!bot.config.firstPerson;
    if (form.autoReconnect) form.autoReconnect.checked = !!bot.config.autoReconnect;
    if (form.registerConfirm) form.registerConfirm.checked = !!bot.config.registerConfirm;
    editBotModal.classList.add('active');
}

editBotForm.onsubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(editBotForm);
    const data = Object.fromEntries(formData.entries());

    if (data.connectionType === 'realms') {
        data.realms = {
            [data.realmType === 'id' ? 'realmId' : (data.realmType === 'name' ? 'realmName' : 'realmInvite')]: data.realmIdentifier
        };
        data.host = '';
        data.port = 0;
    } else {
        delete data.realms;
    }

    if (data.discordIntegrationMode === 'none') {
        data.webhookUrl = '';
        data.discordBotToken = '';
        data.discordChannelId = '';
    } else if (data.discordIntegrationMode === 'webhook') {
        data.discordBotToken = '';
        data.discordChannelId = '';
    } else if (data.discordIntegrationMode === 'bot') {
        data.webhookUrl = '';
    }

    data.port = parseInt(data.port) || 0;
    data.proxyPort = parseInt(data.proxyPort) || 0;
    data.firstPerson = formData.get('firstPerson') === 'on';
    data.autoReconnect = formData.get('autoReconnect') === 'on';
    data.registerConfirm = formData.get('registerConfirm') === 'on';
    socket.emit('editBot', data);
    editBotModal.classList.remove('active');
};

cancelEditBot.onclick = () => {
    editBotModal.classList.remove('active');
};

let chatHistory = [];
let historyIndex = -1;

chatInput.onkeydown = (e) => {
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (chatHistory.length > 0) {
            if (historyIndex < chatHistory.length - 1) {
                historyIndex++;
                chatInput.value = chatHistory[historyIndex];
            }
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > -1) {
            historyIndex--;
            if (historyIndex === -1) {
                chatInput.value = '';
            } else {
                chatInput.value = chatHistory[historyIndex];
            }
        }
    } else if (e.key === 'Enter') {
        if (!currentBot) {
            showNotification('Please select a bot first');
            return;
        }
        const text = chatInput.value;
        if (text.trim()) {
            chatHistory.unshift(text.trim());
            if (chatHistory.length > 10) chatHistory.pop();
            historyIndex = -1;

            socket.emit('botAction', {
                username: currentBot,
                action: 'chat',
                payload: { message: text }
            });
            chatInput.value = '';
        }
    }
};

const botSearchInput = document.getElementById('botSearchInput');
if (botSearchInput) {
    botSearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const items = document.querySelectorAll('.bot-item');
        items.forEach(item => {
            const nameEl = item.querySelector('.bot-name');
            if (nameEl) {
                const name = nameEl.innerText.toLowerCase();
                item.style.display = name.includes(term) ? 'flex' : 'none';
            }
        });
    });
}

function addSpammerInput(value = '') {
    const div = document.createElement('div');
    div.className = 'spammer-input-group';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Message...';
    input.value = value;

    const del = document.createElement('button');
    del.className = 'btn-icon delete';
    del.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
    del.onclick = () => div.remove();

    div.appendChild(input);
    div.appendChild(del);
    spammerList.appendChild(div);
}

addSpamMsgBtn.onclick = () => addSpammerInput('');

const importSpamBtn = document.getElementById('importSpamBtn');
const importSpamFile = document.getElementById('importSpamFile');

if (importSpamBtn && importSpamFile) {
    importSpamBtn.onclick = () => importSpamFile.click();

    importSpamFile.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target.result;
            const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

            if (lines.length > 0) {




                lines.forEach(line => addSpammerInput(line));
                showNotification(`Imported ${lines.length} messages`, 'success');
            } else {
                showNotification('File is empty', 'warning');
            }
            importSpamFile.value = '';
        };
        reader.readAsText(file);
    };
}

const exportSpamBtn = document.getElementById('exportSpamBtn');
if (exportSpamBtn) {
    exportSpamBtn.onclick = () => {
        const inputs = spammerList.querySelectorAll('input');
        const messages = Array.from(inputs)
            .map(input => input.value)
            .filter(v => v.trim() !== '');

        if (messages.length === 0) {
            showNotification('No messages to export', 'warning');
            return;
        }

        const text = messages.join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.href = url;
        a.download = `spammer_config_${timestamp}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification(`Exported ${messages.length} messages`, 'success');
    };
}

const autoReconnectBtn = document.getElementById('autoReconnectBtn');
const autoAuthBtn = document.getElementById('autoAuthBtn');
const antiAfkBtn = document.getElementById('antiAfkBtn');
const killauraBtn = document.getElementById('killauraBtn');

function setupToggle(btn, action, labelOff, labelOn) {
    if (btn) {
        btn.onclick = () => {
            if (!currentBot) return showNotification('Select a bot first');
            const isActive = btn.classList.contains('active');
            socket.emit('botAction', {
                username: currentBot,
                action: action,
                payload: { enabled: !isActive }
            });
        };
    }
}

setupToggle(autoReconnectBtn, 'toggleAutoReconnect', 'Auto Reconnect', 'Auto Reconnect');
setupToggle(autoAuthBtn, 'toggleAutoAuth', 'Auto Auth', 'Auto Auth');
setupToggle(antiAfkBtn, 'toggleAntiAFK', 'Anti-AFK', 'Anti-AFK');
setupToggle(killauraBtn, 'toggleKillaura', 'Killaura', 'Killaura');
setupToggle(document.getElementById('autoEatBtn'), 'toggleAutoEat', 'AutoEat', 'AutoEat');

socket.on('botToggles', (data) => {
    if (currentBot !== data.username) return;


    const updateBtn = (btn, enabled, label) => {
        if (!btn) return;
        if (enabled) {
            btn.classList.add('active');
            btn.innerText = `Stop ${label}`;
        } else {
            btn.classList.remove('active');
            btn.innerText = `Start ${label}`;
        }
    };

    updateBtn(autoReconnectBtn, data.autoReconnectEnabled, 'Auto-Reconnect');
    updateBtn(autoAuthBtn, data.autoAuthEnabled, 'AutoAuth');
    updateBtn(antiAfkBtn, data.antiAfkEnabled, 'Anti-AFK');
    updateBtn(killauraBtn, data.killauraEnabled, 'Killaura');
    updateBtn(document.getElementById('autoEatBtn'), data.autoEatEnabled, 'AutoEat');
    updateBtn(spammerBtn, data.spammerEnabled, 'Spammer');

    const kaSettings = document.getElementById('killauraSettings');
    if (kaSettings) kaSettings.style.display = data.killauraEnabled ? 'block' : 'none';
});

const kaApplyBtn = document.getElementById('kaApplyBtn');
if (kaApplyBtn) {
    kaApplyBtn.onclick = () => {
        if (!currentBot) return showNotification('Select a bot first', 'warning');
        socket.emit('botAction', {
            username: currentBot,
            action: 'updateKillauraConfig',
            payload: {
                config: {
                    attackRange: parseFloat(document.getElementById('kaAttackRange').value) || 4,
                    followRange: parseFloat(document.getElementById('kaFollowRange').value) || 6,
                    viewDistance: parseFloat(document.getElementById('kaViewDistance').value) || 16,
                    attackPlayers: document.getElementById('kaAttackPlayers').checked,
                    attackHostileMobs: document.getElementById('kaAttackHostile').checked,
                    attackPassiveMobs: document.getElementById('kaAttackPassive').checked
                }
            }
        });
        showNotification('Killaura settings applied', 'success');
    };
}

socket.on('killauraConfig', (data) => {
    if (currentBot !== data.username) return;
    const c = data.config;
    const kaAR = document.getElementById('kaAttackRange');
    const kaFR = document.getElementById('kaFollowRange');
    const kaVD = document.getElementById('kaViewDistance');
    const kaAP = document.getElementById('kaAttackPlayers');
    const kaAH = document.getElementById('kaAttackHostile');
    const kaAPa = document.getElementById('kaAttackPassive');
    if (kaAR) kaAR.value = c.attackRange;
    if (kaFR) kaFR.value = c.followRange;
    if (kaVD) kaVD.value = c.viewDistance;
    if (kaAP) kaAP.checked = c.attackPlayers;
    if (kaAH) kaAH.checked = c.attackHostileMobs;
    if (kaAPa) kaAPa.checked = c.attackPassiveMobs;
});

addSpammerInput('ImperialsBot OP');

spammerBtn.onclick = () => {
    if (!currentBot) {
        showNotification('Please select a bot first');
        return;
    }
    const isCurrentlyActive = spammerBtn.classList.contains('active');
    const newState = !isCurrentlyActive;

    const inputs = spammerList.querySelectorAll('input');
    const messages = Array.from(inputs).map(input => input.value).filter(v => v.trim() !== '');

    socket.emit('botAction', {
        username: currentBot,
        action: 'toggleSpammer',
        payload: {
            enabled: newState,
            config: {
                messages: messages,
                delay: parseFloat(spammerDelay.value),
                order: spammerOrder.value,
                appendRandom: spammerAppend.checked,
                randomLength: parseInt(spammerLen.value)
            }
        }
    });
};

suicideBtn.onclick = () => {
    if (!currentBot) {
        showNotification('Please select a bot first');
        return;
    }
    if (confirm('Are you sure you want the bot to commit suicide?')) {
        socket.emit('botAction', { username: currentBot, action: 'suicide', payload: {} });
    }
};

if (respawnBtn) {
    respawnBtn.onclick = () => {
        if (!currentBot) return showNotification('No bot selected', 'error');
        socket.emit('botAction', { username: currentBot, action: 'respawn', payload: {} });
        showNotification(`Respawn command sent to ${currentBot}`, 'info');
    };
}

rejoinBtn.onclick = () => {
    if (!currentBot) {
        showNotification('Please select a bot first');
        return;
    }
    socket.emit('botAction', { username: currentBot, action: 'rejoin' });
};

document.querySelectorAll('[data-action="stop"]').forEach(btn => {
    btn.onclick = () => {
        if (!currentBot) return;
        if (confirm('Disconnect bot from server? (Config will be saved)')) {
            socket.emit('botAction', { username: currentBot, action: 'stop' });
            showNotification('Disconnecting ' + currentBot + '...', 'info');
        }
    };
});

document.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.onclick = () => {
        if (!currentBot) return;
        if (confirm('Permanently DELETE this bot? This cannot be undone.')) {
            socket.emit('botAction', { username: currentBot, action: 'delete' });
        }
    };
});

const controls = ['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint'];
controls.forEach(control => {
    const btns = document.querySelectorAll(`[data-control="${control}"]`);
    btns.forEach(btn => {
        const start = () => {
            btn.classList.add('active');
            sendControl(control, true);
        };
        const end = () => {
            btn.classList.remove('active');
            sendControl(control, false);
        };

        btn.onmousedown = start;
        btn.onmouseup = end;
        btn.onmouseleave = end;
        btn.ontouchstart = (e) => { e.preventDefault(); start(); };
        btn.ontouchend = (e) => { e.preventDefault(); end(); };
    });
});


const btnLeftClick = document.getElementById('btnLeftClick');
const btnRightClick = document.getElementById('btnRightClick');

if (btnLeftClick) {
    btnLeftClick.onmousedown = () => {
        if (!currentBot) return showNotification('Select a bot first');
        socket.emit('botAction', {
            username: currentBot,
            action: 'click',
            payload: { type: 'left' }
        });
        btnLeftClick.style.transform = 'scale(0.95)';
    };
    btnLeftClick.onmouseup = () => btnLeftClick.style.transform = 'scale(1)';
    btnLeftClick.onmouseleave = () => btnLeftClick.style.transform = 'scale(1)';
}

if (btnRightClick) {
    btnRightClick.onmousedown = () => {
        if (!currentBot) return showNotification('Select a bot first');
        socket.emit('botAction', {
            username: currentBot,
            action: 'click',
            payload: { type: 'right' }
        });
        btnRightClick.style.transform = 'scale(0.95)';
    };
    btnRightClick.onmouseup = () => btnRightClick.style.transform = 'scale(1)';
    btnRightClick.onmouseleave = () => btnRightClick.style.transform = 'scale(1)';
}

if (viewModeBtn) {
    viewModeBtn.onclick = () => {
        if (!currentBot) return showNotification('Select a bot first');
        socket.emit('botAction', {
            username: currentBot,
            action: 'toggleView'
        });
    };
}

const powerBtn = document.getElementById('powerBtn');
if (powerBtn) {
    powerBtn.onclick = () => {
        if (confirm('Are you sure you want to SHUTDOWN the entire application? All bots will be disconnected.')) {
            socket.emit('shutdownServer');
            showNotification('Shutting down server...', 'warning');
        }
    };
}

function sendControl(control, state) {
    if (!currentBot) return;
    socket.emit('control', {
        username: currentBot,
        control,
        state
    });
}

function sendLook() {
    if (!currentBot) return;
    socket.emit('botAction', {
        username: currentBot,
        action: 'setLook',
        payload: {
            yaw: parseFloat(yawSlider.value) * Math.PI / 180,
            pitch: parseFloat(pitchSlider.value) * Math.PI / 180
        }
    });
}

yawSlider.oninput = () => {
    yawVal.textContent = yawSlider.value;
    sendLook();
};

pitchSlider.oninput = () => {
    pitchVal.textContent = pitchSlider.value;
    sendLook();
};


function highlightButton(control, active) {
    const btns = document.querySelectorAll(`[data-control="${control}"]`);
    btns.forEach(btn => {
        if (active) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

document.addEventListener('keydown', (e) => {
    if (isTyping()) return;

    const key = e.key.toLowerCase();


    if (key === ' ') {
        e.preventDefault();
    }

    if (keyMap[key] && !activeKeys.has(key)) {
        const control = keyMap[key];
        activeKeys.add(key);
        highlightButton(control, true);
        sendControl(control, true);
    } else if (key.startsWith('arrow')) {
        e.preventDefault(); // Stop page scrolling
        if (!currentBot) return;
        let y = parseFloat(yawSlider.value);
        let p = parseFloat(pitchSlider.value);

        if (key === 'arrowleft') y += step;
        if (key === 'arrowright') y -= step;
        if (key === 'arrowup') p += step;
        if (key === 'arrowdown') p -= step;

        // Wrap yaw -180 to 180
        if (y > 180) y -= 360;
        if (y < -180) y += 360;
        // Clamp pitch -90 to 90
        p = Math.max(-90, Math.min(90, p));

        yawSlider.value = y;
        pitchSlider.value = p;
        yawVal.textContent = y;
        pitchVal.textContent = p;
        sendLook();
    }
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    const control = keyMap[key];

    if (control && activeKeys.has(key)) {
        e.preventDefault();
        activeKeys.delete(key);
        highlightButton(control, false);
        sendControl(control, false);
    }
});

window.addEventListener('blur', () => {
    activeKeys.forEach(key => {
        const control = keyMap[key];
        if (control) {
            highlightButton(control, false);
            sendControl(control, false);
        }
    });
    activeKeys.clear();
});



const exportChatBtn = document.getElementById('exportChatBtn');
exportChatBtn.onclick = () => {
    if (!chatBox.innerText.trim()) {
        showNotification('No chat to export', 'error');
        return;
    }

    let content = '';

    const messages = chatBox.querySelectorAll('.chat-message');
    messages.forEach(msg => {

        content += msg.innerText + '\n';
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_log_${currentBot || 'unknown'}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('Chat exported!', 'success');
};


const themeSelect = document.getElementById('themeSelect');

socket.on('settings', (settings) => {
    if (settings && settings.theme) {
        document.body.className = settings.theme;
        themeSelect.value = settings.theme;
    }
    isCloudMode = settings?.isCloudMode === true;
});

socket.on('globalHeadlessChanged', (enabled) => {
    const overlay = document.getElementById('headlessOverlay');
    if (overlay) {
        if (enabled) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }
});

themeSelect.onchange = (e) => {
    const newTheme = e.target.value;


    if (!document.startViewTransition) {
        document.body.className = newTheme;
        socket.emit('saveSettings', { theme: newTheme });
        return;
    }

    document.startViewTransition(() => {
        document.body.className = newTheme;
        socket.emit('saveSettings', { theme: newTheme });
    });
};

let lastHoverable = null;

document.body.style.setProperty('--mouse-active', '0');

window.addEventListener('mouseenter', () => {
    document.body.style.setProperty('--mouse-active', '1');
});

window.addEventListener('mouseleave', () => {
    document.body.style.setProperty('--mouse-active', '0');
    if (lastHoverable) {
        lastHoverable.style.setProperty('--mouse-x', '-999px');
        lastHoverable.style.setProperty('--mouse-y', '-999px');
    }
});

document.addEventListener('mousemove', (e) => {
    const moveX = (e.clientX - window.innerWidth / 2) * 0.01;
    const moveY = (e.clientY - window.innerHeight / 2) * 0.01;
    document.body.style.setProperty('--parallax-x', `${moveX}px`);
    document.body.style.setProperty('--parallax-y', `${moveY}px`);

    const hoverable = e.target.closest('.btn, .card, .bot-item, .nav-input, .tab-btn');

    if (lastHoverable && lastHoverable !== hoverable) {
        lastHoverable.style.setProperty('--mouse-x', '-999px');
        lastHoverable.style.setProperty('--mouse-y', '-999px');
    }

    if (hoverable) {
        const rect = hoverable.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        hoverable.style.setProperty('--mouse-x', `${x}px`);
        hoverable.style.setProperty('--mouse-y', `${y}px`);
        document.body.style.setProperty('--mouse-active', '1');
        lastHoverable = hoverable;
    } else {
        document.body.style.setProperty('--mouse-active', '1');
    }
});


const spammerLenLabel = document.getElementById('spammerLenLabel');
if (spammerLen && spammerLenLabel) {
    spammerLen.addEventListener('input', () => {
        spammerLenLabel.textContent = `Anti-Spam Length: ${spammerLen.value}`;
    });
}

const navToggleBtn = document.getElementById('navToggleBtn');
const navX = document.getElementById('navX');
const navY = document.getElementById('navY');
const navZ = document.getElementById('navZ');

let isNavigating = false;

if (navToggleBtn) {
    navToggleBtn.onclick = () => {
        if (!currentBot) return showNotification('Select a bot first');

        if (isNavigating) {

            socket.emit('botAction', {
                username: currentBot,
                action: 'stopNavigation',
                payload: {}
            });
            isNavigating = false;
            navToggleBtn.textContent = 'Go';
            navToggleBtn.className = 'nav-btn go';
        } else {

            const x = parseFloat(navX.value);
            const y = parseFloat(navY.value);
            const z = parseFloat(navZ.value);

            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                return showNotification('Invalid coordinates', 'error');
            }

            socket.emit('botAction', {
                username: currentBot,
                action: 'move',
                payload: { x, y, z }
            });
            isNavigating = true;
            navToggleBtn.textContent = 'Stop';
            navToggleBtn.className = 'nav-btn stop';
        }
    };
}

socket.on('botStatus', (data) => {
    if (data.username === currentBot) {
        if (data.status === 'Arrived' || data.status === 'Navigation Stopped') {
            isNavigating = false;
            if (navToggleBtn) {
                navToggleBtn.textContent = 'Go';
                navToggleBtn.className = 'nav-btn go';
            }
        }
    }
});

let analyticsData = {};
let analyticsCharts = {};
const metricsConfig = {
    ping: { label: 'Ping', unit: 'ms', color: '#22c55e' },
    tps: { label: 'TPS', unit: '', color: '#f97316', max: 20 },
    position: { label: 'Spatial Heatmap', color: '#3b82f6', isHeatmap: true },
    network: { label: 'Network', unit: 'KB/s', color: '#60a5fa', isObjectData: true },
    cpu: { label: 'CPU Usage', unit: '%', color: '#a855f7', max: 100 },
    ram: { label: 'RAM Usage', unit: 'MB', color: '#ec4899' },
    events: { label: 'In-Game Events', unit: '', color: '#eab308', isEventsData: true }
};

socket.on('analyticsHistory', (data) => {
    if (currentBot !== data.username) return;
    analyticsData = data.history;
    if (document.getElementById('analyticsPane').classList.contains('active')) {
        renderAnalyticsCards();
        updateAnalyticsGraphs();
    }
});

socket.on('analyticsUpdate', (data) => {
    if (currentBot !== data.username) return;

    const timestamp = data.stat.timestamp;
    const metrics = Object.keys(data.stat).filter(k => k !== 'timestamp');

    metrics.forEach(key => {
        const val = data.stat[key];
        if (!analyticsData[key]) analyticsData[key] = [];
        analyticsData[key].push({ t: timestamp, v: val });
        // Keep 24 hours of data capped at 43200 points
        if (analyticsData[key].length > 43200) analyticsData[key].shift();
    });

    if (!document.getElementById('analyticsPane').classList.contains('active')) return;

    if (!window._lastGraphUpdate || Date.now() - window._lastGraphUpdate > 1000) {
        updateAnalyticsGraphs();
        window._lastGraphUpdate = Date.now();
    }
});

function renderAnalyticsCards() {
    const chartsGrid = document.getElementById('analyticsChartsGrid');
    const metrics = Object.keys(metricsConfig);

    metrics.forEach(key => {
        const config = metricsConfig[key];

        let card = document.getElementById(`metric-card-${key}`);
        if (!card) {
            card = document.createElement('div');
            card.id = `metric-card-${key}`;
            card.className = 'metric-card';
            card.style.cssText = 'background: rgba(0,0,0,0.2); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; height: 260px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">${config.label}</div>
                    <div class="stat-value" id="stat-val-${key}" style="font-size: 1.1rem; font-weight: bold; color: ${config.color};">${config.isHeatmap ? '' : '--'}</div>
                </div>
                <div style="flex: 1; position: relative; min-height: 0;">
                    ${config.isHeatmap ?
                        `<canvas id="heatmapCanvas" style="width: 100%; height: 100%; display: block;"></canvas>
                         <div id="heatmapOverlayText" style="position: absolute; bottom: 8px; right: 8px; font-size: 0.75rem; color: var(--text-muted); background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 4px;">Waiting for position data</div>` :
                        `<canvas id="chart-${key}"></canvas>`}
                </div>
            `;
            chartsGrid.appendChild(card);

            // Use a dummy entry for heatmap to ensure loop coverage but skip Chart.js init
            if (config.isHeatmap) {
                analyticsCharts[key] = null;
                return;
            }

            const ctx = document.getElementById(`chart-${key}`).getContext('2d');
            let chartConfig;

            if (config.isObjectData) {
                chartConfig = {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [
                            { label: 'RX', data: [], borderColor: '#34d399', borderWidth: 2, fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 },
                            { label: 'TX', data: [], borderColor: '#fbbf24', borderWidth: 2, fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }
                        ]
                    },
                    options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 10, bottom: 5, left: 5, right: 15 } }, plugins: { legend: { display: false }, tooltip: { enabled: true, mode: 'index', intersect: false } }, scales: { x: { display: false }, y: { beginAtZero: true, max: config.max, grace: '10%', ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 9 }, callback: (val) => val + (config.unit ? config.unit : '') }, grid: { color: 'rgba(255,255,255,0.05)', drawTicks: false } } } }
                };
            } else if (config.isEventsData) {
                chartConfig = {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [
                            { label: 'Kills', data: [], borderColor: '#ef4444', borderWidth: 2, fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 },
                            { label: 'Deaths', data: [], borderColor: '#64748b', borderWidth: 2, fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 },
                            { label: 'Collected', data: [], borderColor: '#3b82f6', borderWidth: 2, fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }
                        ]
                    },
                    options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 10, bottom: 5, left: 5, right: 15 } }, plugins: { legend: { display: false }, tooltip: { enabled: true, mode: 'index', intersect: false } }, scales: { x: { display: false }, y: { beginAtZero: true, grace: '10%', ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 9 }, callback: (val) => val + (config.unit ? config.unit : '') }, grid: { color: 'rgba(255,255,255,0.05)', drawTicks: false } } } }
                };
            } else {
                chartConfig = {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [{ data: [], borderColor: config.color, borderWidth: 2, fill: true, backgroundColor: config.color + '22', tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 10, bottom: 5, left: 5, right: 15 } }, plugins: { legend: { display: false }, tooltip: { enabled: true, mode: 'index', intersect: false } }, scales: { x: { display: false }, y: { beginAtZero: true, max: config.max, grace: '10%', ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 9 }, callback: (val) => val + (config.unit ? config.unit : '') }, grid: { color: 'rgba(255,255,255,0.05)', drawTicks: false } } } }
                };
            }
            analyticsCharts[key] = new Chart(ctx, chartConfig);
        }

        const dataArray = analyticsData[key] || [];
        if (dataArray.length > 0) {
            const val = dataArray[dataArray.length - 1].v;
            const statValEl = document.getElementById(`stat-val-${key}`);
            if (config.isHeatmap) {
                statValEl.innerText = '';
            } else if (config.isObjectData && val) {
                statValEl.innerText = `↓ ${val.rx} ↑ ${val.tx} ${config.unit}`;
            } else if (config.isEventsData && val) {
                statValEl.innerText = `${val.kills}K ${val.deaths}D ${val.itemsCollected}C`;
            } else {
                statValEl.innerText = `${typeof val === 'number' ? val.toFixed(key === 'tps' ? 1 : 0) : val}${config.unit}`;
            }
        }
    });
}

const timeRangeSelect = document.getElementById('analyticsTimeRange');
if (timeRangeSelect) {
    timeRangeSelect.addEventListener('change', () => updateAnalyticsGraphs());
}


function updateAnalyticsGraphs() {
    renderAnalyticsCards();

    const timeRangeSelect = document.getElementById('analyticsTimeRange');
    const rangeSeconds = timeRangeSelect ? parseInt(timeRangeSelect.value) : 300;
    const minTime = Date.now() - (rangeSeconds * 1000);

    Object.keys(analyticsCharts).forEach(key => {
        const chart = analyticsCharts[key];
        let data = analyticsData[key] || [];
        const config = metricsConfig[key];
        if (!config || !data.length) return;

        data = data.filter(d => d.t >= minTime);

        // Downsample if dataset is too large (more than 150 points is crowded for a sparkline)
        if (data.length > 150) {
            const step = Math.ceil(data.length / 150);
            data = data.filter((_, i) => i % step === 0);
        }
        if (key === 'position') {
            drawHeatmap(data);
            return;
        }

        chart.data.labels = data.map(d => new Date(d.t).toLocaleTimeString());

        if (config.isObjectData) {
            chart.data.datasets[0].data = data.map(d => d.v.rx);
            chart.data.datasets[1].data = data.map(d => d.v.tx);
        } else if (config.isEventsData) {
            chart.data.datasets[0].data = data.map(d => d.v.kills);
            chart.data.datasets[1].data = data.map(d => d.v.deaths);
            chart.data.datasets[2].data = data.map(d => d.v.itemsCollected);
        } else {
            chart.data.datasets[0].data = data.map(d => d.v);
        }

        chart.update('none');
    });
}

function drawHeatmap(dataArray) {
    const canvas = document.getElementById('heatmapCanvas');
    if (!canvas || !dataArray || dataArray.length === 0) return;
    const ctx = canvas.getContext('2d');

    // Resize canvas for sharp rendering based on container
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    dataArray.forEach(d => {
        if (!d.v) return;
        const x = d.v.x;
        const z = d.v.z;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
    });

    if (minX === Infinity) {
        const overlay = document.getElementById('heatmapOverlayText');
        if (overlay) overlay.innerText = 'Waiting for position data';
        return;
    }

    const padding = 30;
    const rangeX = Math.max(maxX - minX, 10);
    const rangeZ = Math.max(maxZ - minZ, 10);

    const scaleX = (canvas.width - padding * 2) / rangeX;
    const scaleZ = (canvas.height - padding * 2) / rangeZ;
    const scale = Math.min(scaleX, scaleZ);

    const mapWidth = rangeX * scale;
    const mapHeight = rangeZ * scale;
    const offsetX = (canvas.width - mapWidth) / 2 - (minX * scale);
    const offsetZ = (canvas.height - mapHeight) / 2 - (minZ * scale);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#3b82f6';
    ctx.beginPath();

    let started = false;
    dataArray.forEach((d) => {
        if (!d.v) return;
        const cx = offsetX + d.v.x * scale;
        const cz = offsetZ + d.v.z * scale;

        if (!started) {
            ctx.moveTo(cx, cz);
            started = true;
        } else {
            ctx.lineTo(cx, cz);
        }
    });
    ctx.stroke();

    dataArray.forEach((d) => {
        if (!d.v) return;
        const cx = offsetX + d.v.x * scale;
        const cz = offsetZ + d.v.z * scale;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.beginPath();
        ctx.arc(cx, cz, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    const overlay = document.getElementById('heatmapOverlayText');
    if (overlay) {
        overlay.innerText = `Bounds X:[${minX.toFixed(0)}, ${maxX.toFixed(0)}] Z:[${minZ.toFixed(0)}, ${maxZ.toFixed(0)}]`;
    }
}

const exportAnalyticsBtn = document.getElementById('exportAnalyticsBtn');
if (exportAnalyticsBtn) {
    exportAnalyticsBtn.onclick = () => {
        if (!analyticsData.ping || analyticsData.ping.length === 0) {
            showNotification('No data to export', 'error');
            return;
        }


        const metrics = Object.keys(analyticsData);
        let csv = `Timestamp,${metrics.join(',')}\n`;


        let maxLen = 0;
        metrics.forEach(m => {
            if (analyticsData[m].length > maxLen) maxLen = analyticsData[m].length;
        });

        for (let i = 0; i < maxLen; i++) {

            let timestamp = '';
            for (const m of metrics) {
                if (analyticsData[m][i]) {
                    timestamp = new Date(analyticsData[m][i].t).toISOString();
                    break;
                }
            }

            let row = `${timestamp}`;
            metrics.forEach(m => {
                const val = analyticsData[m][i] ? analyticsData[m][i].v : '';
                row += `,${val}`;
            });
            csv += row + '\n';
        }

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics_${currentBot}_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification('Analytics exported!', 'success');
    };
}

const settingsModal = document.getElementById('settingsModal');
const settingsBtn = document.getElementById('settingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const settingsForm = document.getElementById('settingsForm');
const settingReconnectDelay = document.getElementById('settingReconnectDelay');
const settingGlobalAnalytics = document.getElementById('settingGlobalAnalytics');
const settingDashboardFont = document.getElementById('settingDashboardFont');

if (settingsBtn) {
    settingsBtn.onclick = () => {
        settingsModal.classList.add('active');
    };
}

if (closeSettingsBtn) {
    closeSettingsBtn.onclick = () => {
        settingsModal.classList.remove('active');
    };
}

if (settingsForm) {
    settingsForm.onsubmit = (e) => {
        e.preventDefault();
        const delay = parseInt(settingReconnectDelay.value);
        const lowPerf = document.getElementById('settingLowPerformance').checked;
        const proxyListText = document.getElementById('settingProxyList') ? document.getElementById('settingProxyList').value : '';
        const randomProxy = document.getElementById('settingRandomProxy') ? document.getElementById('settingRandomProxy').checked : false;
        const autoAuthRegister = document.getElementById('settingAutoAuthRegister') ? document.getElementById('settingAutoAuthRegister').value : '';
        const autoAuthLogin = document.getElementById('settingAutoAuthLogin') ? document.getElementById('settingAutoAuthLogin').value : '';
        const globalAnalytics = document.getElementById('settingGlobalAnalytics') ? document.getElementById('settingGlobalAnalytics').checked : false;

        const updates = {};

        const font = document.getElementById('settingDashboardFont').value;
        if (font) updates.dashboardFont = font;

        if (!isNaN(delay)) updates.reconnectDelay = delay;
        updates.lowPerformanceMode = lowPerf;
        updates.proxyList = proxyListText;
        updates.randomProxy = randomProxy;
        if (autoAuthRegister !== '') updates.autoAuthRegister = autoAuthRegister;
        if (autoAuthLogin !== '') updates.autoAuthLogin = autoAuthLogin;
        updates.globalAnalytics = globalAnalytics;

        const globalFriendsInput = document.getElementById('settingGlobalFriends');
        if (globalFriendsInput) {
            updates.globalFriends = globalFriendsInput.value.split(',').map(s => s.trim()).filter(Boolean);
        }

        if (Object.keys(updates).length > 0) {
            socket.emit('saveSettings', updates);
            settingsModal.classList.remove('active');
            showNotification('Global settings saved!', 'success');
        }
    };
}

socket.on('settings', (settings) => {
    if (settingReconnectDelay) settingReconnectDelay.value = settings.reconnectDelay || 5000;
    if (settingGlobalAnalytics) settingGlobalAnalytics.checked = settings.globalAnalytics !== false;
    if (settingDashboardFont) {
        document.documentElement.style.setProperty('--dashboard-font', settings.dashboardFont || "'Comfortaa', cursive");
        settingDashboardFont.value = settings.dashboardFont || "'Comfortaa', cursive";
    }
    if (settings && settings.lowPerformanceMode !== undefined) {
        const lowPerfCheckbox = document.getElementById('settingLowPerformance');
        if (lowPerfCheckbox) lowPerfCheckbox.checked = settings.lowPerformanceMode;
        if (settings.lowPerformanceMode) {
            document.body.classList.add('low-perf');
            lowPerformanceEnabled = true;
        } else {
            document.body.classList.remove('low-perf');
            lowPerformanceEnabled = false;
        }
    }
    if (settings && settings.proxyList !== undefined) {
        const proxyListEl = document.getElementById('settingProxyList');
        if (proxyListEl) {
            proxyListEl.value = settings.proxyList;
            updateProxyCount();
        }
    }

    function updateProxyCount() {
        const textarea = document.getElementById('settingProxyList');
        const display = document.getElementById('proxyCount');
        if (!textarea || !display) return;
        
        const text = textarea.value.trim();
        if (!text) {
            display.innerText = '(0 proxies)';
            return;
        }
        const proxies = text.split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0);
        display.innerText = `(${proxies.length} proxies)`;
    }

    const globalProxyListEl = document.getElementById('settingProxyList');
    if (globalProxyListEl) {
        globalProxyListEl.addEventListener('input', updateProxyCount);
    }
    if (settings && settings.globalFriends !== undefined) {
        const friendsEl = document.getElementById('settingGlobalFriends');
        if (friendsEl) friendsEl.value = settings.globalFriends.join(', ');
    }
    if (settings && settings.autoAuthRegister !== undefined) {
        const autoAuthRegEl = document.getElementById('settingAutoAuthRegister');
        if (autoAuthRegEl) autoAuthRegEl.value = settings.autoAuthRegister;
    }
    if (settings && settings.autoAuthLogin !== undefined) {
        const autoAuthLogEl = document.getElementById('settingAutoAuthLogin');
        if (autoAuthLogEl) autoAuthLogEl.value = settings.autoAuthLogin;
    }
    if (settings && settings.randomProxy !== undefined) {
        const randomProxyEl = document.getElementById('settingRandomProxy');
        if (randomProxyEl) randomProxyEl.checked = settings.randomProxy;
    }
    if (settings && settings.watchlist) {
        watchlist = settings.watchlist;
        renderWatchlist();
    }
});

const bulkSelectAll = document.getElementById('bulkSelectAll');
const bulkDeselectAll = document.getElementById('bulkDeselectAll');
const bulkNavBtn = document.getElementById('bulkNavBtn');
const bulkChatBtn = document.getElementById('bulkChatBtn');
const bulkSpammerToggleBtn = document.getElementById('bulkSpammerToggleBtn');
const bulkReconnectBtn = document.getElementById('bulkReconnectBtn');
const bulkDisconnectBtn = document.getElementById('bulkDisconnectBtn');
const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');

if (bulkSelectAll) {
    bulkSelectAll.onclick = () => {
        bots.forEach(bot => selectedBots.add(bot.username));
        document.querySelectorAll('.bot-item').forEach(item => item.classList.add('selected'));
        updateSelectedCount();
    };
}

if (bulkDeselectAll) {
    bulkDeselectAll.onclick = () => {
        selectedBots.clear();
        document.querySelectorAll('.bot-item').forEach(item => item.classList.remove('selected'));
        updateSelectedCount();
    };
}

if (bulkNavBtn) {
    bulkNavBtn.onclick = () => {
        if (selectedBots.size === 0) return showNotification('No bots selected', 'error');
        const x = parseFloat(document.getElementById('bulkNavX').value);
        const y = parseFloat(document.getElementById('bulkNavY').value);
        const z = parseFloat(document.getElementById('bulkNavZ').value);

        if (isNaN(x) || isNaN(y) || isNaN(z)) return showNotification('Invalid coordinates', 'error');

        socket.emit('bulkAction', {
            usernames: Array.from(selectedBots),
            action: 'move',
            payload: { x, y, z }
        });
        showNotification(`Bulk move sent to ${selectedBots.size} bots`, 'info');
    };
}

if (bulkReconnectBtn) {
    bulkReconnectBtn.onclick = () => {
        if (selectedBots.size === 0) return showNotification('No bots selected', 'error');
        socket.emit('bulkAction', { usernames: Array.from(selectedBots), action: 'rejoin' });
    };
}

if (bulkDisconnectBtn) {
    bulkDisconnectBtn.onclick = () => {
        if (selectedBots.size === 0) return showNotification('No bots selected', 'error');
        if (confirm(`Disconnect ${selectedBots.size} bots?`)) {
            socket.emit('bulkAction', { usernames: Array.from(selectedBots), action: 'stop' });
        }
    };
}

if (bulkDeleteBtn) {
    bulkDeleteBtn.onclick = () => {
        if (selectedBots.size === 0) return showNotification('No bots selected', 'error');
        if (confirm(`PERMANENTLY DELETE ${selectedBots.size} bots? This cannot be undone.`)) {
            socket.emit('bulkDelete', Array.from(selectedBots));
            selectedBots.clear();
            updateSelectedCount();
            document.querySelectorAll('.bot-item.selected').forEach(el => el.classList.remove('selected'));
        }
    };
}

if (bulkChatBtn) {
    bulkChatBtn.onclick = () => {
        if (selectedBots.size === 0) return showNotification('No bots selected', 'error');
        const msg = document.getElementById('bulkChatInput').value;
        if (!msg) return showNotification('Message cannot be empty', 'warning');

        socket.emit('bulkAction', { usernames: Array.from(selectedBots), action: 'chat', payload: { message: msg } });
        document.getElementById('bulkChatInput').value = '';
        showNotification(`Bulk chat sent to ${selectedBots.size} bots`, 'info');
    };
}

const bulkSequentialChatBtn = document.getElementById('bulkSequentialChatBtn');
if (bulkSequentialChatBtn) {
    bulkSequentialChatBtn.onclick = () => {
        if (selectedBots.size === 0) return showNotification('No bots selected', 'error');
        const msg = document.getElementById('bulkSequentialChatInput').value.trim();
        if (!msg) return showNotification('Message cannot be empty', 'warning');

        socket.emit('bulkSequentialChat', {
            usernames: Array.from(selectedBots),
            message: msg
        });
        document.getElementById('bulkSequentialChatInput').value = '';
        showNotification(`Sequential chat chain started with ${selectedBots.size} bots`, 'info');
    };
}

if (bulkSpammerToggleBtn) {
    bulkSpammerToggleBtn.onclick = () => {
        if (selectedBots.size === 0) return showNotification('No bots selected', 'error');

        socket.emit('bulkAction', { usernames: Array.from(selectedBots), action: 'toggleSpammer' });
        showNotification(`Toggled spammer for ${selectedBots.size} bots`, 'info');
    };
}

socket.on('botRemoved', (username) => {
    selectedBots.delete(username);
    updateSelectedCount();
});

// Password Visibility Toggle
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-password-btn');
    if (!btn) return;

    e.preventDefault();
    const wrapper = btn.closest('.password-input-wrapper');
    const input = wrapper.querySelector('input');
    const eyeIcon = btn.querySelector('.eye-icon');
    const eyeOffIcon = btn.querySelector('.eye-off-icon');

    if (input.type === 'password') {
        input.type = 'text';
        eyeIcon.style.display = 'none';
        eyeOffIcon.style.display = 'block';
    } else {
        input.type = 'password';
        eyeIcon.style.display = 'block';
        eyeOffIcon.style.display = 'none';
    }
});


// Proxy Tools Management
const checkProxiesBtn = document.getElementById('checkProxiesBtn');
const scrapeProxiesBtn = document.getElementById('scrapeProxiesBtn');
const filterDeadProxiesBtn = document.getElementById('filterDeadProxiesBtn');
const proxyListTextarea = document.getElementById('settingProxyList');

let lastProxyCheckResults = [];
let isCheckingProxies = false;
let validProxyCount = 0;

if (checkProxiesBtn) {
    checkProxiesBtn.onclick = (e) => {
        try {
            e.preventDefault();
            const textarea = document.getElementById('settingProxyList');
            if (!textarea) return showNotification('Internal Error: Proxy List textarea not found.', 'error');

            if (isCheckingProxies) {
                socket.emit('botAction', { action: 'stopCheckProxies' });
                isCheckingProxies = false;
                checkProxiesBtn.disabled = false;
                checkProxiesBtn.innerText = 'Check Status';
                return;
            }
            const text = textarea.value.trim();
            const rawProxies = text.split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0);
            const proxies = [];
            for (const p of rawProxies) {
                if (p.includes('://')) {
                    proxies.push(p);
                } else {
                    const parts = p.split(':');
                    if (parts.length === 4) {
                        proxies.push(`socks5://${encodeURIComponent(parts[2])}:${encodeURIComponent(parts[3])}@${parts[0]}:${parts[1]}`);
                    } else if (parts.length === 2) {
                        proxies.push(`socks5://${parts[0]}:${parts[1]}`);
                    }
                }
            }
            
            if (proxies.length === 0) {
                return showNotification('No valid proxies found in list.', 'warning');
            }

            isCheckingProxies = true;
            validProxyCount = 0;
            checkProxiesBtn.innerText = 'Checking...';
            socket.emit('botAction', { 
                action: 'checkProxies', 
                payload: { proxies }
            });
            showNotification(`Checking status of ${proxies.length} proxies...`, 'info');
        } catch (err) {
            console.error('Proxy check button error:', err);
            showNotification('An error occurred while starting the check.', 'error');
        }
    };
}

socket.on('proxyCheckProgress', (progress) => {
    if (progress.lastResult && progress.lastResult.status === 'online') {
        validProxyCount++;
    }
    checkProxiesBtn.innerText = `Stop Check (${progress.current}/${progress.total}) - Valid: ${validProxyCount}`;
});

socket.on('proxyCheckResults', (results) => {
    lastProxyCheckResults = results;
    isCheckingProxies = false;
    const onlineProxies = results.filter(r => r.status === 'online').map(r => r.url);
    const deadCount = results.length - onlineProxies.length;
    
    checkProxiesBtn.disabled = false;
    checkProxiesBtn.innerText = 'Check Status';
    
    if (deadCount > 0) {
        proxyListTextarea.value = onlineProxies.join('\n');
        showNotification(`Check Finished: ${onlineProxies.length} Online. Auto-removed ${deadCount} dead proxies!`, onlineProxies.length > 0 ? 'success' : 'warning');
        
        // Auto-save the pristine list
        socket.emit('saveSettings', { proxyList: onlineProxies.join('\n') });
        
        filterDeadProxiesBtn.style.display = 'none';
        lastProxyCheckResults = [];
    } else {
        showNotification(`Check Finished: All ${onlineProxies.length} proxies are Online!`, 'success');
        filterDeadProxiesBtn.style.display = 'none';
    }
});

if (scrapeProxiesBtn) {
    scrapeProxiesBtn.onclick = (e) => {
        e.preventDefault();
        scrapeProxiesBtn.disabled = true;
        scrapeProxiesBtn.innerText = 'Scraping...';
        socket.emit('botAction', { action: 'scrapeProxies' });
        showNotification('Scraping free proxies from online sources...', 'info');
    };
}

socket.on('proxyScrapeProgress', (progress) => {
    if (progress.status === 'scraping') {
        scrapeProxiesBtn.innerText = `Scraping ${progress.source.toUpperCase()}...`;
    } else if (progress.status === 'completed') {
        showNotification(`Found ${progress.count} ${progress.source.toUpperCase()} proxies. Total: ${progress.totalSoFar}`, 'success');
    } else if (progress.status === 'failed') {
        showNotification(`Failed to scrape ${progress.source.toUpperCase()}: ${progress.error}`, 'error');
    }
});

socket.on('proxyScrapeResults', (proxies) => {
    scrapeProxiesBtn.disabled = false;
    scrapeProxiesBtn.innerText = 'Scrape Free';

    if (proxies.length > 0) {
        const currentText = proxyListTextarea.value.trim();
        proxyListTextarea.value = (currentText ? currentText + '\n' : '') + proxies.join('\n');
        showNotification(`Successfully scraped ${proxies.length} proxies!`, 'success');
    } else {
        showNotification('Failed to scrape any new proxies.', 'error');
    }
});

if (filterDeadProxiesBtn) {
    filterDeadProxiesBtn.onclick = (e) => {
        e.preventDefault();
        if (lastProxyCheckResults.length === 0) return;
        
        const workingProxies = lastProxyCheckResults
            .filter(r => r.status === 'online')
            .map(r => r.url);
            
        proxyListTextarea.value = workingProxies.join('\n');
        filterDeadProxiesBtn.style.display = 'none';
        showNotification(`${lastProxyCheckResults.length - workingProxies.length} dead proxies removed from list.`, 'success');
        lastProxyCheckResults = [];
    };
}
