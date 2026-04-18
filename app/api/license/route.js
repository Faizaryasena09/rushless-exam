import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { validateUserSession } from '@/app/lib/auth';
import { getLocalLicense, saveLocalLicense, syncLicenseStore, checkLicenseStatus } from '@/app/lib/license';
import { formatMySQLDate } from '@/app/lib/logger';
import { getHWID, decryptHWID, generateSignature, getRequestCode } from '@/app/lib/crypto';
import { query } from '@/app/lib/db';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

async function getSession() {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    if (!session.user) return null;
    const isValid = await validateUserSession(session);
    if (!isValid) return null;
    return session;
}

/**
 * GET: Returns status and HWID.
 */
export async function GET(req) {
    const session = await getSession();
    if (!session || !session.user || session.user.roleName !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'get-request-code') {
        const requestCode = getRequestCode();
        return NextResponse.json({ success: true, requestCode });
    }

    const hwid = getHWID();
    
    // 1. Lazy Integrity Check: Always verify signature before returning status
    const integrity = await checkLicenseStatus();
    if (!integrity.valid) {
        const LICENSE_FILE = path.join(process.cwd(), 'license_status.json');
        if (fs.existsSync(LICENSE_FILE)) {
            fs.unlinkSync(LICENSE_FILE);
        }
        return NextResponse.json({ success: false, status: 'inactive' });
    }

    const local = await getLocalLicense();

    return NextResponse.json({
        hwid,
        status: local.status,
        pj: local.pj,
        pj_email: local.pj_email || local.email,
        instansi: local.instansi,
        kuota: local.kuota,
        paket: local.paket,
        expiry: local.expiry,
        days_left: local.days_left,
        server_status: local.server_status,
        last_check: local.last_check
    });
}

/**
 * POST: Handles activation and deactivation.
 */
export async function POST(req) {
    const session = await getSession();
    if (!session || !session.user || session.user.roleName !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { action, content, password } = body;

        if (action === 'upload') {
            let decodedContent;
            try {
                decodedContent = Buffer.from(content, 'base64').toString();
            } catch (e) {
                return NextResponse.json({ success: false, message: 'Invalid File Format (Not Base64)' });
            }

            let licenseData;
            try {
                // If the content is JSON, use it. If not, try to parse it after decoding.
                try {
                    licenseData = JSON.parse(decodedContent);
                } catch (e) {
                    // Maybe it's not base64 in the content but raw JSON? 
                    // (Unlikely based on user requirement, but let's be safe)
                    licenseData = JSON.parse(content);
                }
            } catch (e) {
                return NextResponse.json({ success: false, message: 'Invalid License Data (Not JSON or Base64)' });
            }

            const { signature, pj, instansi, kuota, paket, finalExpiry, expiry } = licenseData;
            const pj_email = licenseData.pj_email || licenseData.email;
            const lastExpiry = finalExpiry || expiry;
            
            const hwid = getHWID();
            const { buildLicensePayload, decryptSignature } = require('../../lib/crypto');
            const expectedPayload = buildLicensePayload(pj, pj_email, instansi, kuota, paket, lastExpiry, hwid);
            const decryptedPayload = decryptSignature(signature);

            if (decryptedPayload !== expectedPayload) {
                
                return NextResponse.json({ 
                    success: false, 
                    message: 'License Signature Mismatch (Invalid or Corrupted File).' 
                });
            }

            let daysLeft = -1;
            if (lastExpiry !== 'None') {
                const expDate = new Date(lastExpiry);
                if (isNaN(expDate.getTime()) || expDate < new Date()) {
                    return NextResponse.json({ success: false, message: 'License has expired.' });
                }
                daysLeft = Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24));
            }
            
            await saveLocalLicense({
                status: 'active',
                pj: pj || 'Tanpa Nama',
                pj_email: pj_email || '',
                instansi: instansi || 'General',
                kuota: parseInt(kuota) === -1 ? -1 : (parseInt(kuota) || 1),
                paket: paket || 'Basic',
                expiry: lastExpiry || 'None',
                signature,
                days_left: daysLeft,
                last_check: formatMySQLDate()
            });

            // --- IMMEDIATE SERVER SYNC ---
            // After saving locally, immediately check with the server
            const isServerValid = await syncLicenseStore();
            if (!isServerValid) {
                const LICENSE_FILE = path.join(process.cwd(), 'license_status.json');
                if (fs.existsSync(LICENSE_FILE)) {
                    fs.unlinkSync(LICENSE_FILE);
                }
                return NextResponse.json({ 
                    success: false, 
                    message: 'License was rejected by the central server (Hardware mismatch or revoked).' 
                });
            }

            return NextResponse.json({ success: true, message: 'License activated successfully and verified by server.' });
        }

        if (action === 'check') {
            const result = await syncLicenseStore();
            return NextResponse.json({ success: true, result });
        }

        if (action === 'deactivate') {
            if (!password) return NextResponse.json({ message: 'Password required' }, { status: 400 });

            const userId = session.user.id;
            const users = await query({
                query: 'SELECT password FROM rhs_users WHERE id = ?',
                values: [userId]
            });

            if (users.length === 0) return NextResponse.json({ message: 'User not found' }, { status: 404 });
            const user = users[0];

            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return NextResponse.json({ success: false, message: 'Invalid admin password' }, { status: 401 });
            }

            // Update database status
            await saveLocalLicense({ status: 'inactive' });

            const LICENSE_FILE = path.join(process.cwd(), 'license_status.json');
            if (fs.existsSync(LICENSE_FILE)) {
                fs.unlinkSync(LICENSE_FILE);
            }

            return NextResponse.json({ success: true, message: 'License detached successfully' });
        }

        return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('API License Error:', error);
        return NextResponse.json({ message: 'Error processing request' }, { status: 500 });
    }
}
