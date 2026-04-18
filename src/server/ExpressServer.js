import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

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
        this.app.use(express.json());

        this.app.use(express.static(path.join(__dirname, '../../public')));
    }

    setupRoutes() {
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../../public/index.html'));
        });

        const isCloud = process.env.IMPERIALS_CLOUD_MODE === 'true';
        
        if (isCloud) {
            this.app.use('/viewer/:port', (req, res, next) => {
                const targetPort = parseInt(req.params.port);
                if (targetPort && targetPort > 3000) {
                    const proxy = createProxyMiddleware({
                        target: `http://localhost:${targetPort}`,
                        ws: true,
                        changeOrigin: true,
                        pathRewrite: (path) => path
                    });
                    proxy(req, res, next);
                } else {
                    next();
                }
            });

            this.app.use('/inventory/:port', (req, res, next) => {
                const targetPort = parseInt(req.params.port);
                if (targetPort && targetPort > 3000) {
                    const proxy = createProxyMiddleware({
                        target: `http://localhost:${targetPort}`,
                        ws: true,
                        changeOrigin: true,
                        pathRewrite: (path) => path
                    });
                    proxy(req, res, next);
                } else {
                    next();
                }
            });
        }
    }

    start() {
        this.httpServer.listen(this.port, () => {
            console.log(`Server running on http://localhost:${this.port}`);
        });
    }
}
