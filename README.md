# ImperialBot

> [!IMPORTANT]
> **New to ImperialBot?** Check out our [User Guide](GUIDE.md) for setup instructions and troubleshooting tips.

---

ImperialBot is a tool for managing multiple Minecraft bots from a single web dashboard. It uses the [Mineflayer](https://github.com/PrismarineJS/mineflayer) engine to handle bot logic and allows you to control several accounts at once through your browser.

---

### Getting Started

1.  Make sure you have [Node.js](https://nodejs.org/) installed.
2.  Run `start.bat` (Windows) or `start.sh` (Linux) to install dependencies and start the server.
3.  Go to `http://localhost:3000` in your browser.

For more information on bot capabilities, see the [Mineflayer Documentation](https://github.com/PrismarineJS/mineflayer/blob/master/docs/api.md).

### Cloud Deployment

ImperialsBot can be deployed on cloud platforms like **Render.com**. Because cloud containers have ephemeral filesystems, the `IMPERIALS_CLOUD_MODE` environment variable enables:
- Bot config stored in environment variables (persists across restarts)
- Viewer/inventory via proxy routes on the main port

Set `IMPERIALS_CLOUD_MODE=true` in your Render environment variables. See the [User Guide](GUIDE.md) for full details.

---

### How it works

The project is split into a few main parts:

1.  **Bot Manager**: Handles the lifecycle of your bots.
2.  **Web Server**: Uses Socket.io to talk to the dashboard in real-time.
3.  **Features**: Built-in logic like Killaura and AutoEat.
4.  **Plugins**: A system for adding your own scripts without touching the core code.

---

### Plugin System

You can add custom logic by placing JavaScript files in the `src/plugins/` folder. The bot will automatically detect new files and reload them while the server is running. Every plugin gets access to a simple API for logging and sending chat messages.

> ### [ExamplePlugin.js](https://github.com/tanishisherewithhh/ImperialsBot/blob/main/ExamplePlugin.js) explains the plugin structure and provides documentation for the plugin API.
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
                this.bot.chat(`ImperialBot Instance v2.0`);
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


### What it looks like currently:

<details>
  <summary>Dashboard Default Theme</summary>
  <img width="1912" height="926" alt="Dashboard Default Theme" src="https://github.com/user-attachments/assets/8b7b2e29-c5d6-49b1-8f6c-1f104d78e608" />
</details>

<details>
  <summary>Dashboard Simple Dark Theme</summary>
  <img width="1912" height="922" alt="Dashboard Simple Dark Theme" src="https://github.com/user-attachments/assets/75014789-6b32-4b9b-9c5d-98917749bb35" />
</details>

<details>
  <summary>Dashboard Terminal (CRT) Theme</summary>
  <img width="1912" height="922" alt="Dashboard Terminal (CRT) Theme" src="https://github.com/user-attachments/assets/6a218a20-382c-465c-ae57-db3ff0dd3695" />
</details>

<details>
  <summary>Dashboard Emerald Theme</summary>
  <img width="1912" height="922" alt="Dashboard Emerald Theme" src="https://github.com/user-attachments/assets/be0f8824-c855-4dd3-938c-0617c0904520" />
</details>

<details>
  <summary>Rest of the dashboard</summary>
  <img width="1912" height="922" alt="Rest of the dashboard" src="https://github.com/user-attachments/assets/ac9ed8ff-4883-4fdc-93f6-64e89be529f2" />
</details>

### License
This project is licensed under the GNU General Public License v3.

**Author**: tanishisherewith
