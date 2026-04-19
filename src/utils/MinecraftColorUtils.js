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

        // we reset at the end to avoid bleeding colors
        return result + '\x1b[0m';
    }

    /**
     * Converts a raw NBT chat object to ANSI string.
     * Handles the complex recursive structure seen in some kick messages.
     */
    static nbtToAnsi(nbt) {
        if (!nbt) return '';
        if (typeof nbt === 'string') return this.minecraftToAnsi(nbt);

        const getValue = (tag) => {
            if (tag === null || tag === undefined) return null;
            if (typeof tag === 'object') {
                if (tag.value !== undefined) return getValue(tag.value);
                return tag;
            }
            return tag;
        };

        const processNode = (node, parentFormat = '', depth = 0) => {
            if (depth > 25) return '';
            if (node === null || node === undefined) return '';

            const val = getValue(node);
            if (typeof val === 'string') return parentFormat + val + (parentFormat ? '\x1b[0m' : '');
            if (typeof val === 'number' || typeof val === 'boolean') return parentFormat + String(val) + (parentFormat ? '\x1b[0m' : '');

            let text = '';
            let currentFormat = parentFormat;

            if (typeof val === 'object' && !Array.isArray(val)) {
                if (val.color) {
                    const colorCode = this.getColorCode(getValue(val.color));
                    if (colorCode) currentFormat = colorCode;
                }

                if (getValue(val.bold)) currentFormat += '\x1b[1m';
                if (getValue(val.italic)) currentFormat += '\x1b[3m';
                if (getValue(val.underlined)) currentFormat += '\x1b[4m';
                if (getValue(val.strikethrough)) currentFormat += '\x1b[9m';

                const baseText = getValue(val.text);
                if (baseText) {
                    let wrapped = baseText;
                    const hover = getValue(val.hoverEvent);
                    if (hover) {
                        const contents = getValue(hover.contents) || getValue(hover.value);
                        const hoverText = (typeof contents === 'object') ? this.nbtToAnsi(contents) : String(contents);
                        if (hoverText) wrapped = `\x1b]imc;h:${Buffer.from(hoverText).toString('base64')}\x1b\\${wrapped}\x1b]imc;h\x1b\\`;
                    }
                    const click = getValue(val.clickEvent);
                    if (click) {
                        const action = getValue(click.action);
                        const value = getValue(click.value);
                        if (action && value) wrapped = `\x1b]imc;c:${Buffer.from(`${action}:${value}`).toString('base64')}\x1b\\${wrapped}\x1b]imc;c\x1b\\`;
                    }
                    text += currentFormat + wrapped + (currentFormat ? '\x1b[0m' : '');
                }

                const extra = getValue(val.extra);
                if (extra) {
                    const extraItems = getValue(extra);
                    if (Array.isArray(extraItems)) {
                        for (const item of extraItems) text += processNode(item, currentFormat, depth + 1);
                    } else {
                        text += processNode(extra, currentFormat, depth + 1);
                    }
                }
            } else if (Array.isArray(val)) {
                for (const item of val) text += processNode(item, parentFormat, depth + 1);
            }

            return text;
        };

        return processNode(nbt);
    }

    static getColorCode(colorName) {
        if (!colorName) return '';

        if (colorName.startsWith('#')) {
            const hex = colorName.slice(1);
            if (hex.length === 6) {
                const r = parseInt(hex.slice(0, 2), 16);
                const g = parseInt(hex.slice(2, 4), 16);
                const b = parseInt(hex.slice(4, 6), 16);
                return `\x1b[38;2;${r};${g};${b}m`;
            }
        }

        const nameMap = {
            'black': '\x1b[30m', 'dark_blue': '\x1b[34m', 'dark_green': '\x1b[32m', 'dark_aqua': '\x1b[36m',
            'dark_red': '\x1b[31m', 'dark_purple': '\x1b[35m', 'gold': '\x1b[33m', 'gray': '\x1b[37m',
            'dark_gray': '\x1b[90m', 'blue': '\x1b[94m', 'green': '\x1b[92m', 'aqua': '\x1b[96m',
            'red': '\x1b[91m', 'light_purple': '\x1b[95m', 'yellow': '\x1b[93m', 'white': '\x1b[97m'
        };

        return nameMap[colorName.toLowerCase()] || '';
    }
}
