import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { generateSignature, getHWID } from './crypto';
import { query } from './db';

const LICENSE_FILE = path.join(process.cwd(), 'license_status.json');


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
        const response = await fetch('https://license.sensrvr.my.id/api/check', {
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
