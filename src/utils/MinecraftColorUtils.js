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
            return match;
        });

        // Ensure we reset at the end to avoid bleeding colors in console
        return result + '\x1b[0m';
    }

    /**
     * Converts a raw NBT chat object to ANSI string.
     * Handles the complex recursive structure seen in some kick messages.
     */
    static nbtToAnsi(nbt) {
        if (!nbt) return '';
        if (typeof nbt === 'string') return this.minecraftToAnsi(nbt);

        // Helper to extract value from NBT tag or raw object
        const getValue = (tag) => {
            if (tag === null || tag === undefined) return null;
            return (typeof tag === 'object' && tag.value !== undefined) ? tag.value : tag;
        };

        // Recursive processor with depth limit
        const process = (node, depth = 0) => {
            if (depth > 20) return '';
            if (node === null || node === undefined) return '';

            // Handle simple types
            if (typeof node === 'string') return node;
            if (typeof node === 'number' || typeof node === 'boolean') return String(node);

            // Handle NBT string type
            if (typeof node === 'object' && node.type === 'string' && node.value !== undefined) return node.value;

            let text = '';

            // Handle compound/object
            if (typeof node === 'object' && !Array.isArray(node)) {
                const val = (node.type === 'compound' && node.value) ? node.value : node;
                if (!val || typeof val !== 'object') return '';

                let codes = '';

                // Add color
                if (val.color) {
                    const colorName = getValue(val.color);
                    const colorCode = this.getColorCode(colorName);
                    if (colorCode) codes += colorCode;
                }

                // Add styles
                if (getValue(val.bold)) codes += '\x1b[1m';
                if (getValue(val.italic)) codes += '\x1b[3m';
                if (getValue(val.underlined)) codes += '\x1b[4m';
                if (getValue(val.strikethrough)) codes += '\x1b[9m';

                text += codes;

                // Text part
                const baseText = getValue(val.text);
                if (baseText) text += baseText;

                // Extra parts (recursive)
                const extra = getValue(val.extra);
                if (extra) {
                    const extraItems = (typeof extra === 'object' && extra.value !== undefined) ? extra.value : extra;
                    if (Array.isArray(extraItems)) {
                        for (const item of extraItems) {
                            text += process(item, depth + 1);
                        }
                    } else if (extraItems && typeof extraItems === 'object') {
                        text += process(extraItems, depth + 1);
                    }
                }

                // Reset if we added codes
                if (codes) text += '\x1b[0m';
            } else if (Array.isArray(node)) {
                for (const item of node) text += process(item, depth + 1);
            }

            return text;
        };

        return process(nbt);
    }

    static getColorCode(colorName) {
        if (!colorName) return '';

        const nameMap = {
            'black': '\x1b[30m', 'dark_blue': '\x1b[34m', 'dark_green': '\x1b[32m', 'dark_aqua': '\x1b[36m',
            'dark_red': '\x1b[31m', 'dark_purple': '\x1b[35m', 'gold': '\x1b[33m', 'gray': '\x1b[37m',
            'dark_gray': '\x1b[90m', 'blue': '\x1b[94m', 'green': '\x1b[92m', 'aqua': '\x1b[96m',
            'red': '\x1b[91m', 'light_purple': '\x1b[95m', 'yellow': '\x1b[93m', 'white': '\x1b[97m'
        };

        return nameMap[colorName.toLowerCase()] || '';
    }
}
