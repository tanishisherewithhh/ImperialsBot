const socket = io();

// State
let currentBot = null;
let currentTab = 'controls'; // controls, inventory, viewer
let bots = new Map();
let activeKeys = new Set();
let spammerEnabled = false;

// Key Mapping
const keyMap = {
    'w': 'forward',
    's': 'back',
    'a': 'left',
    'd': 'right',
    ' ': 'jump',
    'shift': 'sneak',
    'control': 'sprint'
};

// Utils
function isTyping() {
    const el = document.activeElement;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

// Elements
const botList = document.getElementById('botList');
const connectionStatus = document.getElementById('connectionStatus');
const viewerContainer = document.getElementById('viewerContainer');
const inventoryGridEl = document.getElementById('inventoryGrid');
const chatBox = document.getElementById('chatBox');
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
const rejoinBtn = document.getElementById('rejoinBtn');

// Modals
const addBotModal = document.getElementById('addBotModal');
const editBotModal = document.getElementById('editBotModal');
const addBotBtn = document.getElementById('addBotBtn');
const cancelAddBot = document.getElementById('cancelAddBot');
const cancelEditBot = document.getElementById('cancelEditBot');
const addBotForm = document.getElementById('addBotForm');
const editBotForm = document.getElementById('editBotForm');
const chatForm = document.getElementById('chatForm');

if (chatForm) {
    chatForm.onsubmit = (e) => {
        e.preventDefault();
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (text && currentBot) {
            socket.emit('botAction', { username: currentBot, action: 'chat', payload: { message: text } });
            input.value = '';
        } else if (!currentBot) {
            showNotification('Select a bot to chat', 'warning');
        }
    };
}

// Notifications
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

// ----------------------
// Socket Events
// ----------------------

socket.on('connect', () => {
    connectionStatus.style.background = '#22c55e'; // Green
    connectionStatus.title = 'Connected to Server';
    loadingOverlay.classList.remove('active');
});

socket.on('disconnect', () => {
    connectionStatus.style.background = '#ef4444'; // Red
    connectionStatus.title = 'Disconnected';
    loadingOverlay.classList.add('active');
});

socket.on('botList', (data) => {
    botList.innerHTML = '';
    data.forEach(bot => {
        bots.set(bot.username, bot);
        const item = document.createElement('div');
        item.className = `bot-item compact ${currentBot === bot.username ? 'active' : ''}`;

        // Select bot on click (unless clicking action button)
        item.onclick = (e) => {
            if (!e.target.closest('.btn-icon')) {
                selectBot(bot.username);
            }
        };

        const statusClass = bot.status === 'online' ? 'online' : (bot.status === 'offline' ? 'offline' : 'connecting');

        // Compact Layout: Avatar | Name | StatusDot | EditButton | DeleteButton
        item.innerHTML = `
            <div class="bot-avatar small" style="background-image: url('https://mc-heads.net/avatar/${bot.username}')"></div>
            <div class="bot-name" style="flex: 1; margin: 0 8px; font-size: 0.9rem;">${bot.username}</div>
            <div class="bot-status-indicator ${statusClass}" style="margin-right: 8px;"></div>
            <div style="display: flex; gap: 4px;">
                <button class="btn-icon small" data-action="edit" title="Edit Bot">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn-icon small delete" data-action="delete-item" title="Delete Bot">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;

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

    if (!currentBot && data.length > 0) {
        selectBot(data[0].username);
    } else if (currentBot) {
        // Update View Mode Label for current bot
        const bot = bots.get(currentBot);
        if (bot && viewModeBtn) {
            viewModeBtn.innerText = bot.config.firstPerson ? 'Third Person' : 'First Person';
        }
    }
});

socket.on('logs', (payload) => {
    if (currentBot !== payload.username) return;
    const { message, type } = payload;

    const div = document.createElement('div');
    div.className = `chat-message ${type}`;

    // Formatting
    // Formatting
    const time = new Date().toLocaleTimeString();

    // Safe text handling with Color Code Parsing
    const timeSpan = document.createElement('span');
    timeSpan.style.opacity = '0.5';
    timeSpan.style.fontSize = '0.8em';
    timeSpan.innerText = `[${time}] `;

    div.appendChild(timeSpan);

    const formattedMessage = document.createElement('span');
    formattedMessage.innerHTML = formatMinecraftText(message);
    div.appendChild(formattedMessage);

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
});

// Helper: Parse Minecraft § codes to HTML
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
    // payload: { username, status: 'Online' | 'Offline' | ... }
    const { username, status } = payload;

    // Update local state
    if (bots.has(username)) {
        bots.get(username).status = status.toLowerCase();
    }

    // Update Header if current
    if (currentBot === username) {
        document.getElementById('botStatus').innerText = status;
        document.getElementById('botStatus').className = `status-indicator ${status.toLowerCase()}`;
    }

    // Update List Dot
    // Find the item by iterating or by ID (we don't have IDs on items yet, so strict matching name)
    const items = botList.querySelectorAll('.bot-item');
    items.forEach(item => {
        const nameEl = item.querySelector('.bot-name');
        if (nameEl && nameEl.innerText === username) {
            const dot = item.querySelector('.bot-status-indicator');
            if (dot) {
                // remove old status classes
                dot.classList.remove('online', 'offline', 'connecting');
                // add new
                const s = status.toLowerCase();
                if (s === 'online' || s === 'offline' || s === 'connecting') {
                    dot.classList.add(s);
                } else {
                    dot.classList.add('connecting'); // Default for other statuses
                }
            }
        }
    });
});

socket.on('botData', (payload) => {
    // payload: { username, data: { position, health, food, yaw, pitch } }
    if (currentBot !== payload.username) return;
    const data = payload.data;

    console.log('Bot Data:', data); // Debug

    if (data.health !== undefined) {
        const healthStat = document.getElementById('healthStat');
        if (healthStat) healthStat.innerText = Math.round(data.health);
    }
    if (data.food !== undefined) {
        const foodStat = document.getElementById('foodStat');
        if (foodStat) foodStat.innerText = Math.round(data.food);
    }
    if (data.position) {
        const posStat = document.getElementById('posStat');
        if (posStat) posStat.innerText = `${data.position.x.toFixed(0)}, ${data.position.y.toFixed(0)}, ${data.position.z.toFixed(0)}`;
    }
    if (data.yaw !== undefined && document.activeElement !== yawSlider) {
        yawSlider.value = data.yaw;
        if (yawVal) yawVal.innerText = trim(data.yaw);
    }
    if (data.pitch !== undefined && document.activeElement !== pitchSlider) {
        pitchSlider.value = data.pitch;
        pitchVal.innerText = trim(data.pitch);
    }
});

function trim(num) {
    return Number(num).toFixed(2);
}

socket.on('botInventory', (payload) => {
    // payload: { username, items }
    if (currentBot !== payload.username) return;
    if (currentTab === 'inventory') {
        renderInventory(payload.items, payload.version);
    }
});

socket.on('botPlayers', (payload) => {
    if (currentBot !== payload.username) return;
    renderPlayerList(payload.players || []);
});

function renderPlayerList(players) {
    const playerList = document.getElementById('playerList');
    const playerCount = document.getElementById('playerCount');

    if (playerCount) playerCount.innerText = players.length;
    if (!playerList) return;

    // Smart Render: Update existing, Add new, Remove old
    const existingEls = new Map();
    playerList.querySelectorAll('.player-item').forEach(el => {
        existingEls.set(el.dataset.username, el);
    });

    const activeUsernames = new Set();

    players.forEach(p => {
        activeUsernames.add(p.username);
        let el = existingEls.get(p.username);

        if (el) {
            // Update existing
            const pingEl = el.querySelector('.ping-text');
            if (pingEl && pingEl.innerText !== `${p.ping}ms`) {
                pingEl.innerText = `${p.ping}ms`;
            }
        } else {
            // Create new
            el = document.createElement('div');
            el.className = 'player-item';
            el.dataset.username = p.username;
            el.style.cssText = 'display:flex; align-items:center; gap:8px; padding:4px; animate: fadeIn 0.2s;';
            el.innerHTML = `
                <span style="flex:1;">${p.username}</span>
                <span class="ping-text" style="color:var(--text-muted); font-size:0.8rem;">${p.ping}ms</span>
            `;
            playerList.appendChild(el);
        }
    });

    // Remove old items
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
        // Compare with last known server state (ignore re-broadcasts)
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

socket.on('notification', (data) => {
    console.log('Notification:', data);
    showNotification(data.message, data.type);
});


// ----------------------
// Bot Selection
// ----------------------

function selectBot(username) {
    currentBot = username;
    lastSpammerConfigStr = ''; // Reset spammer cache to force UI update

    // Update UI active state
    document.querySelectorAll('.bot-item').forEach(el => {
        if (el.innerText.includes(username)) el.classList.add('active');
        else el.classList.remove('active');
    });

    chatBox.innerHTML = '';
    const welcome = document.createElement('div');
    welcome.className = 'chat-message info';
    welcome.innerText = `Switched to ${username} `;
    chatBox.appendChild(welcome);

    const botNameHeader = document.getElementById('currentBotName');
    if (botNameHeader) botNameHeader.innerText = username;

    socket.emit('requestBotData', { username });
}

function updateViewer(port) {
    if (!port) return;
    const viewerFrame = viewerContainer.querySelector('iframe');
    const newSrc = `http://localhost:${port}`;
    if (!viewerFrame) {
        viewerContainer.innerHTML = `<iframe src="${newSrc}" style="width:100%; height:100%; border:none;"></iframe>`;
    } else if (viewerFrame.src !== newSrc) {
        viewerFrame.src = newSrc;
    }
}

socket.on('botViewer', (data) => {
    // Update config locally
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
    // Correctly handle packaged payload
    const username = payload.username;
    const history = payload.history;

    if (currentBot !== username) return; // Prevent state bleeding

    chatBox.innerHTML = '';
    const welcome = document.createElement('div');
    welcome.className = 'chat-message info';
    welcome.innerText = `Switched to ${username}`;
    chatBox.appendChild(welcome);

    history.forEach(msg => {
        renderChatMessage(msg);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on('botChat', (payload) => {
    // payload: { username, message, sender }
    if (currentBot !== payload.username) return;

    // UI-side deduplication
    const lastMsg = chatBox.lastElementChild;
    const now = Date.now();
    if (lastMsg && lastMsg.dataset.rawMessage === payload.message) {
        const lastTime = parseInt(lastMsg.dataset.timestamp);
        if ((now - lastTime) < 500) return; // Skip duplicate
    }

    const msgObj = {
        message: payload.message,
        type: 'chat',
        timestamp: now
    };
    renderChatMessage(msgObj);
    chatBox.scrollTop = chatBox.scrollHeight;
});

function renderChatMessage(msg) {
    const div = document.createElement('div');
    div.className = `chat-message ${msg.type || 'info'}`;

    // Store metadata for deduplication
    div.dataset.rawMessage = msg.message;
    div.dataset.timestamp = msg.timestamp || Date.now();

    const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();

    const timeSpan = document.createElement('span');
    timeSpan.style.opacity = '0.5';
    timeSpan.style.fontSize = '0.8em';
    timeSpan.innerText = `[${time}] `;
    div.appendChild(timeSpan);

    const textSpan = document.createElement('span');
    textSpan.innerHTML = formatMinecraftText(msg.message);
    div.appendChild(textSpan);

    chatBox.appendChild(div);
}
// Or if msg has timestamp? It probably doesn't currently.


// ----------------------
// Tabs
// ----------------------
tabBtns.forEach(btn => {
    btn.onclick = () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
        currentTab = btn.dataset.tab;

        // Refresh data if needed
        if (currentTab === 'inventory' && currentBot) {
            // Maybe request inventory update?
            // socket.emit('getInventory', currentBot);
        }
    };
});

// ----------------------
// Modals
// ----------------------
addBotBtn.onclick = () => {
    addBotModal.classList.add('active');
};
window.toggleRealmsFields = function (select, prfx) {
    const isRealms = select.value === 'realms';
    document.getElementById(`${prfx}ServerFields`).style.display = isRealms ? 'none' : 'block';
    document.getElementById(`${prfx}RealmsFields`).style.display = isRealms ? 'block' : 'none';
};

cancelAddBot.onclick = () => {
    addBotModal.classList.remove('active');
};

window.onclick = (e) => {
    if (e.target === addBotModal) addBotModal.classList.remove('active');
    if (e.target === editBotModal) editBotModal.classList.remove('active');
};

addBotForm.onsubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(addBotForm);
    const data = Object.fromEntries(formData.entries());

    // Connection Logic
    if (data.connectionType === 'realms') {
        data.realms = {
            [data.realmType === 'id' ? 'realmId' : (data.realmType === 'name' ? 'realmName' : 'realmInvite')]: data.realmIdentifier
        };
        // Clear host/port for realms
        data.host = '';
        data.port = 0;
    }

    // Fix types
    data.port = parseInt(data.port) || 0;
    data.firstPerson = formData.get('firstPerson') === 'on';
    data.autoReconnect = formData.get('autoReconnect') === 'on';
    data.registerConfirm = formData.get('registerConfirm') === 'on';

    socket.emit('createBot', data);
    addBotModal.classList.remove('active');
    addBotForm.reset();
    // Reset fields visibility
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
    if (form.webhookUrl) form.webhookUrl.value = bot.config.webhookUrl || '';

    // Realms logic
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

    // Connection Logic
    if (data.connectionType === 'realms') {
        data.realms = {
            [data.realmType === 'id' ? 'realmId' : (data.realmType === 'name' ? 'realmName' : 'realmInvite')]: data.realmIdentifier
        };
        data.host = '';
        data.port = 0;
    } else {
        data.realms = null; // Clear if switching back
    }

    data.port = parseInt(data.port) || 0;
    data.firstPerson = formData.get('firstPerson') === 'on';
    data.autoReconnect = formData.get('autoReconnect') === 'on';
    data.registerConfirm = formData.get('registerConfirm') === 'on';

    socket.emit('editBot', data);
    editBotModal.classList.remove('active');
};

cancelEditBot.onclick = () => {
    editBotModal.classList.remove('active');
};
// Inventory
// ----------------------
function renderInventory(items, version = '1.20.1') {
    // 1. Initialize Grid (45 slots: 36 Main + 4 Armor + 1 Offhand + Crafting?)
    // Standard player inventory is 0-8 (hotbar), 9-35 (storage), 36-39 (armor), 40 (offhand), 41-44 (crafting)
    const TOTAL_SLOTS = 45;

    if (inventoryGridEl.childElementCount !== TOTAL_SLOTS) {
        inventoryGridEl.innerHTML = '';
        for (let i = 0; i < TOTAL_SLOTS; i++) {
            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            slot.dataset.slotId = i;

            const img = document.createElement('img');
            img.style.display = 'none';
            slot.appendChild(img);

            const count = document.createElement('span');
            count.className = 'inv-count';
            slot.appendChild(count);

            inventoryGridEl.appendChild(slot);
        }
    }

    // 2. Create Map of New Data
    const itemMap = new Map();
    items.forEach(item => itemMap.set(item.slot, item));

    const slots = inventoryGridEl.children;
    for (let i = 0; i < TOTAL_SLOTS; i++) {
        const slotEl = slots[i];
        const imgEl = slotEl.querySelector('img');
        const countEl = slotEl.querySelector('.inv-count');

        const newItem = itemMap.get(i);
        const signature = newItem ? `${newItem.name}:${newItem.count} ` : 'empty';

        if (slotEl.dataset.signature === signature) {
            continue; // No change
        }

        // Update Slot
        slotEl.dataset.hasItem = 'true';
        slotEl.dataset.signature = signature;
        slotEl.title = newItem ? newItem.displayName : ''; // Full Name Tooltip

        if (!newItem) {
            imgEl.style.display = 'none';
            countEl.textContent = '';
            slotEl.removeAttribute('data-has-item');
            continue;
        }

        countEl.textContent = newItem.count > 1 ? newItem.count : '';

        const assetVersion = version || '1.21.4';
        const iconUrl = `https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/${assetVersion}/items/${newItem.name}.png`;
        const blockUrl = `https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/${assetVersion}/blocks/${newItem.name}.png`;


        imgEl.style.display = 'block';
        if (imgEl.dataset.srcName !== newItem.name) {
            imgEl.dataset.srcName = newItem.name;
            imgEl.src = iconUrl;
            imgEl.onerror = () => {
                if (imgEl.src === iconUrl) {
                    imgEl.src = blockUrl;
                } else {
                    //imgEl.style.display = 'none';
                }
            };
        }
    }
}

// ----------------------
// Chat
// ----------------------
chatInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
        if (!currentBot) {
            showNotification('Please select a bot first');
            return;
        }
        const text = chatInput.value;
        if (text.trim()) {
            socket.emit('botAction', {
                username: currentBot,
                action: 'chat',
                payload: { message: text }
            });
            chatInput.value = '';
        }
    }
};


// ----------------------
// Spammer
// ----------------------
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

addSpamMsgBtn.onclick = () => addSpammerInput('ImperialsBot OP');

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
                // Determine if we should clear or append. 
                // User said "import... with every new line", usually implies loading a config.
                // Let's clear existing sample "ImperialsBot OP" if it's the only one, otherwise append.
                // Actually, safer to just append to avoid data loss.
                lines.forEach(line => addSpammerInput(line));
                showNotification(`Imported ${lines.length} messages`, 'success');
            } else {
                showNotification('File is empty', 'warning');
            }
            importSpamFile.value = ''; // Reset
        };
        reader.readAsText(file);
    };
}

