import fs from 'fs';
import path from 'path';

export class Logger {
    static logFile = path.resolve(process.cwd(), 'log.txt');

    // Store original console methods for safe internal use
    static originalConsole = {
        log: console.log.bind(console),
        error: console.error.bind(console),
        warn: console.warn.bind(console)
    };

    /**
     * Appends a message to log.txt with a timestamp.
     * Strips ANSI escape codes to keep the file clean.
     */
    static log(message, type = 'INFO') {
        try {
            const timestamp = new Date().toLocaleString();
            let cleanMessage = typeof message === 'string' ? message : JSON.stringify(message);

            // Strip ANSI escape codes
            // eslint-disable-next-line no-control-regex
            cleanMessage = cleanMessage.replace(/\x1b\[[0-9;]*m/g, '');

            const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${cleanMessage}\n`;

            fs.appendFileSync(this.logFile, logEntry, 'utf8');
        } catch (err) {
            // NEVER use console.error here if it's wrapped, use originalConsole
            if (this.originalConsole && this.originalConsole.error) {
                this.originalConsole.error('CRITICAL: Failed to write to log.txt:', err.message);
            }
        }
    }

    /**
     * Wraps console.log and console.error to also write to log.txt
     */
    static initGlobalLogging() {
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
