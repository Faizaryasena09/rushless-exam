import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';

export async function GET(request, { params }) {
    try {
        const resolvedParams = await params;
        const filePathArray = resolvedParams.path;
        if (!filePathArray || filePathArray.length === 0) {
            return NextResponse.json({ message: 'File path is required' }, { status: 400 });
        }

        const relativePath = path.join(...filePathArray);
        // Security: Prevent directory traversal
        if (relativePath.includes('..')) {
            return NextResponse.json({ message: 'Invalid path' }, { status: 400 });
        }

        // Public assets like website branding/logo do not require user authentication
        // (needed on login page and public views before user logs in)
        const filename = path.basename(relativePath).toLowerCase();
        const isPublicAsset = filename.startsWith('site-logo') || 
                              filename.startsWith('logo') || 
                              filename === 'favicon.ico';

        if (!isPublicAsset) {
            const session = await getIronSession(await cookies(), sessionOptions);
            if (!session.user) {
                return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
            }
        }

        const fullPath = path.join(process.cwd(), 'public', 'uploads', relativePath);

        try {
            const fileBuffer = await fs.readFile(fullPath);
            const ext = path.extname(fullPath).toLowerCase();
            
            const mimeTypes = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.webp': 'image/webp',
                '.ico': 'image/x-icon',
                '.pdf': 'application/pdf',
                '.zip': 'application/zip'
            };

            const contentType = mimeTypes[ext] || 'application/octet-stream';

            return new NextResponse(fileBuffer, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': isPublicAsset
                        ? 'public, max-age=86400, stale-while-revalidate=604800'
                        : 'public, max-age=31536000, immutable',
                },
            });
        } catch (err) {
            return NextResponse.json({ message: 'File not found' }, { status: 404 });
        }
    } catch (error) {
        console.error('Media serving error:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}
