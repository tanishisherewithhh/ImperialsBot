import fs from 'fs';
import path from 'path';
import { Logger } from './Logger.js';

const AUDIT_LOG_FILE = path.join(process.cwd(), 'audit.log');

export class AuditLogger {
    static init() {
        Logger.rotateLog(AUDIT_LOG_FILE);
        if (!fs.existsSync(AUDIT_LOG_FILE)) {
            fs.writeFileSync(AUDIT_LOG_FILE, '');
        }
    }

    static log(action, user, details) {
        const timestamp = new Date().toISOString();
        const entry = `[${timestamp}] [USER: ${user}] [ACTION: ${action}] ${details}\n`;
        fs.appendFile(AUDIT_LOG_FILE, entry, (err) => {
            if (err) console.error('Failed to write to audit.log', err);
        });
    }
}
