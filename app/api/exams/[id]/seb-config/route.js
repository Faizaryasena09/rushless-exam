import { query } from '@/app/lib/db';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export async function GET(request, { params }) {
    const { id: examId } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
        return NextResponse.json({ message: 'Token is required' }, { status: 400 });
    }

    try {
        // 1. Validate the temporary launch token
        const tokenRows = await query({
            query: 'SELECT user_id, expires_at FROM rhs_launch_tokens WHERE token = ?',
            values: [token]
        });

        if (tokenRows.length === 0 || new Date() > new Date(tokenRows[0].expires_at)) {
            return NextResponse.json({ message: 'Invalid or expired token' }, { status: 401 });
        }

        const userId = tokenRows[0].user_id;

        // 2. Fetch emergency password (quit password)
        const settingsRows = await query({
            query: "SELECT setting_value FROM rhs_web_settings WHERE setting_key = 'app_emergency_password'",
            values: []
        });
        const rawPassword = settingsRows[0]?.setting_value || '123456'; // Fallback to default if not set
        const hashedQuitPassword = crypto.createHash('sha256').update(rawPassword).digest('hex');

        // 3. Generate a NEW handoff token for the actual SEB startURL
        const handoffToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
        await query({
            query: 'INSERT INTO rhs_launch_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
            values: [handoffToken, userId, expiresAt]
        });

        // 4. Do not immediately delete the launch token, as SEB often performs a 
        // HEAD request followed by a GET request which would fail if deleted.
        // It will expire naturally in 5 minutes.

        // 5. Construct the PList XML
        const reqUrl = new URL(request.url);
        const searchParams = reqUrl.searchParams;
        
        // Use the exact protocol and host the browser is running on, bypassing proxy logic (like cloudflare tunnels routing to localhost)
        const clientProtocol = searchParams.get('clientProtocol');
        const clientHost = searchParams.get('clientHost');
        
        const domain = clientHost || request.headers.get('host') || reqUrl.host;
        const protocol = clientProtocol || request.headers.get('x-forwarded-proto') || reqUrl.protocol.replace(':', '');
        
        // Pass an absolute redirect URL to prevent the handoff route from redirecting to localhost behind a proxy
        const absoluteRedirect = `${protocol}://${domain}/dashboard/exams/kerjakan/${examId}`;
        const startURL = `${protocol}://${domain}/api/auth/handoff?token=${handoffToken}&amp;redirect=${encodeURIComponent(absoluteRedirect)}`;
        const quitURL = `${protocol}://${domain}/seb-quit-signal`;
        
        console.log(`\n========== SEB CONFIG GENERATION ==========`);
        console.log(`Requested Domain: ${reqUrl.host}`);
        console.log(`Client Protocol (from Chrome): ${clientProtocol}`);
        console.log(`Client Host (from Chrome): ${clientHost}`);
        console.log(`Final StartURL embedded: ${startURL}`);
        console.log(`===========================================\n`);

        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.EN">
<plist version="1.0">
<dict>
	<key>URLFilterEnable</key>
	<false/>
	<key>URLFilterEnableContentFilter</key>
	<false/>
	<key>allowQuit</key>
	<true/>
	<key>allowReload</key>
	<true/>
	<key>browserViewMode</key>
	<integer>0</integer>
	<key>hashedQuitPassword</key>
	<string>${hashedQuitPassword}</string>
	<key>ignoreExitKeys</key>
	<true/>
	<key>monitorSecondScreen</key>
	<true/>
	<key>newBrowserWindowAllow</key>
	<true/>
	<key>showNavigationButtons</key>
	<false/>
	<key>showQuitContextMenuItem</key>
	<true/>
	<key>prohibitQuit</key>
	<false/>
	<key>sendBrowserExamKey</key>
	<true/>
	<key>startURL</key>
	<string>${startURL}</string>
	<key>quitURL</key>
	<string>${quitURL}</string>
</dict>
</plist>`;

        // 6. Gzip the XML content and prepend 'plnd' prefix
        // This is the strict standard format for unencrypted SEB files.
        const zlib = require('zlib');
        const compressedXml = zlib.gzipSync(Buffer.from(xmlContent, 'utf-8'));
        const prefix = Buffer.from('plnd', 'utf-8');
        const payload = Buffer.concat([prefix, compressedXml]);

        return new Response(payload, {
            headers: {
                'Content-Type': 'application/seb',
                'Content-Disposition': `attachment; filename="exam_${examId}.seb"`,
            },
        });

    } catch (error) {
        console.error('Failed to generate SEB config:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
