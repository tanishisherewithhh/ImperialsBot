export default class AutoCaptcha {
    constructor() {
        this.name = 'AutoCaptcha';
        this.description = 'Automatically solves common bot protections (links, inventory clicking, math/chat commands).';
        this.color = 'a';

        this.settings = {
            solveLinks: { type: 'boolean', label: 'Solve Link Captchas', value: true },
            solveInventory: { type: 'boolean', label: 'Solve Inventory Captchas', value: true },
            solveChat: { type: 'boolean', label: 'Solve Chat/Math Captchas', value: true }
        };
    }

    init(bot, api) {
        this.bot = bot;
        this.api = api;
    }

    enable() {
        this.api.on('messagestr', (msg) => this.handleChat(msg));
        this.api.on('windowOpen', (window) => this.handleWindow(window));
    }

    onConfigUpdate(newConfig) {
        for (const [key, val] of Object.entries(newConfig)) {
            if (this.settings[key]) {
                this.settings[key].value = val;
            }
        }
    }

    async handleChat(msg) {
        if (this.settings.solveLinks.value) {
            const linkRegex = /(https?:\/\/[^\s]+)/;
            const match = msg.match(linkRegex);
            if (match) {
                const url = match[1];
                if (url.toLowerCase().includes('captcha') || url.toLowerCase().includes('verify') || msg.toLowerCase().includes('click')) {
                    this.api.log(`[AutoCaptcha] Detected link captcha: ${url}`, 'info');
                    try {
                        const response = await fetch(url);
                        this.api.log(`[AutoCaptcha] Successfully fetched link. Status: ${response.status}`, 'success');
                    } catch (err) {
                        this.api.log(`[AutoCaptcha] Failed to fetch link: ${err.message}`, 'error');
                    }
                }
            }
        }

        if (this.settings.solveChat.value) {
            const mathMatch = msg.match(/(\d+)\s*([\+\-\*])\s*(\d+)/);
            if (mathMatch && (msg.toLowerCase().includes('solve') || msg.toLowerCase().includes('what is') || msg.toLowerCase().includes('calculate'))) {
                const num1 = parseInt(mathMatch[1]);
                const op = mathMatch[2];
                const num2 = parseInt(mathMatch[3]);
                let ans = 0;
                if (op === '+') ans = num1 + num2;
                if (op === '-') ans = num1 - num2;
                if (op === '*') ans = num1 * num2;

                this.api.log(`[AutoCaptcha] Solving math captcha: ${num1} ${op} ${num2} = ${ans}`, 'success');
                this.api.chat(ans.toString());
                return;
            }

            const wordMatch = msg.match(/type\s+['"“]?([a-zA-Z0-9]+)['"”]?\s+in\s+chat/i) ||
                msg.match(/verification\s*code:?\s+([a-zA-Z0-9]+)/i);

            if (wordMatch) {
                const word = wordMatch[1];
                this.api.log(`[AutoCaptcha] Solved text captcha, echoing: ${word}`, 'success');
                this.api.chat(word);
            }
        }
    }

    async handleWindow(window) {
        if (!this.settings.solveInventory.value) return;

        let rawTitle = window.title || '';
        if (typeof rawTitle === 'object') {
            try {
                const parsed = JSON.parse(window.title);
                rawTitle = parsed.text || parsed.translate || JSON.stringify(window.title);
            } catch (e) {
                rawTitle = String(window.title);
            }
        }

        const title = rawTitle.toLowerCase();

        if (title.includes('captcha') || title.includes('verify') || title.includes('click the')) {
            this.api.log(`[AutoCaptcha] Detected inventory captcha: ${title}`, 'info');

            let targetMaterial = null;
            const clickMatch = title.match(/click the ([a-z_ ]+)/);
            if (clickMatch) {
                targetMaterial = clickMatch[1].replace(' ', '_');
            }

            const items = window.items();
            if (items.length === 0) return;

            let itemToClick = null;

            if (targetMaterial) {
                itemToClick = items.find(item => item.name.includes(targetMaterial) || (item.displayName && item.displayName.toLowerCase().includes(targetMaterial)));
            }

            if (!itemToClick) {
                const itemCounts = {};
                for (let item of items) {
                    itemCounts[item.name] = (itemCounts[item.name] || 0) + 1;
                }

                const uniqueItemName = Object.keys(itemCounts).find(name => itemCounts[name] === 1);
                if (uniqueItemName) {
                    itemToClick = items.find(item => item.name === uniqueItemName);
                }
            }

            if (itemToClick) {
                this.api.log(`[AutoCaptcha] Clicking item: ${itemToClick.name}`, 'success');
                try {
                    await this.bot.clickWindow(itemToClick.slot, 0, 0);
                } catch (e) {
                    this.api.log(`[AutoCaptcha] Failed to click: ${e.message}`, 'error');
                }
            } else {
                this.api.log(`[AutoCaptcha] Could not deduce which item to click.`, 'warning');
            }
        }
    }
}
