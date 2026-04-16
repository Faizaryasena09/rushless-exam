import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

// --- CONFIGURATION & KEYS ---
const HWID_PASSWORD = "rushlessexam";
const LICENSE_PASSWORD = "Rush1esEx4m";
const AES_ALGORITHM = 'aes-256-gcm';

const HWID_KEY = crypto.createHash('sha256').update(HWID_PASSWORD).digest();
const LICENSE_KEY = crypto.createHash('sha256').update(LICENSE_PASSWORD).digest();

const LICENSE_SECRET = "rushless_hardware_hmac_secret_2024";

// --- CORE AES-256-GCM LOGIC ---

/**
 * Standard AES-256-GCM Encryption
 * Format: IV.AuthTag.Ciphertext
 */
export function encrypt(text, key = LICENSE_KEY) {
  if (!text) return null;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag().toString('base64');
    return `${iv.toString('base64')}.${authTag}.${encrypted}`;
  } catch (error) {
    console.error('Encryption Error:', error);
    return null;
  }
}

/**
 * Standard AES-256-GCM Decryption
 */
export function decrypt(encryptedText, key = LICENSE_KEY) {
  if (!encryptedText) return null;
  try {
    const parts = encryptedText.split('.');
    if (parts.length !== 3) return null;

    const [ivBase64, authTagBase64, encryptedBase64] = parts;
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    
    const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedBase64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    // console.error('Decryption error:', error.message);
    return null;
  }
}

// --- LICENSE SIGNING LOGIC ---

/**
 * Signs a license payload using AES-GCM (Encrypted Token).
 */
export function signLicense(data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  return encrypt(text);
}

/**
 * Verifies and decrypts an AES-GCM token.
 */
export function verifyLicense(token) {
  try {
    const decrypted = decrypt(token);
    if (!decrypted) return null;
    try {
        return JSON.parse(decrypted);
    } catch (e) {
        return decrypted; // Return as string if not JSON
    }
  } catch (e) {
    return null;
  }
}

/**
 * Helper to build the standardized license payload string for signature integrity.
 */
export function buildLicensePayload(pj, pj_email, instansi, kuota, paket, expiry, hwid) {
    const finalKuota = parseInt(kuota) === -1 ? -1 : (parseInt(kuota) || 1);
    const finalPaket = paket || 'Basic';
    
    return [
      pj || 'Tanpa Nama',
      pj_email || '',
      instansi || 'General',
      finalKuota,
      finalPaket,
      expiry || 'None',
      hwid
    ].join('|');
}

/**
 * High-level signature generation for the main system.
 */
export function generateSignature(pj, pj_email, instansi, kuota, paket, expiry, hwid) {
    const payload = buildLicensePayload(pj, pj_email, instansi, kuota, paket, expiry, hwid);
    return signLicense(payload);
}

// --- LEGACY / CUSTOM SIGNATURE LOGIC ---

/**
 * Generates a custom signature hash including license metadata and HWID.
 * (Used for Database Activation Key)
 */
export function generateCustomSignature(hwid, pj, instansi, kuota, expiry) {
  if (!hwid) return null;
  
  const sourceString = `${pj || ''}|${instansi || ''}|${kuota || ''}|${expiry || ''}|${hwid}`;
  const separators = ['-rushh-', '-less-', '-less-', '-exx-', '-amm'];
  let modifiedString = '';
  
  for (let i = 0; i < sourceString.length; i++) {
    modifiedString += sourceString[i];
    if (i < sourceString.length - 1) {
      modifiedString += separators[i % separators.length];
    }
  }

  return crypto.createHash('sha256').update(modifiedString).digest('hex');
}

/**
 * Generates a deterministic activation key based on license ID and hardware ID.
 */
export function generateActivationKey(licenseId, hardwareId) {
  return crypto
    .createHmac('sha256', LICENSE_SECRET)
    .update(`${licenseId}:${hardwareId}`)
    .digest('hex')
    .toUpperCase()
    .slice(0, 24);
}

// --- HWID & REQUEST CODE LOGIC (PRESERVED) ---

/**
 * Modern HWID Retrieval (Cross-platform)
 */
export function getHWID() {
    try {
        if (process.platform === 'win32') {
            try {
                const psOutput = execSync('powershell -command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
                if (psOutput && psOutput.length > 5) return psOutput;
            } catch (e) {}

            try {
                const output = execSync('wmic csproduct get uuid', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
                const lines = output.split('\n');
                const uuid = lines[1]?.trim();
                if (uuid && uuid !== 'UUID' && uuid !== '') return uuid;
            } catch (e) {}
        } else if (process.platform === 'darwin') {
            try {
                const macOutput = execSync("ioreg -rd1 -c IOPlatformExpertDevice | grep -E '(IOPlatformUUID|uuid)'", { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
                const match = macOutput.match(/\"([0-9a-fA-F-]{36})\"/);
                if (match) return match[1];
            } catch (e) {}
        } else {
            // --- LINUX ---
            const files = ['/etc/machine-id', '/var/lib/dbus/machine-id', '/sys/class/dmi/id/product_uuid'];
            for (const file of files) {
                if (fs.existsSync(file) && fs.statSync(file).isFile()) {
                    const id = fs.readFileSync(file, 'utf8').trim();
                    if (id) return id;
                }
            }
            
            // Fallback for Linux: dbus utility
            try {
                const dbusOutput = execSync('dbus-uuidgen --get', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
                if (dbusOutput) return dbusOutput;
            } catch (e) {}
        }
    } catch (error) {
        console.error('HWID Retrieval Error:', error);
    }
    
    // Final Fallback: Combination of platform, arch, and hostname (least unique)
    const fallback = `FALLBACK_${process.platform}_${os.arch()}_${os.hostname()}`;
    return crypto.createHash('sha256').update(fallback).digest('hex').toUpperCase();
}

/**
 * Generates the Request Code using AES-256-GCM.
 * (Preserved: Uses HWID_KEY)
 */
export function getRequestCode() {
    const hwid = getHWID();
    return encrypt(hwid, HWID_KEY);
}

/**
 * Decrypts the Request Code in Dashboard Tools.
 * (Preserved: Uses HWID_KEY)
 */
export function decryptHWID(encryptedHwid) {
    return decrypt(encryptedHwid, HWID_KEY);
}

/**
 * Alias for external usage
 */
export function decryptSignature(token) {
    return decrypt(token, LICENSE_KEY);
}
