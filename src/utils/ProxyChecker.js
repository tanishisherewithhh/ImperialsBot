import axios from 'axios';
import { ProxyAgent } from 'proxy-agent';

export class ProxyChecker {
    /**
     * Checks a list of proxies and returns results
     * @param {string[]} proxyList Array of proxy URLs (e.g., socks5://1.2.3.4:1080)
     * @param {Function} onProgress Callback for progress tracking
     * @param {AbortSignal} signal Signal to abort the check prematurely
     * @returns {Promise<Object[]>} Results with status, speed, and original URL
     */
    static async checkList(proxyList, onProgress, signal) {
        const results = [];
        const total = proxyList.length;
        let current = 0;
        let index = 0;
        const maxConcurrent = 50;

        const workers = Array(maxConcurrent).fill(Promise.resolve()).map(async () => {
            while (index < total) {
                if (signal?.aborted) break;
                const i = index++;
                const proxyUrl = proxyList[i];
                const start = Date.now();
                let result;
                try {
                    const agent = new ProxyAgent({ getProxyForUrl: () => proxyUrl });
                    await axios.get('https://api.minecraftservices.com/heartbeat', {
                        httpAgent: agent,
                        httpsAgent: agent,
                        timeout: 5000,
                        validateStatus: () => true
                    });
                    
                    result = {
                        url: proxyUrl,
                        status: 'online',
                        latency: Date.now() - start
                    };
                } catch (err) {
                    result = {
                        url: proxyUrl,
                        status: 'offline',
                        error: err.message
                    };
                }
                
                results.push(result);
                current++;
                if (onProgress) {
                    onProgress({ current, total, lastResult: result });
                }
            }
        });

        await Promise.all(workers);
        return results;
    }

    /**
     * Scrapes free proxies from common sources
     * @param {Function} onProgress Callback for progress tracking
     * @returns {Promise<string[]>} Array of proxy URLs
     */
    static async scrapeAll(onProgress) {
        const sources = [
            { url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=10000&country=all&ssl=all&anonymity=all', protocol: 'socks5' },
            { url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks4&timeout=10000&country=all&ssl=all&anonymity=all', protocol: 'socks4' },
            { url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all', protocol: 'http' }
        ];

        const allProxies = new Set();
        let totalSoFar = 0;

        for (const source of sources) {
            if (onProgress) onProgress({ source: source.protocol, status: 'scraping', totalSoFar });
            
            try {
                const response = await axios.get(source.url, { timeout: 10000 });
                const lines = response.data.split(/\r?\n/);
                let sourceCount = 0;
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed && trimmed.includes(':')) {
                        allProxies.add(`${source.protocol}://${trimmed}`);
                        sourceCount++;
                    }
                }
                
                totalSoFar = allProxies.size;
                if (onProgress) onProgress({ source: source.protocol, status: 'completed', count: sourceCount, totalSoFar });
            } catch (err) {
                if (onProgress) onProgress({ source: source.protocol, status: 'failed', error: err.message, totalSoFar });
                console.error(`Failed to scrape from ${source.url}:`, err.message);
            }
        }

        return Array.from(allProxies);
    }
}
