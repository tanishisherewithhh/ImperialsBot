import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class UpdateChecker {
    static async check() {
        try {
            const packageJsonPath = path.resolve(__dirname, '../../package.json');
            const localPackage = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const currentVersion = localPackage.version;

            const response = await fetch('https://raw.githubusercontent.com/tanishisherewithhh/ImperialsBot/main/package.json', {
                headers: { 'Cache-Control': 'no-cache' }
            });

            if (!response.ok) {
                return;
            }

            const githubPackage = await response.json();
            const latestVersion = githubPackage.version;

            if (this.isNewer(latestVersion, currentVersion)) {
                console.log('\n\x1b[33m[WARNING] A new version of ImperialsBot is available!\x1b[0m');
                console.log(`\x1b[32mCurrent: ${currentVersion} -> Latest: ${latestVersion}\x1b[0m`);
                console.log('\x1b[32mDownload the latest update from: https://github.com/tanishisherewithhh/ImperialsBot\x1b[0m\n');
            } else {
                console.log('\x1b[32m[INFO] ImperialsBot is up to date.\x1b[0m');
            }
        } catch (error) {
        }
    }

    static isNewer(latest, current) {
        const l = latest.split('.').map(Number);
        const c = current.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            if (l[i] > c[i]) return true;
            if (l[i] < c[i]) return false;
        }
        return false;
    }
}
