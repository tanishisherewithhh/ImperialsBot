import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

export class Logger {
    static logFile = path.resolve(process.cwd(), 'log.txt');


    static originalConsole = {
        log: console.log.bind(console),
        error: console.error.bind(console),
        warn: console.warn.bind(console)
    };


    static log(message, type = 'INFO') {
        try {
            const timestamp = new Date().toLocaleString();
            let cleanMessage = typeof message === 'string' ? message : JSON.stringify(message);



            cleanMessage = cleanMessage.replace(/\x1b\[[0-9;]*m/g, '');

            const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${cleanMessage}\n`;

            // Skip file writing if minimal logging is requested (useful for cloud platforms)
            if (process.env.IMPERIALS_MINIMAL_LOGS === 'true') {
                return;
            }

            fs.appendFileSync(this.logFile, logEntry, 'utf8');
        } catch (err) {

            if (this.originalConsole && this.originalConsole.error) {
                this.originalConsole.error('CRITICAL: Failed to write to log.txt:', err.message);
            }
        }
    }


    static rotateLog(filePath) {
        if (!fs.existsSync(filePath)) return;
        try {
            const stats = fs.statSync(filePath);
            if (stats.size > 0) { // Rotate if there's any content
                const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
                const parsed = path.parse(filePath);
                const logsDir = path.join(parsed.dir, 'logs');
                if (!fs.existsSync(logsDir)) {
                    fs.mkdirSync(logsDir, { recursive: true });
                }
                const archivePath = path.join(logsDir, `${parsed.name}_${timestamp}.gz`);

                const gzip = zlib.createGzip();
                const source = fs.createReadStream(filePath);
                const destination = fs.createWriteStream(archivePath);

                source.pipe(gzip).pipe(destination).on('finish', () => {
                    fs.writeFileSync(filePath, '', 'utf8');
                    if (this.originalConsole && this.originalConsole.log) {
                        this.originalConsole.log(`Rotated log: ${archivePath}`);
                    }
                }).on('error', (err) => {
                    if (this.originalConsole && this.originalConsole.error) {
                        this.originalConsole.error(`Failed to compress log ${filePath}:`, err.message);
                    }
                });
            }
        } catch (err) {
            if (this.originalConsole && this.originalConsole.error) {
                this.originalConsole.error(`Failed to rotate log ${filePath}:`, err.message);
            }
        }
    }

    static cleanupLogs() {
        try {
            const logsDir = path.join(process.cwd(), 'logs');
            if (!fs.existsSync(logsDir)) return;
            const files = fs.readdirSync(logsDir);
            const now = Date.now();
            const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
            for (const file of files) {
                const filePath = path.join(logsDir, file);
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > MAX_AGE) {
                    fs.unlinkSync(filePath);
                    if (this.originalConsole && this.originalConsole.log) {
                        this.originalConsole.log(`Cleaned up old log: ${file}`);
                    }
                }
            }
        } catch (err) {
            if (this.originalConsole && this.originalConsole.error) {
                this.originalConsole.error(`Failed to clean up logs:`, err.message);
            }
        }
    }

    static initGlobalLogging() {
        this.cleanupLogs();
        this.rotateLog(this.logFile);

        console.log = (...args) => {
            this.originalConsole.log(...args);
            this.log(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'INFO');
        };

        console.error = (...args) => {
            this.originalConsole.error(...args);
            this.log(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'ERROR');
        };

        console.warn = (...args) => {
            this.originalConsole.warn(...args);
            this.log(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'WARN');
        };
    }
}