// Feature Toggles
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

socket.on('botToggles', (data) => {
    if (currentBot !== data.username) return;

    // Helper to update btn state
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
    updateBtn(spammerBtn, data.spammerEnabled, 'Spammer');
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
                delay: parseInt(spammerDelay.value),
                order: spammerOrder.value,
                appendRandom: spammerAppend.checked,
                randomLength: parseInt(spammerLen.value)
            }
        }
    });
};



// ----------------------
// Bot Actions
// ----------------------
suicideBtn.onclick = () => {
    if (!currentBot) {
        showNotification('Please select a bot first');
        return;
    }
    if (confirm('Are you sure you want the bot to commit suicide?')) {
        socket.emit('botAction', { username: currentBot, action: 'suicide', payload: {} });
    }
};

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
            yaw: parseFloat(yawSlider.value),
            pitch: parseFloat(pitchSlider.value)
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

    // Prevent Spacebar scrolling
    if (key === ' ') {
        e.preventDefault();
    }

    if (keyMap[key] && !activeKeys.has(key)) {
        const control = keyMap[key];
        activeKeys.add(key);
        highlightButton(control, true);
        sendControl(control, true);
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

// New Mouse & View Controls
const btnLeftClick = document.getElementById('btnLeftClick');
const btnRightClick = document.getElementById('btnRightClick');
const viewModeBtn = document.getElementById('viewModeBtn');

if (btnLeftClick) {
    btnLeftClick.onmousedown = () => {
        if (!currentBot) return;
        socket.emit('botAction', { username: currentBot, action: 'click', payload: { type: 'left' } });
        btnLeftClick.style.transform = 'scale(0.9)';
    };
    btnLeftClick.onmouseup = () => btnLeftClick.style.transform = 'scale(1)';
}

if (btnRightClick) {
    btnRightClick.onmousedown = () => {
        if (!currentBot) return;
        socket.emit('botAction', { username: currentBot, action: 'click', payload: { type: 'right' } });
        btnRightClick.style.transform = 'scale(0.9)';
    };
    btnRightClick.onmouseup = () => btnRightClick.style.transform = 'scale(1)';
}

if (viewModeBtn) {
    viewModeBtn.onclick = () => {
        if (!currentBot) return;
        socket.emit('botAction', { username: currentBot, action: 'toggleView' });
    };
}

const exportChatBtn = document.getElementById('exportChatBtn');
exportChatBtn.onclick = () => {
    if (!chatBox.innerText.trim()) {
        showNotification('No chat to export', 'error');
        return;
    }

    // Get text content processing
    let content = '';
    // Iterate over chat messages to format them nicely
    const messages = chatBox.querySelectorAll('.chat-message');
    messages.forEach(msg => {
        // Simple text extraction
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

// Theme Switching Logic (with View Transitions)
const themeSelect = document.getElementById('themeSelect');

socket.on('settings', (settings) => {
    if (settings && settings.theme) {
        document.body.className = settings.theme;
        themeSelect.value = settings.theme;
    }
});

themeSelect.onchange = (e) => {
    const newTheme = e.target.value;

    // View Transition API (Fall back if not supported)
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

// =========================================
// Visual Overhaul: Mouse Effects & Parallax
// =========================================

// 1. Spotlight Effect (Accumulated + Optimized)
let mouseX = 0, mouseY = 0;
let currentHoverResult = null;

document.addEventListener('mousemove', (e) => {
    // Parallax (Lightweight)
    const moveX = (e.clientX - window.innerWidth / 2) * 0.01;
    const moveY = (e.clientY - window.innerHeight / 2) * 0.01;
    document.body.style.setProperty('--parallax-x', `${moveX}px`);
    document.body.style.setProperty('--parallax-y', `${moveY}px`);

    // Spotlight (Efficient)
    const hoverable = e.target.closest('.btn, .card, .bot-item, .nav-input');
    if (hoverable) {
        const rect = hoverable.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        hoverable.style.setProperty('--mouse-x', `${x}px`);
        hoverable.style.setProperty('--mouse-y', `${y}px`);
    }
});

// Start update label
const spammerLenLabel = document.getElementById('spammerLenLabel');
if (spammerLen && spammerLenLabel) {
    spammerLen.addEventListener('input', () => {
        spammerLenLabel.textContent = `Anti-Spam Length: ${spammerLen.value}`;
    });
}

// Navigation Controls
const navToggleBtn = document.getElementById('navToggleBtn');
const navX = document.getElementById('navX');
const navY = document.getElementById('navY');
const navZ = document.getElementById('navZ');

let isNavigating = false;

if (navToggleBtn) {
    navToggleBtn.onclick = () => {
        if (!currentBot) return showNotification('Select a bot first');

        if (isNavigating) {
            // Stop logic
            socket.emit('botAction', {
                username: currentBot,
                action: 'stopNavigation',
                payload: {}
            });
            isNavigating = false;
            navToggleBtn.textContent = 'Go';
            navToggleBtn.className = 'nav-btn go';
        } else {
            // Start logic
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
// Listen for arrival/stop from server to reset button (optional but good)
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

// Global Settings Logic
const settingsModal = document.getElementById('settingsModal');
const settingsBtn = document.getElementById('settingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const settingsForm = document.getElementById('settingsForm');
const settingReconnectDelay = document.getElementById('settingReconnectDelay');

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
        if (!isNaN(delay)) {
            socket.emit('saveSettings', { reconnectDelay: delay });
            settingsModal.classList.remove('active');
            showNotification('Global settings saved!', 'success');
        }
    };
}

// Ensure settings are loaded into the form
socket.on('settings', (settings) => {
    if (settings && settings.reconnectDelay) {
        if (settingReconnectDelay) settingReconnectDelay.value = settings.reconnectDelay;
    }
});

// Close modal on outside click
window.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.remove('active');
    }
});
