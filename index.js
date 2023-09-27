let mineflayer = require('mineflayer');
const axios = require('axios');
const fs = require('fs');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements
const express = require('express');
const WebSocket = require('ws');
const mineflayerViewer = require('prismarine-viewer').mineflayer;
const imagePath = './image/Imperials.png'; // Path to your image
const pvp = require('mineflayer-pvp').plugin;
const { GoalNear } = require('mineflayer-pathfinder').goals

// Read the image file and convert it to base64
const image = fs.readFileSync(imagePath);
const base64Image = Buffer.from(image).toString('base64');
const wss = new WebSocket.Server({
	port: 8080
});

const app = express();
app.use(express.json());
const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
const serverIP = config.ip;
const username = config.username;
const webhookUrl = config.webhookUrl.trim();
const reconnectDelayInSeconds = parseInt(config.reconnectdelay) * 1000;
const password = config.password;
const blacklisted = config.blacklist;
const port = config.port;

let server;
let chatLog = new Set();
let antiafk = config.antiafk;
let bot;
let spamming = false;
let i=1;
let forceDisconnect = false;
let localHostUrl = `http://localhost:`+(8007+i);
let killaura = config.killaura.killaura;
let connections = [];

const main = () => {
	bot = mineflayer.createBot({
		host: serverIP,
		username: username,
		auth: 'offline', // Authentication mode, can be 'microsoft' for online mode or 'offline' for offline mode
		skipValidation: true,
		version: config.version,
	});
	sendWebhookMessage(webhookUrl, '‏');
	server = app.listen(port, () => {
		console.log(`Server running at http://localhost:${port}/`);
	});
	axios.patch(webhookUrl, {
		name: 'Imperials Bot',
	}).then(() => {
		console.log('Webhook name updated successfully');
	}).catch((error) => {
		console.error('Failed to update webhook name:', error);
	});

	axios.patch(webhookUrl, {
		avatar: `data:image/png;base64,${base64Image}`,
	}).then(() => {
		console.log('Webhook avatar updated successfully');
	}).catch((error) => {
		console.error('Failed to update webhook avatar:', error);
	});
	for (let c = 0; c <= 1000; c++) {

	}
	sendWebhookMessage(webhookUrl, '‏');

	let imperialsText = `░▀█▀░█▄█░█▀█░█▀▀░█▀▄░▀█▀░█▀█░█░░░█▀▀
░░█░░█░█░█▀▀░█▀▀░█▀▄░░█░░█▀█░█░░░▀▀█
░▀▀▀░▀░▀░▀░░░▀▀▀░▀░▀░▀▀▀░▀░▀░▀▀▀░▀▀▀
 _<MINECRAFT IMPERIALS BOT BY TANISHISHEREWITH>_
`;
	sendWebhookMessage(webhookUrl, imperialsText);
	sendWebhookMessage(webhookUrl, '‏');
	bot.setMaxListeners(1000);
    
	bot.loadPlugin(pathfinder);
    bot.loadPlugin(pvp);
    
	const mcData = require('minecraft-data')(bot.version);
	bot.once("login", async () => {
		sendWebhookMessage(webhookUrl, `> ### *[${username}]* joined ${serverIP}`);
		sendWebhookMessage(webhookUrl, `> ### *[${username}]* spawned succesfully`)
        await bot.waitForTicks(50);
		bot.chat('/register ' + password);
        await bot.waitForTicks(50);
		bot.chat("/login " + config.password);
		sendWebhookMessage(webhookUrl, `> ### *[${username}]* logged in`)
	});

	bot.once('spawn', () => {
		mineflayerViewer(bot, {
			firstPerson: config.firstperson,
			port: 8007+i
		}) // Start the viewing server on port 3000

		// Draw the path followed by the bot
		const path = [bot.entity.position.clone()]
		bot.on('move', () => {
			if (path[path.length - 1].distanceTo(bot.entity.position) > 1) {
				path.push(bot.entity.position.clone())
				bot.viewer.drawLine('path', path)
			}
		}) 
        bot.waitForTicks(50);
		bot.chat('/register ' + password);
        bot.waitForTicks(50);
		bot.chat("/login " + config.password);
		bot.chat('hello');   
	})
  const defaultMove = new Movements(bot)

	// Event listener for incoming chat messages
	bot.on('chat', (username, message) => {
		// Send the chat message to the Discord webhook
		if (config.log.messages == true) {
			let content1;
			if (username == bot.username) {
				content1 = `### {BOT} [CHAT] ${username} » ${message}`;
			} else {
				content1 = `[CHAT] ${username} » ${message}`;
			}
			sendWebhookMessage(webhookUrl, content1);
		}
	});

	bot.on('end', () => {
		server.close();
		bot.end();
		bot.removeAllListeners();
		sendWebhookMessage(webhookUrl, `### Bot disconnected.`);
        sendWSmessage(`### Bot disconnected.`);
		if (config.autoreconnect && forceDisconnect == false) {
            i = i+1;
            bot.viewer.close();
            localHostUrl = `http://localhost:`+(8007+i);
			sendWebhookMessage(webhookUrl, `### Reconnecting in ${reconnectDelayInSeconds/1000} seconds.....`);
            sendWSmessage(`### Reconnecting in ${reconnectDelayInSeconds/1000} seconds.....`);
			setTimeout(main, reconnectDelayInSeconds);
		}
	});

	bot.on('entitySpawn', (entity) => {
		if (config.securityguard) {
			if (entity.type === 'player' && entity.username != bot.username && !config.blacklist.includes(entity.username.toLowerCase())) {
				const message = `### @everyone Player ${entity.username} has entered the bot's render distance.`;
				sendWebhookMessage(webhookUrl, message);
			}
		}
	});

   bot.on('physicTick', function() {
    if(killaura){
     let entity;
     if (bot.targetEntity) {
      entity = bot.targetEntity;
     } else {
      entity = bot.nearestEntity();
     }

    if (entity) {
        if(((entity.type === 'mob' && config.killaura.mob) || (entity.type === 'player' && config.killaura.player))){
            console.log('Entity located');
            if(bot.canSee(entity)){
                    console.log('Entity seen');
                    bot.lookAt(entity.position.offset(0, entity.height, 0));
                      if (bot.targetEntity !== entity) {
                       sendWebhookMessage(webhookUrl,'Found ' + entity.type);
                        bot.attack(bot.targetEntity, true);
                      } 
                      bot.targetEntity = entity;
                      bot.pvp.attack(bot.targetEntity);
            }
        }
    } else if (bot.targetEntity) {
        sendWSmessage('Lost sight of ' + bot.targetEntity.type);
      bot.pvp.stop()
      bot.targetEntity = null;
    }
    }
   });


	// Anti-AFK feature
	setInterval(() => {
		if (antiafk == true) {
			const randomX = Math.floor(Math.random() * 10) + 1;
			const randomZ = Math.floor(Math.random() * 10) + 1;

			bot.setControlState('forward', true);
			bot.setControlState('sprint', true);
			bot.setControlState('jump', true);
			bot.setControlState('right', Math.random() > 0.5);
			bot.setControlState('left', Math.random() > 0.5);

			bot.look(Math.random() * 180 - 90, 0, true);

			setTimeout(() => {
				bot.setControlState('forward', false);
				bot.setControlState('sprint', false);
				bot.setControlState('jump', false);
				bot.setControlState('right', false);
				bot.setControlState('left', false);
			}, 500);

			bot.setControlState('back', true);

			setTimeout(() => {
				bot.setControlState('back', false);
			}, 500);

			bot.setControlState('right', true);

			setTimeout(() => {
				bot.setControlState('right', false);
			}, 500);

			bot.setControlState('left', true);

			setTimeout(() => {
				bot.setControlState('left', false);
			}, 500);

			bot.setControlState('jump', true);

			setTimeout(() => {
				bot.setControlState('jump', false);
			}, 500);

			bot.setControlState('sprint', true);

			setTimeout(() => {
				bot.setControlState('sprint', false);
			}, 500);

			bot.look(Math.random() * 180 - 90, 0, true);

			bot.setControlState('forward', true);

			setTimeout(() => {
				bot.setControlState('forward', false);
			}, 500);
		}
	}, 30000);

	// Log errors and kick reasons and whispers
	bot.on('whisper', (username, message) => {
		if (!config.log.whispers) return
		sendWebhookMessage(webhookUrl, `### [WHISPER] ${username} whispers: ` + message);
	})

	bot.on("kicked", (err) => {
		if (config.log.kicks) {
			console.log(err);
		}
		bot.end();
	});

	bot.on("error", (err) => {
		if (config.log.errors) {
			console.log(err);
		}
		bot.end();
	});
	bot.on("death", (err) => {
		if (config.log.death) {
			console.log(err);
		}
		sendWebhookMessage(webhookUrl, `## THE BOT HAS DIED`)
	});
localhostApp();
};

