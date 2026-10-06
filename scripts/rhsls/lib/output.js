'use strict';

/**
 * Output & interaksi terminal untuk rhsls.
 * Menangani: warna, tabel, spinner, prompt, konfirmasi, mode JSON, ringkasan aksi.
 */

const readline = require('readline');

const CODES = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
    blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', grey: '\x1b[90m',
    bgRed: '\x1b[41m', bgGreen: '\x1b[42m',
};

function createOutput(options = {}) {
    let colorEnabled = options.color;
    if (colorEnabled === undefined) {
        colorEnabled = !process.env.NO_COLOR &&
            process.env.TERM !== 'dumb' &&
            process.stdout.isTTY !== false;
    }

    const jsonMode = !!options.json;
    const quiet = !!options.quiet;

    const paint = (code, text) => (colorEnabled ? `${CODES[code]}${text}${CODES.reset}` : text);

    const out = {
        get colorEnabled() { return colorEnabled; },
        get jsonMode() { return jsonMode; },

        setColor(v) { colorEnabled = !!v; },
        setQuiet(v) { quiet = !!v; },

        // ---- primitives ----
        write(text = '') { if (!quiet && !jsonMode) process.stdout.write(text); },
        line(text = '') { out.write(text + '\n'); },

        title(text) {
            if (jsonMode) return;
            out.line();
            out.line(paint('bold', text));
            out.line(paint('grey', '─'.repeat(Math.min(72, text.length + 4))));
        },

        section(text) {
            if (jsonMode) return;
            out.line();
            out.line(paint('cyan', '▸ ' + text));
        },

        success(text) { if (!jsonMode) out.line(`${paint('green', '✔')} ${text}`); },
        warn(text) { if (!jsonMode) out.line(`${paint('yellow', '!')} ${text}`); },
        error(text) { if (!jsonMode) process.stderr.write(`${paint('red', '✖')} ${text}\n`); },
        info(text) { if (!jsonMode) out.line(`${paint('blue', 'i')} ${text}`); },
        dim(text) { return paint('grey', text); },
        bold(text) { return paint('bold', text); },

        ok(text) { return paint('green', text); },
        bad(text) { return paint('red', text); },
        hi(text) { return paint('cyan', text); },
        warnColor(text) { return paint('yellow', text); },

        // ---- tabel ----
        table(rows, columns) {
            if (jsonMode || quiet || !rows || rows.length === 0) return;
            const cols = columns || Object.keys(rows[0]);

            const widths = cols.map((col) => {
                const headerLen = col.length;
                const maxCell = rows.reduce((max, row) => {
                    const v = row[col];
                    const len = v === null || v === undefined ? 0 : String(v).length;
                    return Math.max(max, len);
                }, 0);
                return Math.min(60, Math.max(headerLen, maxCell));
            });

            const line = (cells, painter) => {
                const text = cols.map((col, i) => {
                    const raw = cells[i] === null || cells[i] === undefined ? '' : String(cells[i]);
                    const clipped = raw.length > widths[i] ? raw.slice(0, widths[i] - 1) + '…' : raw;
                    return clipped.padEnd(widths[i], ' ');
                }).join('  ');
                out.line(painter ? painter(text) : text);
            };

            line(cols, (t) => paint('bold', t));
            line(cols.map((_, i) => '─'.repeat(widths[i])), (t) => paint('grey', t));
            rows.forEach((row) => line(cols.map((c) => row[c])));
            out.line();
            out.line(paint('grey', `${rows.length} baris`));
        },

        /** daftar key-value ringkas */
        keyValues(pairs) {
            if (jsonMode || quiet) return;
            const width = pairs.reduce((max, [k]) => Math.max(max, String(k).length), 0);
            pairs.forEach(([k, v]) => {
                out.line(`  ${paint('grey', String(k).padEnd(width, ' '))}  ${v === null || v === undefined ? '-' : v}`);
            });
            out.line();
        },

        /** JSON mode:-printed di akhir perintah */
        emit(data) {
            if (jsonMode) process.stdout.write(JSON.stringify(data, null, 2) + '\n');
        },

        /** Ringkasan setelah mutasi */
        summary(done, skipped, extra) {
            if (jsonMode) return;
            const parts = [];
            if (done !== undefined && done !== null) parts.push(paint('green', `${done} berhasil`));
            if (skipped) parts.push(paint('yellow', `${skipped} dilewati`));
            if (extra) parts.push(paint('grey', extra));
            if (parts.length) out.line();
            out.line(`  ${parts.join(paint('grey', ' · '))}`);
            out.line();
        },

        // ---- spinner ----
        spinner(text) {
            if (jsonMode || quiet || !process.stdout.isTTY) {
                return { update() {}, stop() {} };
            }
            const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
            let i = 0;
            process.stdout.write(paint('cyan', frames[0]) + ' ' + text);
            const timer = setInterval(() => {
                i = (i + 1) % frames.length;
                process.stdout.write('\r' + paint('cyan', frames[i]) + ' ' + text);
            }, 80);
            return {
                update(msg) {
                    process.stdout.write('\r' + ' '.repeat(60) + '\r' + paint('cyan', frames[i]) + ' ' + msg);
                },
                stop(finalText) {
                    clearInterval(timer);
                    process.stdout.write('\r' + ' '.repeat(80) + '\r');
                    if (finalText) out.line(finalText);
                }
            };
        },

        progressBar(current, total, label) {
            if (jsonMode || quiet || !process.stdout.isTTY || total === 0) return;
            const width = 28;
            const ratio = Math.min(1, current / total);
            const filled = Math.round(width * ratio);
            const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
            const pct = String(Math.round(ratio * 100)).padStart(3, ' ');
            process.stdout.write(`\r  ${paint('cyan', bar)} ${pct}%  ${label || ''}          `);
            if (current >= total) process.stdout.write('\n');
        }
    };

    // ---- prompt ----
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    out.closePrompt = () => rl.close();

    out.ask = (question, defaultValue = '') => new Promise((resolve) => {
        const suffix = defaultValue ? paint('grey', ` [${defaultValue}]`) : '';
        rl.question(`${question}${suffix}: `, (answer) => {
            resolve((answer || '').trim() || defaultValue);
        });
    });

    out.askPassword = (question) => new Promise((resolve) => {
        // sembunyikan input bila terminal mendukung
        const output = rl.output;
        let muted = false;
        const origWrite = output.write.bind(output);
        output.write = (chunk) => {
            if (muted) {
                const s = String(chunk);
                if (s.includes('\n')) return origWrite(s);
                return origWrite('*');
            }
            return origWrite(chunk);
        };
        rl.question(`${question}: `, (answer) => {
            output.write = origWrite;
            out.write('\n');
            resolve((answer || '').trim());
        });
        muted = true;
    });

    out.confirm = (question, defaultYes = false) => new Promise((resolve) => {
        const hint = defaultYes ? 'Y/n' : 'y/N';
        rl.question(`${question} ${paint('grey', `[${hint}]`)} `, (answer) => {
            const a = (answer || '').trim().toLowerCase();
            if (!a) return resolve(defaultYes);
            resolve(a === 'y' || a === 'yes' || a === 'ya');
        });
    });

    return out;
}

function humanBytes(bytes) {
    if (bytes === null || bytes === undefined) return '-';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = Number(bytes);
    let i = 0;
    while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1; }
    return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function humanDuration(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    if (s < 60) return `${s} detik`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} menit`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} jam ${m % 60} menit`;
    return `${Math.floor(h / 24)} hari ${h % 24} jam`;
}

module.exports = { createOutput, humanBytes, humanDuration, CODES };