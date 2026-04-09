import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { generateSignature } from './crypto';
import { query } from './db';

const LICENSE_FILE = path.join(process.cwd(), 'license_status.json');

/**
 * Retrieves a unique Hardware ID (HWID) for the current machine.
 * Supports Windows, Linux, and macOS with multiple fallback methods.
 */
export function getHWID() {
    try {
        if (process.platform === 'win32') {
            // --- WINDOWS ---
            // Method 1: PowerShell (Modern - Get-CimInstance)
            try {
                const psOutput = execSync('powershell -command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
                if (psOutput && psOutput.length > 5) return psOutput;
            } catch (e) {}

            // Method 2: WMIC (Legacy but reliable on older systems)
            try {
                const output = execSync('wmic csproduct get uuid', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
                const lines = output.split('\n');
                const uuid = lines[1]?.trim();
                if (uuid && uuid !== 'UUID' && uuid !== '') return uuid;
            } catch (e) {}

            // Method 3: Registry MachineGuid (Harder to spoof)
            try {
                const regOutput = execSync('reg query HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
                const match = regOutput.match(/[0-9a-fA-F-]{36}/);
                if (match) return match[0];
            } catch (e) {}
        } else if (process.platform === 'darwin') {
            // --- MACOS ---
            try {
                const macOutput = execSync("ioreg -rd1 -c IOPlatformExpertDevice | grep -E '(IOPlatformUUID|uuid)'", { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
                const match = macOutput.match(/\"([0-9a-fA-F-]{36})\"/);
                if (match) return match[1];
            } catch (e) {}
        } else {
            // --- LINUX ---
            const files = [
                '/etc/machine-id', 
                '/var/lib/dbus/machine-id', 
                '/sys/class/dmi/id/product_uuid'
            ];
            for (const file of files) {
                if (fs.existsSync(file) && fs.statSync(file).isFile()) {
                    const id = fs.readFileSync(file, 'utf8').trim();
                    if (id) return id;
                }
            }
            
            // Fallback for Linux: hostnamectl or dbus
            try {
                const dbusOutput = execSync('dbus-uuidgen --get', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
                if (dbusOutput) return dbusOutput;
            } catch (e) {}
        }
    } catch (error) {
        console.error('Failed to get HWID:', error);
    }
    
    // Final Fallback: Combination of platform, arch, and hostname (least unique)
    const fallback = `FALLBACK_${process.platform}_${os.arch()}_${os.hostname()}`;
    return crypto.createHash('sha256').update(fallback).digest('hex').toUpperCase();
}

/**
 * Reads the local license status from the database.
 * Includes a one-time migration from license_status.json if DB is empty.
 */
export async function getLocalLicense() {
    try {
        const results = await query({
            query: 'SELECT * FROM rhs_license WHERE id = 1'
        });

        if (results && results.length > 0) {
            return results[0];
        }

        // Migration logic: If DB is empty, check for the legacy JSON file
        if (fs.existsSync(LICENSE_FILE)) {
            try {
                const legacyData = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
                if (legacyData && legacyData.status) {
                    // Migrate to DB
                    await saveLocalLicense(legacyData);
                    console.log('[License] Successfully migrated license from file to database.');
                    // Note: We don't delete the file immediately for safety, 
                    // but we will prioritize the DB from now on.
                    return legacyData;
                }
            } catch (err) {
                console.error('[License] Failed to migrate legacy license file:', err);
            }
        }

        return { status: 'inactive' };
    } catch (error) {
        console.error('[License] Database error while fetching license:', error);
        return { status: 'inactive' };
    }
}

/**
 * Saves the license status to the database.
 */
export async function saveLocalLicense(data) {
    try {
        await query({
            query: `
                INSERT INTO rhs_license (
                    id, status, pj, pj_email, instansi, kuota, paket, expiry, signature, last_check, server_status
                ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    status = VALUES(status),
                    pj = VALUES(pj),
                    pj_email = VALUES(pj_email),
                    instansi = VALUES(instansi),
                    kuota = VALUES(kuota),
                    paket = VALUES(paket),
                    expiry = VALUES(expiry),
                    signature = VALUES(signature),
                    last_check = VALUES(last_check),
                    server_status = VALUES(server_status)
            `,
            values: [
                data.status || 'inactive',
                data.pj || '',
                data.pj_email || '',
                data.instansi || '',
                data.kuota || 0,
                data.paket || 'Basic',
                data.expiry || 'None',
                data.signature || '',
                data.last_check ? data.last_check.replace('T', ' ').slice(0, 19) : new Date().toISOString().slice(0, 19).replace('T', ' '),
                data.server_status || 'offline'
            ]
        });
    } catch (error) {
        console.error('[License] Failed to save license to database:', error);
    }
}

/**
 * Validates the license status.
 * Returns true if the license is active and valid.
 */
export async function checkLicenseStatus() {
    const local = await getLocalLicense();
    if (!local || local.status !== 'active' || !local.signature) {
        return { valid: false, status: local.status || 'inactive' };
    }

    // 1. Verify Multi-Field Signature (Decryption-based)
    const hwid = getHWID();
    const { buildLicensePayload, decryptSignature } = require('./crypto'); // Lazy import
    const expectedPayload = buildLicensePayload(local.pj, local.pj_email, local.instansi, local.kuota, local.paket, local.expiry, hwid);
    
    const decryptedPayload = decryptSignature(local.signature);
    
    if (decryptedPayload !== expectedPayload) {
        return { valid: false, status: 'invalid_hwid' };
    }

    // 2. Verify Expiry
    let daysLeft = -1;
    if (local.expiry !== 'None') {
        const expiryDate = new Date(local.expiry);
        if (isNaN(expiryDate.getTime()) || expiryDate < new Date()) {
            return { valid: false, status: 'expired' };
        }
        daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
    }

    return { valid: true, status: 'active', days_left: daysLeft };
}

/**
 * Performs activation against the server (Legacy - redirect to new flow if possible).
 */
export async function activateLicense(licenseIdFromUser) {
    // This is no longer the primary way. 
    // New flow uses file upload which is handled in the route directly for now.
    return { success: false, message: 'Please use the new License File (.rhslcs) activation flow.' };
}

/**
 * Sinkronisasi/Heartbeat berkala ke server (Online + Offline Validation).
 */
export async function syncLicenseStore() {
    const local = await getLocalLicense();
    if (!local || local.status !== 'active') return false;

    // 1. Offline Validation First
    const offlineStatus = await checkLicenseStatus();
    if (!offlineStatus.valid) {
        // Clear DB status on failure
        await saveLocalLicense({ ...local, status: 'inactive' });
        return false;
    }

    // 2. Online Heartbeat (Hybrid)
    try {
        const response = await fetch('https://license.sensrvr.my.id:3001/api/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                signature: local.signature
            }),
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (response.ok) {
            const data = await response.json();
            
            if (data.valid) {
                await saveLocalLicense({
                    ...local,
                    days_left: offlineStatus.days_left,
                    server_status: 'online',
                    last_check: new Date().toISOString()
                });
                return true;
            } else {
                // If server explicitly says it is invalid (revoked/blacklisted)
                await saveLocalLicense({
                    ...local,
                    status: 'inactive',
                    server_status: 'revoked',
                    last_check: new Date().toISOString()
                });
                return false;
            }
        }
    } catch (error) {
        // Network error/Timeout: Allow legacy offline mode if signature is valid locally
        
        await saveLocalLicense({
            ...local,
            days_left: offlineStatus.days_left,
            server_status: 'offline',
            last_check: new Date().toISOString()
        });
        return true; 
    }

    return false;
}