function generateRandomString(length) {
	var result = '';
	var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	var charactersLength = characters.length;
	for (var i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}

function sendWebhookMessage(url, message) {
	// Use your preferred method to send the message to the webhook
	console.log((message));
	axios.post(url, {
			content: message
		})
		.then(() => {
			// console.log('Message sent to webhook');
		})
		.catch((error) => {
			console.error('Failed to send message to webhook:', error);
		});
}
// Function to send messages from the config array
function sendMessages() {
	let i = 0;

	function sendMessage() {
		let message = config.messages[i];
		if (!spamming) return;
		if (config.chat.bypass) {
			message = message + generateRandomString(config.chat.bypasslimit);
		}
		bot.chat(String(message));
		i = (i + 1) % config.chat.messages.length;
		if (spamming) {
			setTimeout(sendMessage, config.chat.delay * 1000);
		} else {
			return;
		}
	}
	sendMessage();
}


// Function to send random messages from the config array
function sendRandomMessages() {
	setInterval(() => {
        if(spamming == false)return;
		const randomIndex = Math.floor(Math.random() * config.chat.messages.length);
		let message = config.chat.messages[randomIndex];
		if (config.chat.bypass) {
			message = message + generateRandomString(config.chat.bypasslimit);
		}
		bot.chat(message);
	}, config.chat.delay * 1000);
}

function killMyself(){
     let flintSteelItem = bot.inventory.items().find(item => item.name === 'flint_and_steel');
    if (flintSteelItem) {
      bot.equip(flintSteelItem, 'hand').then(() => {
        bot.lookAt(bot.entity.position.offset(0, -1, 0));
        bot.activateItem();
      });
    } else {
        sendWebhookMessage(webhookUrl, '> [BOT] I dont have a flint and steel to kill myself. Trying using lava');
        sendWSmessage(`[BOT] I dont have a flint and steel to kill myself. Trying using lava`);
         const lavaBlock = bot.findBlock({
    matching: block => block.name === 'lava',
    maxDistance: 512,
         });
  if (lavaBlock) {
    bot.pathfinder.setMovements(defaultMove);
    const p = lavaBlock.position;
      bot.pathfinder.setGoal(new GoalNear(p.x, p.y, p.z, 512))
  } else {
    sendWebhookMessage('No nearby lava blocks found.');
      sendWSmessage('No nearby lava blocks found.');
  }
}
}

function sendWSmessage(messageWS){
    connections.forEach(ws => {
  if (ws.readyState === ws.OPEN) {
    chatLog.add(String(messageWS));
    ws.send(String(messageWS));
  }
});
}
main();
function localhostApp(){
wss.on('connection', ws => {
    connections.push(ws);
    ws.send(String(Array.from(chatLog).join('\n')));

  ws.on('close', () => {
    // Remove closed connections from the list
    connections = connections.filter(conn => conn !== ws);
  });

	bot.on('chat', (username, message) => {
        chatLog.add(`[${username}] ${message}`);
		ws.send(`[${username}] ${message}`);
	});
    bot.on("death", (err) => {
        chatLog.add(`THE BOT HAS DIED`);
		ws.send(`THE BOT HAS DIED`);
	});
    bot.on('whisper', (username, message) => {
        chatLog.add(`[WHISPER] ${username} whispers: ` + message);
		ws.send(`[WHISPER] ${username} whispers: ` + message);
	})
});
app.get('/coords', (req, res) => {
	const {
		x,
		y,
		z
	} = bot.entity.position;
	res.json({
		x,
		y,
		z
	});
});
app.get('/inv', (req, res) => {
  let simplifiedItems = bot.inventory.items().map(item => ({
  DisplayName: item.displayName,
  Name: item.name,
  Count: item.count,
  Slot: item.slot,
  Durability: item.durability
}));

res.json(JSON.parse(JSON.stringify(simplifiedItems, null, 2)));
});

app.get('/', (req, res) => {
	const position = bot.entity.position;
     const items = bot.inventory.items().map(item => ({
    displayName: item.displayName,
    name: item.name,
    count: item.count,
    slot: item.slot
  }));
  let tableRows = items.map(item => `
    <tr>
      <td>${item.displayName}</td>
      <td>${item.name}</td>
      <td>${item.count}</td>
      <td>${item.slot}</td>
    </tr>
  `).join('');
   let players = [];
  for (let username in bot.players) {
    let player = bot.players[username];
    players.push({
      username: username,
      ping: player.ping
    });
  }
    let playerRows = players.map(player => `
      <tr>
        <td>${player.username}</td>
        <td>${player.ping}</td>
      </tr>
    `).join('');
  //  document.getElementById('playerTable').innerHTML = playerRows; 
    
	res.send(`
<!DOCTYPE html>
<html>
<head>
  <style>
body {
  background-color: #f0f0f0;
  font-family: Arial, sans-serif;
}

body.dark {
  background-color: #333;
}

h2 {
  color: #333;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 5px;
  background-color: #f8f8f8;
  box-shadow: 0px 0px 10px rgba(0,0,0,0.1);
}

h2.dark {
  color: #fff;
  background-color: #555;
}

.container {
  text-align: center;
}

input[type="text"], textarea {
  width: 50%;
  padding: 12px 20px;
  margin: 8px 0;
  box-sizing: border-box;
  border: 2px solid #ccc;
  border-radius: 4px;
  background-color: #f8f8f8;
}

input[type="text"].dark, textarea.dark {
  background-color: #555;
}

button {
    background-color: #ADFF2F; /* GreenYellow */
    background-image: linear-gradient(315deg, #ADFF2F 0%, #32CD32 74%); /* LimeGreen */
    border: none;
    color: white; /* White text */
    padding: 15px 32px;
    text-align: center;
    text-decoration: none;
    display: inline-block;
    font-size: 16px;
    margin: 4px 2px;
    cursor: pointer;
    border-radius: 12px; /* Rounded corners */
}

button.dark {
    background-color: #000; /* Black */
    background-image: linear-gradient(315deg, #000000, #434343); /* Black to Gray gradient */
}
input[type="text"].dark, textarea.dark {
  background-color: #555;
  color: #fff; /* White text */
}
body {
  background-color: #f0f0f0;
  font-family: Arial, sans-serif;
}

body.dark {
  background-color: #333;
}

table {
  width: 90%;
  border-collapse: collapse;
  table-layout: fixed;
}

th, td {
  border: 1px solid #ccc;
  padding: 8px;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  border-radius: 5px; /* This will give the cells curved edges */
}

th {
  background-color: #f8f8f8;
}

td {
  background-color: #fff;
}

body.dark th, body.dark td {
  border-color: #555;
  color: #fff; /* This will make the text white */
}

body.dark th {
  background-color: #555;
}

body.dark td {
  background-color: #444;
}


</style>
</head>
<body id="body">
        <h2 id="heading">Current Position: ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}</h2>
        <button onclick="move('forward')">Move Forward</button>
        <button onclick="move('backward')">Move Backward</button>
        <button onclick="move('left')">Move Left</button>
        <button onclick="move('right')">Move Right</button>
        <button onclick="move('jump')">Jump</button>
        <button onclick="stop()">Stop</button>
        <button id="themeButton" onclick="switchTheme()">Switch to Dark Theme</button>
        <button onclick="spam()">Spam</button>
        <button onclick="antiafk()">Anti-AFK</button>
        <button onclick="killaura()">Killaura</button>

        <br>
        <div style="display: flex; justify-content: space-between;">
        <div style="flex: 1;">
        <textarea id="chatLog" rows="30" cols="70"></textarea>
        </div>
        <div style="flex: 1;">
        <iframe src=${localHostUrl} width="70%" height="100%"></iframe>
        </div>
        </div>
        </br>
        <input type="text" id="chatInput" placeholder="Type a message...">
        <button onclick="sendChat()">Send</button>
        <button onclick="disconnect()">Force Disconnect</button>
        <button onclick="kill()">Suicide</button>
        <button onclick="updatePlayerList()">Update Player List</button>
 <div style="display: flex; justify-content: space-between;">
        <div style="flex: 1;">
<table id="inventoryTable">
    <tr>
      <th>Display Name</th>
      <th>Name</th>
      <th>Count</th>
      <th>Slot</th>
    </tr>
    ${tableRows}
  </table> 
</div>
        <div style="flex: 1;">
<table id="playerTable">
  <tr>
    <th>Username</th>
    <th>Ping</th>
  </tr>
     ${playerRows}
</table>
</div>
        </div>
        <script>
          const ws = new WebSocket('ws://localhost:8080');
        

          ws.onmessage = event => {
            document.getElementById('chatLog').value += '\\n' + event.data;
          };

          function move(direction) {
            fetch('/move?direction=' + direction)
              .then(response => response.text())
              .then(position => {
                document.getElementById('position').textContent = 'Current Position: ' + position;
              });
            }
       function kill() {
        fetch('/kill')
      }
        function disconnect() {
          fetch('/disconnect')
        }
       function killaura() {
          fetch('/killaura')
        }
 function stop() {
        fetch('/stop')
          .then(response => response.text())
          .then(position => {
            document.getElementById('position').textContent = 'Current Position: ' + position;
          });
      }
 function sendChat() {
        const message = document.getElementById('chatInput').value;
        ws.send(message);
        fetch('/chat?message=' + encodeURIComponent(message));
        chatInput.value = ''; // Clear the text box
      }
   function spam(){
     fetch('/spam');
    }
    function antiafk(){
     fetch('/antiafk');
    }
let darkMode = false;

function switchTheme() { 
const bodyElement = document.body;
const chatLogElement = document.getElementById('chatLog'); 
const chatInputElement = document.getElementById('chatInput'); 
const headingElement = document.getElementById('heading'); 
const themeButtonElement = document.getElementById('themeButton'); 
const allButtons = document.getElementsByTagName('button');

if (!darkMode) { bodyElement.classList.add('dark'); 
chatLogElement.classList.add('dark');
chatInputElement.classList.add('dark');
headingElement.classList.add('dark');
for(let i=0; i<allButtons.length; i++) { 
allButtons[i].classList.add('dark'); } 
darkMode = true; 
} else {
bodyElement.classList.remove('dark');
chatLogElement.classList.remove('dark');
chatInputElement.classList.remove('dark');
headingElement.classList.remove('dark'); 
for(let i=0; i<allButtons.length; i++) { 
allButtons[i].classList.remove('dark');
} 
darkMode = false; 
} 
} 
function updatePlayerList() { 
let players = [];
  for (let username in bot.players) {
    let player = bot.players[username];
    players.push({
      username: username,
      ping: player.ping
    });
  }
playerRows = players.map(player => \`
      <tr>
        <td>player.username</td>
        <td>player.ping</td>
      </tr>
    \`).join('');
} 
updatePlayerList();
</script>
</body> 
</html>
`);
});

app.get('/chat', (req, res) => {
	const message = String(req.query.message);
	bot.chat(String(message));
	res.send(`Message sent: ${message}`);
});

app.get('/health', (req, res) => {
    const health = bot.health;
	res.send(`Bots current health: ` + health);
});
app.get('/players', (req, res) => {
	const players = bot.players; // Replace with your actual player list
	res.json(players);
});
app.get('/players2', (req, res) => {
  let players = [];
  for (let username in bot.players) {
    let player = bot.players[username];
    players.push({
      username: username,
      ping: player.ping
    });
  }
  res.json(players);
});


app.get('/kill', (req, res) => {
    sendWebhookMessage(webhookUrl, 'Bot is in the process of suicide');    
    res.send('Bot is in the process of suicide');
    if(config.killsuicide){
        bot.chat(`/kill`);
    }else{
        killMyself();
    }
});

app.get('/killaura', (req, res) => {
    killaura = !killaura;
    res.send(`Killaura: `+killaura);
});
app.get('/disconnect', (req, res) => {
	bot.quit('Bot has disconnected');
    forceDisconnect = true;
	bot.end();
	res.send('Bot has disconnected');
});

app.get('/move', (req, res) => {
	const direction = req.query.direction;
	if (direction === 'forward') {
		bot.setControlState('forward', true);
	} else if (direction === 'backward') {
		bot.setControlState('back', true);
	} else if (direction === 'left') {
		bot.setControlState('left', true);
	} else if (direction === 'right') {
		bot.setControlState('right', true);
	} else if (direction === 'jump') {
		bot.setControlState('jump', true);
	}
	res.send(`Bot is moving ${direction}`);
});

app.get('/stop', (req, res) => {
	bot.clearControlStates();
	res.send('Bot has stopped');
});
app.get('/antiafk', (req, res) => {
	antiafk = !antiafk;
	sendWebhookMessage(webhookUrl, '> AntiAFK: ' + antiafk);
	sendWSmessage('AntiAFK: ' + antiafk);
	res.send('AntiAFK: ' + antiafk);
});
app.get('/spam', (req, res) => {
	spamming = !spamming;
	sendWebhookMessage(webhookUrl, '> Spamming now: ' + spamming)
	if (spamming == true) {
		if (config.chat.random) {
			sendRandomMessages();
		} else {
			sendMessages();
		}
	}
    sendWSmessage(`Spamming: ` + spamming);
	res.send(`Spamming: ` + spamming);
});
}