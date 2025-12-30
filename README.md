# ImperialBot

ImperialBot is a multi-bot manager for Minecraft with a web dashboard. It uses [Mineflayer](https://github.com/PrismarineJS/mineflayer) to handle bot logic and allows you to control several bots at once through a browser.

---

### How it works

The project is split into a few main parts:

1.  **Bot Manager**: Handles the lifecycle of your bots.
2.  **Web Server**: Uses Socket.io to talk to the dashboard in real-time.
3.  **Features**: Built-in logic like Killaura and AutoEat.
4.  **Plugins**: A system for adding your own scripts without touching the core code.

---

### Plugin System

You can add custom logic by placing JavaScript files in the `src/plugins/` folder. The bot will automatically detect new files and reload them while the server is running. Every plugin gets access to a simple API for logging and sending chat messages, which allows you to directly sent messages to the chat box on dashboard.

> There is [ExamplePlugin.js](https://github.com/tanishisherewithhh/ImperialsBot/blob/main/ExamplePlugin.js) that explains the structure and API of plugins in more detail.

#### Example: Custom Command Plugin

This example shows how to make a bot respond to a `!help` command:

```javascript
export default class HelpPlugin {
    constructor() {
        this.name = 'HelpPlugin';
        this.description = 'Responds to !help and other commands';
        this.enabled = true;
        this.color = 'a'; // Green color in logs
    }

    init(bot, api) {
        this.bot = bot;
        this.api = api;

        this.bot.on('chat', (username, message) => {
            if (!this.enabled) return;
            if (username === this.bot.username) return;

            const msg = message.toLowerCase();

            if (msg === '!help') {
                this.api.log(`Responding to help request from ${username}`, 'info');
                this.bot.chat(`Hello ${username}! Available commands: !help, !info`);
            } else if (msg === '!info') {
                this.bot.chat(`ImperialBot Instance v3.0`);
            }
        });
    }

    enable() {
        this.enabled = true;
        this.api.log('Plugin enabled.', 'success');
    }

    disable() {
        this.enabled = false;
        this.api.log('Plugin disabled.', 'warning');
    }
}
```

---

### Getting Started

1.  Make sure you have [Node.js](https://nodejs.org/) installed.
2.  Run `start.bat` / 'start.sh' to install dependencies and start the server.
3.  Go to `http://localhost:PORT` (default port :3000), in your browser.

For more details on what the bots can do, check the [Mineflayer Documentation](https://github.com/PrismarineJS/mineflayer/blob/master/docs/api.md).

---

### License
This project is licensed under the GNU General Public License v3.

**Author**: tanishisherewith
