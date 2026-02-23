import fs from 'fs';
import path from 'path';

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

            fs.appendFileSync(this.logFile, logEntry, 'utf8');
        } catch (err) {

            if (this.originalConsole && this.originalConsole.error) {
                this.originalConsole.error('CRITICAL: Failed to write to log.txt:', err.message);
            }
        }
    }


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
