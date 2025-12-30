# ImperialsBot User Guide

### Setup

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
- **Host**: The server IP (e.g., `play.example.com`).
- **Port**: The server port (usually `25565`).
- **Version**: The Minecraft version of the server. Leave empty for auto-detection, or specify (e.g., `1.20.1`).
- **Auth**: 
    - `Offline`: For cracked servers (no password needed).
    - `Microsoft`: For premium accounts and **Minecraft Realms**.
- **Password**: 
    - For **Microsoft** accounts, this is your account password.
    - For **Cracked** servers with **Auto-Auth** enabled, this password is used to automatically type `/login <password>` or `/register <password> <password>` when you join.

**Minecraft Realms Support**:
To connect to a Realm:
1. Set **Connection Type** to "Minecraft Realms".
2. Ensure **Auth Type** is set to "Microsoft".
3. Choose the **Realm Type** (ID, Name, or Invite Link).
4. Enter the corresponding identifier in the input field.
> [!NOTE]
> Realms support is strictly for premium accounts. Offline/Cracked auth will not work for Realms.

**Webhook URL**: A Discord webhook URL to receive bot alerts (logins, kicks, etc.).
> Provide a different webhook URL to different bots to avoid instant ratelimiting and messy outputs.

**Checkboxes**:
- **Auto-Reconnect**: If ticked, the bot will automatically try to log back in if it gets disconnected or kicked (waiting a few seconds between attempts).
- **First Person View**: If ticked, the real-time viewer will show the world from the bot's eyes. If unticked, it uses a third-person camera.

**Updating**: To change a bot's settings, click the gear icon on the bot in the sidebar. You can change the IP or version without deleting the bot.

---

### Dashboard Features

Once a bot is selected, you can monitor its state in the top bar:
- **Health & Hunger**: Real-time bars showing the bot's survival status.
- **Position**: X, Y, Z coordinates and rotation (Yaw/Pitch).
- **Inventory**: View everything the bot is holding in the "Inventory" tab.
- **Online Players**: A list of all players on the server is visible in the **right sidebar**.
- **Visual Feed**: Watch your bot's world using Prismarine Viewer in the top right. You can even interact with it using your mouse to zoom in/out and look around the world.
- **Navigation**: You can make the bot automatically travel to a given position using mineflayer-pathfinder and movement.

---

### Feature Controls

**Spammer**
The spammer allows the bot to send messages repeatedly.
- **Message List**: Add multiple messages; the bot will cycle through them or pick at random.
- **Delay**: How long (in milliseconds) the bot waits between messages.
- **Random Strings**: Append random characters to each message to bypass some anti-spam filters.
- **Importing Text**: You can paste a list of messages into the input fields to quickly set up a spam rotation.

**Chat & Exporting**
- **Sending Chat**: Type in the bottom bar to send messages as the bot.
- **Exporting Logs**: You can select and copy the chat text directly from the dashboard box to save your logs manually.

**Themes**
Use the theme selector in the sidebar to change the dashboard’s look. These are saved locally so they persist when you refresh.

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
- This is beyond our control. And lagbacks or rubberbanding is not in our control, and is mainly due to the inaccuracies of mineflayer's physics engine with server anticheats.

**Finding Errors**
If something isn't working, check these places:
1. **The Terminal/CMD**: Any server-side crashes or bot connection errors appear here.
2. **Dashboard Logs**: The chatbox shows status updates (e.g., "Bot disconnected: Kick reason").
3. **Browser Console**: Press `F12` and click "Console" to see if the dashboard itself has errors.
4. If the program crashes, please check `log.txt` for any error messages that may have been reported.
