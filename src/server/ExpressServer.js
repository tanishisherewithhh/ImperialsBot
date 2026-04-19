import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import compression from 'compression';
import { ProxyAgent } from 'proxy-agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ExpressServer {
    constructor(port = 3000) {
        this.app = express();
        this.httpServer = createServer(this.app);
        this.port = port;

        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(compression());
        this.app.use(express.json());

        // Security Headers
        this.app.use((req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            next();
        });

        this.app.use(express.static(path.join(__dirname, '../../public'), {
            maxAge: '1d'
        }));
    }

    setupRoutes() {
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../../public/index.html'));
        });

        // Proxy Route for Viewer
        this.app.use('/viewer/:port', (req, res, next) => {
            const targetPort = parseInt(req.params.port);
            
            // proxy to ports currently authorized by the BotManager
            const { botManager } = require('../core/BotManager.js');
            const authorizedPorts = botManager.getAuthorizedPorts();
            
            if (targetPort && authorizedPorts.has(targetPort)) {
                const proxy = createProxyMiddleware({
                    target: `http://localhost:${targetPort}`,
                    ws: true,
                    changeOrigin: true,
                    pathRewrite: (path) => path
                });
                proxy(req, res, next);
            } else {
                res.status(403).json({ error: 'Access Denied: Port not authorized' });
            }
        });

        // CAPTCHA Bridge Proxy
        this.app.get('/bridge/solve', async (req, res) => {
            const { target, bot: botName } = req.query;
            if (!target) return res.status(400).send('Target URL required');

            try {
                let agent = null;
                const { botManager } = await import('../core/BotManager.js');
                const bot = botManager.getBot(botName);
                
                if (bot && bot.config && bot.config.proxy) {
                    agent = new ProxyAgent(bot.config.proxy);
                }

                const response = await fetch(target, { 
                    agent, 
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
                });

                const body = await response.text();
                const baseTag = `<base href="${new URL(target).origin}/">`;
                const modifiedBody = body.replace('<head>', `<head>${baseTag}`);
                
                res.send(modifiedBody);
            } catch (err) {
                res.status(500).send(`Bridge error: ${err.message}`);
            }
        });

        // Proxy Route for Inventory
        this.app.use('/inventory/:port', (req, res, next) => {
            const targetPort = parseInt(req.params.port);
            
            import('../core/BotManager.js').then(({ botManager }) => {
                const authorizedPorts = botManager.getAuthorizedPorts();

                if (targetPort && authorizedPorts.has(targetPort)) {
                    const proxy = createProxyMiddleware({
                        target: `http://localhost:${targetPort}`,
                        ws: true,
                        changeOrigin: true,
                        pathRewrite: (path) => path
                    });
                    proxy(req, res, next);
                } else {
                    res.status(403).json({ error: 'Access Denied: Port not authorized' });
                }
            });
        });
    }

    start() {
        this.httpServer.listen(this.port, () => {
            console.log(`Server running on http://localhost:${this.port}`);
        });
    }
}
