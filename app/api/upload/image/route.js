import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    const formData = await request.formData();
    let file = formData.get('files[0]'); 
    if (!file) {
      file = formData.get('files'); // Fallback for single file
    }
    if (!file) {
      file = formData.get('file'); // Fallback for some paste events
    }

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file found.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate a unique filename
    const filename = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'questions');
    const filePath = path.join(uploadDir, filename);

    // Write the file to the public directory
    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/questions/${filename}`;

    // Jodit expects a specific response format
    return NextResponse.json({
      success: true,
      files: [{
        name: filename,
        url: publicUrl,
        // Jodit may use 'file' as the key for the URL in some versions
        file: publicUrl 
      }],
      path: publicUrl,
      baseurl: '/uploads/questions/',
    });

  } catch (error) {
    console.error('Image upload failed:', error);
    return NextResponse.json({ success: false, message: 'Image upload failed.', error: error.message }, { status: 500 });
  }
}
