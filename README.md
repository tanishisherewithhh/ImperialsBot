## ImperialBot

This is a multi-bot manager for Minecraft with a web dashboard. It allows you to run several bots at once and control them through a clean interface.

### Getting Started

1. Set up Node.js
If you don't have Node.js, run start.bat and it will try to install it for you using winget. Alternatively, download it from nodejs.org.

2. Run the application
Just double click start.bat. It will install the required dependencies and start the server.

3. Access the Dashboard
Once the server is running, open your browser and go to http://localhost:3000 (or whatever port you configured).

### Features

- Dashboard: Manage multiple bots from one page.
- Visual Feed: See what your bots see in real-time.
- Inventory: View and manage bot items.
- Chat: Send and receive messages as the bot.
- Movement: Control bots with WASD or click-to-move.
- Plugins: Extend functionality with custom scripts.
- Themes: Custom UI skins to change the look.
- Discord: Webhook integration for alerts.

### Logic and what are plugins

The bot uses Mineflayer as the core engine. Features like Killaura, AutoEat, and AntiAFK are built in as standard components. 

You can add custom logic in the src/plugins folder. Plugins are basically scripts that listen for bot events (like spawning or receiving a message) and react accordingly. 
An example plugin ExamplePlugin.js is present in the folder to help you out.

### How to Contribute

If you want to help out:
1. Fork the repo.
2. Make your changes.
3. Submit a pull request.

Please keep code clean and stick to the existing structure. No complex setup is needed.

### License

Distributed under the GNU General Public License v3. See LICENSE for more details.

#### Author: tanishisherewith
