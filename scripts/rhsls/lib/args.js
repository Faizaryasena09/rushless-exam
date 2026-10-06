'use strict';

/**
 * Parser argumen sederhana + saran typo (levenshtein).
 * Format: rhsls <namespace>:<command> [opsi] [--flag] [--key value]
 */

const TRUE_FLAGS = new Set([
    'yes', 'y', 'no-color', 'color', 'json', 'quiet', 'help', 'h',
    'dry-run', 'force', 'generate', 'no-uploads', 'no-secrets', 'gzip',
    'db-only', 'files-only', 'skip-verify', 'no-safety-backup', 'force-db-name',
    'online', 'locked', 'never-login', 'keep-answers', 'all',
    'keep-attempts', 'update', 'with-email', 'no-color',
]);

const ALIASES = {
    y: 'yes',
    h: 'help',
    n: 'no',
    v: 'version',
};

/**
 * @param {string[]} argv daftar argumen tanpa node & nama script
 */
function parseArgs(argv) {
    const positional = [];
    const flags = {};
    const unknownValueFlags = [];

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];

        if (token === '--') {
            positional.push(...argv.slice(i + 1));
            break;
        }

        if (token.startsWith('--')) {
            let key = token.slice(2);
            let value;

            const eq = key.indexOf('=');
            if (eq !== -1) {
                value = key.slice(eq + 1);
                key = key.slice(0, eq);
            }

            key = ALIASES[key] || key;

            if (value !== undefined) {
                flags[key] = value;
            } else if (TRUE_FLAGS.has(key)) {
                flags[key] = true;
            } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
                flags[key] = argv[i + 1];
                i += 1;
            } else {
                flags[key] = true;
                unknownValueFlags.push(key);
            }
        } else if (token.startsWith('-') && token.length > 1 && !/^-\d/.test(token)) {
            const key = ALIASES[token.slice(1)] || token.slice(1);
            flags[key] = true;
        } else {
            positional.push(token);
        }
    }

    return { positional, flags, unknownValueFlags };
}

function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i += 1) {
        const curr = [i];
        for (let j = 1; j <= n; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        prev = curr;
    }
    return prev[n];
}

/** Cari perintah terdekat dari nama yang diketik user */
function suggest(input, candidates) {
    const lower = String(input).toLowerCase();
    let best = null;
    let bestScore = Infinity;

    candidates.forEach((candidate) => {
        const distance = levenshtein(lower, candidate.toLowerCase());
        const score = candidate.toLowerCase().startsWith(lower.slice(0, 3)) ? distance - 2 : distance;
        if (score < bestScore) {
            bestScore = score;
            best = candidate;
        }
    });

    const threshold = Math.max(2, Math.floor(lower.length / 3));
    return bestScore <= threshold ? best : null;
}

module.exports = { parseArgs, suggest, levenshtein };