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
}
