import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { requireAdmin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const admin = await requireAdmin();

    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;


    if (!file) {
      return NextResponse.json({ ok: false, error: 'No file received' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'File size must be less than 10MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'drivers');
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      console.error('Error creating uploads directory:', error);
      // Directory might already exist, ignore
    }

    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const filename = `driver-${timestamp}-${random}.jpg`;

    // Resize and compress image
    let finalBuffer: Buffer;
    try {
      finalBuffer = await sharp(buffer)
        .resize(300, 300, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch (sharpError) {
      console.error('Sharp processing failed, saving original file:', sharpError);
      // If Sharp fails, save the original file
      finalBuffer = buffer;
    }

    // Save file
    const filepath = join(uploadsDir, filename);
    await writeFile(filepath, finalBuffer);

    // Return the public path
    const publicPath = `/uploads/drivers/${filename}`;

    return NextResponse.json({ ok: true, path: publicPath });
  } catch (error: any) {
    console.error('Error uploading driver photo:', error);
    // Return specific error status if it's an auth error
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: 'Failed to upload photo' }, { status: 500 });
  }
}