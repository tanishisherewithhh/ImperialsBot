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
If you have used a custom port, go to `http://localhost:YOUR_PORT`.

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
- **Proxy**: Supports HTTP, SOCKS4, and SOCKS5 proxies.

**Discord Integration**:
Choose between two modes:
1. **Webhook**: Provide a Webhook URL for simple alerts.
2. **Discord Bot**: Provide a Bot Token and Channel ID for richer notification handling.

**Checkboxes**:
- **Auto-Reconnect**: Automatically logs back in after being kicked.
- **First Person View**: Shows the world from the bot's eyes in the viewer.
- **Show Password**: Click the eye icon in any password field to reveal the text.

**Bulk Generation**:
Use the **Bulk Generate** tool to quickly add many bots. It can automatically increment numbers in usernames (e.g., Bot1, Bot2).

**Updating**:
Click the **Edit** icon on a bot in the sidebar to change settings without deleting it. Click a bot's name to switch the dashboard view to that specific instance.

---

### Dashboard Features

Once a bot is selected, you can monitor its state:
- **Health & Hunger**: Visual bars showing survival status.
- **Position**: Shows coordinates for both **Overworld** and **Nether** simultaneously.
- **Inventory**: A visual tab showing weapons, armor, and items.
- **Online Players**: A list of all players on the server in the right sidebar.
- **Analytics & Heatmap**: Tracks server TPS, ping, CPU/RAM, and a top-down **Spatial Heatmap** of the bot's movement history.
- **Watchlist**: Notifies you immediately when specific players join or leave.
- **Manual Control**: Fast-access buttons for **Respawn**, **Suicide**, and **Disconnect**.

---

### Feature Controls

**Arrow Key Control**
- Use the **Arrow Keys** (↑ ↓ ← →) to manually rotate the bot's head while focused on the dashboard. This syncs instantly with the in-game view and sliders.

**Killaura & Combat**
- Configure attack range, target priority (Players/Mobs), and view distance in the **Controls** tab.

**Spammer**
- Sends messages repeatedly with custom delays and optional random strings to bypass anti-spam filters.

**Chat & Exporting**
- **Sending Chat**: Use the bottom bar to talk as the bot.
- **Exporting Logs**: Save a bot's entire chat history to a CSV or text file via the export button.

**Bulk Actions**
- **Move All**: Send all selected bots to specific X, Y, Z coordinates.
- **Chain Chat**: Splits a long message word-by-word across all selected bots.
- **Reconnect/Delete**: Quickly restart or remove multiple bots at once.

---

### Performance & Modes

**Global Analytics Toggle**
- Found in **Global Settings**. Completely disables the stats tracking engine to save maximum server resources when analytics aren't needed.

**Global Headless Mode**
- For high-density botting, turn off the dashboard entirely:
    1. Go to your **Terminal/CMD**.
    2. Type `headless`.
- To restore the UI, type `gui`.

**Low Performance Mode**
- Disables blur effects, animations, and reduces graph update frequency to save resources on older hardware.

---

### Cloud Deployment (Render)

ImperialsBot can be hosted on cloud platforms like Render.com. However, unlike local hosting, cloud containers have ephemeral filesystems - any data saved to local files will be lost on restart.

**Render Mode** (`IMPERIALS_RENDER_MODE=true`) enables:
- Bot config stored in environment variables (persists across restarts)
- Viewer and inventory accessible via the main server port through proxy routes

**Setup on Render:**
1. Set environment variable `IMPERIALS_RENDER_MODE=true`
2. Deploy and use normally

**Usage:**
- When enabled, viewer is at `http://your-app.onrender.com/viewer/PORT` (port shown in dashboard)
- Same for inventory at `/inventory/PORT`
- Dashboard handles this automatically - nothing else needed

**Limitations:**
- Viewer/inventory run on internal ports but accessed via proxy (may have slight latency)
- Config stored in env vars - large bot lists should still work but keep them reasonable

---

### Internal Files

Several files are used to store data locally:
- **bots.json**: Persistent configuration for all your added bots.
- **settings.json**: Stores global preferences, themes, and reconnection delays.
- **log.txt**: Records server-side activities and errors for troubleshooting.
- **Audit Logs**: Stored in `logs/audit.log`, tracking every command and config change.

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
