import net from 'net';

export class NetworkUtils {
    static findFreePort(startPort) {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.unref();
            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(this.findFreePort(startPort + 1));
                } else {
                    reject(err);
                }
            });
            server.listen(startPort, () => {
                server.close(() => {
                    resolve(startPort);
                });
            });
        });
    }

    static pingServer(host, port, timeout = 5000, retries = 1) {
        return new Promise(async (resolve) => {
            let mc;
            try {
                mc = await import('minecraft-protocol');
            } catch (e) {
                return resolve({ success: false, error: 'Failed to load minecraft-protocol' });
            }

            let attempt = 0;

            const tryPing = () => {
                attempt++;
                const timer = setTimeout(() => {
                    if (attempt < retries) {
                        tryPing();
                    } else {
                        resolve({ success: false, error: 'Ping timed out' });
                    }
                }, timeout);

                const ping = mc.ping || (mc.default && mc.default.ping);
                if (typeof ping !== 'function') {
                    return resolve({ success: false, error: 'ping is not a function in minecraft-protocol' });
                }

                ping({ host, port }, (err, results) => {
                    clearTimeout(timer);
                    if (err) {
                        if (attempt < retries) {
                            tryPing();
                        } else {
                            resolve({ success: false, error: err.message });
                        }
                    } else {
                        resolve({ success: true, results });
                    }
                });
            };

            tryPing();
        });
    }
}
