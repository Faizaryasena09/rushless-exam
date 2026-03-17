
import { NextResponse } from 'next/server';
import { resetDatabase } from '@/app/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  
  if (key !== '@Rushless123') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await resetDatabase();
    return NextResponse.json({ 
      message: 'Database has been successfully reset. All data removed. Default admin (admin/admin) created.',
      success: true 
    });
  } catch (error) {
    console.error("Reset failed:", error);
    return NextResponse.json({ 
      message: 'Database reset failed.',
      error: error.message 
    }, { status: 500 });
  }
}

// Also support POST for more "standard" destructive actions
export async function POST(request) {
    let key;
    try {
        const body = await request.json();
        key = body.key;
    } catch (e) {
        // Fallback to query param if body is not JSON or empty
        const { searchParams } = new URL(request.url);
        key = searchParams.get('key');
    }

    if (key !== '@Rushless123') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        await resetDatabase();
        return NextResponse.json({ 
            message: 'Database has been successfully reset. All data removed. Default admin (admin/admin) created.',
            success: true 
        });
    } catch (error) {
        console.error("Reset failed:", error);
        return NextResponse.json({ 
            message: 'Database reset failed.',
            error: error.message 
        }, { status: 500 });
    }
}
