export class MinecraftColorUtils {
    static minecraftToAnsi(text) {
        if (!text) return '';

        const colorMap = {
            '0': '\x1b[30m', '1': '\x1b[34m', '2': '\x1b[32m', '3': '\x1b[36m',
            '4': '\x1b[31m', '5': '\x1b[35m', '6': '\x1b[33m', '7': '\x1b[37m',
            '8': '\x1b[90m', '9': '\x1b[94m', 'a': '\x1b[92m', 'b': '\x1b[96m',
            'c': '\x1b[91m', 'd': '\x1b[95m', 'e': '\x1b[93m', 'f': '\x1b[97m'
        };

        const styleMap = {
            'l': '\x1b[1m', // Bold
            'm': '\x1b[9m', // Strikethrough
            'n': '\x1b[4m', // Underline
            'o': '\x1b[3m', // Italic
            'r': '\x1b[0m'  // Reset
        };

        let result = '';
        let currentText = text;

        // Replace § with \x1b codes
        const regex = /§([0-9a-fk-or])/g;
        result = currentText.replace(regex, (match, code) => {
            if (colorMap[code]) return colorMap[code];
            if (styleMap[code]) return styleMap[code];
            if (code === 'r') return '\x1b[0m';
            return match; // Should not happen with regex
        });

        // Ensure we reset at the end to avoid bleeding colors in console
        return result + '\x1b[0m';
    }
}
