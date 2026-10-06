'use strict';

/**
 * Pemuat environment untuk rhsls.
 * Urutan: .env.local -> .env (nilai yang sudah ada di process.env TIDAK ditimpa).
 * Bisa diganti lewat flag --env-file.
 */

const fs = require('fs');
const path = require('path');

function parseEnvFile(filePath) {
    const out = {};
    if (!fs.existsSync(filePath)) return out;

    let content;
    try {
        content = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
        return out;
    }

    content.split(/\r?\n/).forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) return;
        const eq = line.indexOf('=');
        if (eq === -1) return;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        // buang kutip pembungkus
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (key) out[key] = value;
    });

    return out;
}

function loadEnv(cwd = process.cwd(), explicitFile) {
    const loaded = [];
    const candidates = explicitFile
        ? [path.resolve(cwd, explicitFile)]
        : [path.join(cwd, '.env.local'), path.join(cwd, '.env')];

    candidates.forEach((file) => {
        const parsed = parseEnvFile(file);
        Object.keys(parsed).forEach((key) => {
            if (process.env[key] === undefined) {
                process.env[key] = parsed[key];
                loaded.push(`${key} (${path.basename(file)})`);
            }
        });
    });

    return { loaded, files: candidates.filter((f) => fs.existsSync(f)) };
}

/** Path folder upload: env > docker mount > ./public/uploads */
function resolveUploadsDir(cwd = process.cwd()) {
    const fromEnv = process.env.RHSLS_UPLOADS_DIR;
    if (fromEnv) return path.resolve(cwd, fromEnv);

    const dockerMount = '/var/lib/rushless-data/uploads';
    if (process.platform !== 'win32' && fs.existsSync(dockerMount)) return dockerMount;

    return path.join(cwd, 'public', 'uploads');
}

/** Folder tempat paket backup disimpan */
function resolveBackupDir(cwd = process.cwd()) {
    const fromEnv = process.env.RHSLS_BACKUP_DIR;
    if (fromEnv) return path.resolve(cwd, fromEnv);
    return path.join(cwd, 'backups');
}

module.exports = { loadEnv, parseEnvFile, resolveUploadsDir, resolveBackupDir };