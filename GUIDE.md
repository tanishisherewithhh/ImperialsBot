# ImperialsBot User Guide

### Setup

> [!IMPORTANT]
> **Download** the source files from [here](https://github.com/tanishisherewithhh/ImperialsBot/archive/refs/heads/main.zip)

> [!NOTE]
> You will need to have [Node.JS](https://nodejs.org/en) installed.

**Windows**
Double-click `start.bat`. It will check for Node.js, install dependencies, and launch the server.

**Linux**
1. Open a terminal in the folder.
2. Run `chmod +x start.sh` to give it permissions.
3. Run `./start.sh` to start.

Once running, open your browser to `http://localhost:3000`.
If you have used a custom port then go to `http://localhost:YOUR_PORT`

---

### Adding and Managing Bots

To add a bot, click the **Add Bot** button and fill in the fields:
- **Username**: The name the bot will use in-game.
- **Host / Port**: The server IP and port (usually 25565).
- **Version**: The Minecraft version. Leave empty for auto-detection.
- **Auth**: 
    - `Offline`: For cracked servers (no password needed).
    - `Microsoft`: For premium accounts and Minecraft Realms.
- **Password**: Used for Microsoft accounts or Auto-Auth on cracked servers.
- **Proxy**: Supports SOCKS4 and SOCKS5 proxies to hide your IP.

**Discord Integration**:
You can choose between two modes:
1. **Webhook**: Provide a Discord Webhook URL for simple alerts.
2. **Discord Bot**: Provide a Bot Token and Channel ID for better notification handling.

**Checkboxes**:
- **Auto-Reconnect**: Automatically logs back in after being kicked.
- **First Person View**: Shows the world from the bot's eyes in the viewer.
- **Show Password**: Click the eye icon in any password field to reveal the text.

**Bulk Generation**:
Use the **Bulk Generate** tool to quickly add many bots. It can automatically increment numbers in usernames (e.g., Bot1, Bot2).

**Updating**:
To change settings, click the **Edit** icon on the bot in the sidebar. You can update IPs or features without deleting the bot. Click a bot in the sidebar to switch the dashboard control to that specific instance.

---

### Dashboard Features

Once a bot is selected from the sidebar, you can monitor its state:
- **Health & Hunger**: Visual bars showing the bot's survival status.
- **Position**: Shows coordinates for both the **Overworld** and **Nether** simultaneously.
- **Inventory**: A visual tab showing everything the bot is currently holding.
- **Online Players**: A list of all players on the server, found in the right sidebar.
- **Visual Feed**: A real-time 3D view of the bot's surroundings.
- **Analytics**: Tracks server TPS, bot ping, and real-time network traffic (RX/TX bandwidth).
- **Watchlist**: Add player names to be notified immediately when they join or leave the server.

---

### Feature Controls

**Spammer**
Allows the bot to send messages repeatedly with custom delays and random strings to bypass filters.

**Chat & Exporting**
- **Sending Chat**: Use the bottom bar to send messages.
- **Exporting Logs**: Use the export button above the chatbox to save the current bot's chat history to a text file.

**Bulk Actions**
Control all selected bots at once:
- **Move All**: Send every bot to the same coordinates.
- **Chain Chat**: Splits your message word-by-word across your bots for coordinated talking.
- **Reconnect All**: Instantly restarts all active bots.

---

### Performance & Modes

**Global Headless Mode**
For high-density botting, you can turn off the dashboard entirely:
1. Go to your **Terminal/CMD**.
2. Type `headless`. 
The dashboard UI will stop receiving updates to save maximum CPU and RAM. Type `gui` in the terminal to restore it.

**Holographic Mode**
Hides the sidebars for a cleaner, floating-panel look. This can be toggled in the Global Settings.

**Low Performance Mode**
Reduces the update frequency of stats and graphs to save resources on slower computers.

---

### Internal Files

To help manage the bot system, several files are used to store data locally:

- **bots.json**: This file contains the configuration for all the bots you have added, including their usernames, server details, and specific features like spammer or auto-auth. You don't usually need to edit this manually as the dashboard handles it.
- **settings.json**: Stores global settings like the UI theme you've selected and technical values like the reconnection delay.
- **log.txt**: A local file that records server-side events and errors. If the program crashes or a bot behaves strangely, looking at the end of this file can provide useful information for troubleshooting.

---

### Plugin System

Custom extensions go into the `src/plugins/` folder. 
- **Loading**: Just drop a `.js` file into the folder. The bot will detect it immediately.
- **Hot Reloading**: You can edit your plugin code while the server is running. The bot will automatically reload the script without needing a restart.

---

### Issues and Limitations

**Server-Side Disconnects**
Bots might disconnect when moving between "worlds" or "servers" within a network (like moving from a Lobby to a Mini-game). This is usually due to the server sending a "Dimension Change" or "Respawn" packet that the bot engine needs to handle. If the bot hangs, use the **Reconnect** button.

**Anti-Cheat Detection**
Because this is an automated bot, server anti-cheats (like Grim, Vulcan, or Matrix) may flag the bot's movement or combat as "suspicious." 
- The bot's physics engine (Mineflayer) may not perfectly replicate a human player's movement.
- High-speed Killaura will likely get the bot banned on protected servers.
- Lagbacks or rubberbanding are not in our control, and is mainly due to the inaccuracies of mineflayer's physics engine with server anticheats.

**Finding Errors**
If something isn't working, check these places:
1. **The Terminal/CMD**: Any server-side crashes or bot connection errors appear here.
2. **Dashboard Logs**: The chatbox shows status updates (e.g., "Bot disconnected: Kick reason").
3. **Browser Console**: Press `F12` and click "Console" to see if the dashboard itself has errors.
4. If the program crashes, please check `log.txt` for any error messages that may have been reported.
