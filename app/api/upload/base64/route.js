import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

// Helper to get file extension from mime type
const getExtension = (mimeType) => {
    switch (mimeType) {
        case 'image/png': return 'png';
        case 'image/jpeg': return 'jpg';
        case 'image/gif': return 'gif';
        case 'image/webp': return 'webp';
        default: return 'png'; // Default to png
    }
}

export async function POST(request) {
  try {
    const { data } = await request.json();
    if (!data) {
      return NextResponse.json({ success: false, message: 'No image data found.' }, { status: 400 });
    }

    // The data is a Base64 string, e.g., "data:image/png;base64,iVBORw0KGgo..."
    const matches = data.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        return NextResponse.json({ success: false, message: 'Invalid Base64 image format.' }, { status: 400 });
    }
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    const extension = getExtension(mimeType);
    const filename = `${Date.now()}-image.${extension}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'questions');
    const filePath = path.join(uploadDir, filename);

    // Write the file to the public directory
    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/questions/${filename}`;

    return NextResponse.json({ success: true, url: publicUrl });

  } catch (error) {
    console.error('Base64 image upload failed:', error);
    return NextResponse.json({ success: false, message: 'Image upload failed.', error: error.message }, { status: 500 });
  }
}
