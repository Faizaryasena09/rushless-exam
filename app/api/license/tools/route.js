import { NextResponse } from 'next/server';
import { decryptHWID, generateSignature } from '@/app/lib/crypto';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';

export async function POST(req) {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        
        // Ensure only admin can access these tools
        if (!session.user || session.user.roleName !== 'admin') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { action } = body;

        if (action === 'decrypt') {
            const encryptedHwid = body.data;
            const hwid = decryptHWID(encryptedHwid);
            if (!hwid) return NextResponse.json({ success: false, message: 'Invalid encrypted data' });
            return NextResponse.json({ success: true, hwid });
        }

        if (action === 'generate') {
            const { hwid, pj, emailPj, instansi, kuota, paket, expiryDate } = body;
            
            // 1. Generate the security signature block
            // Use the same mapping as the user's snippet
            const signature = generateSignature(pj, emailPj, instansi, kuota, paket, expiryDate, hwid);

            // 2. Format the license file content (Match user's JSON structure)
            const finalKuota = parseInt(kuota) === -1 ? -1 : (parseInt(kuota) || 1);
            const finalPaket = paket || 'Basic';

            const licenseData = {
                pj: pj || 'Tanpa Nama',
                email: emailPj || '',
                instansi: instansi || 'General',
                kuota: finalKuota,
                paket: finalPaket,
                expiry: expiryDate || 'None',
                signature
            };

            const jsonString = JSON.stringify(licenseData, null, 2);
            const content = Buffer.from(jsonString).toString('base64');
            return NextResponse.json({ 
                success: true, 
                content,
                license: licenseData, // Include for debug as per user snippet style
                hwid
            });
        }

        return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('License tool error:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}
