import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth';
import { getFilesystemSyncStatusSummary } from '@/lib/filesystem-sync-status';

export async function GET(request: Request) {
    const user = await requireCurrentUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const storageKey = url.searchParams.get('storageKey') ?? 'main';
    const folderPath = url.searchParams.get('folderPath') ?? '';

    try {
        const summary = await getFilesystemSyncStatusSummary(user.id, storageKey, folderPath);
        return NextResponse.json({ summary });
    } catch (error) {
        return NextResponse.json(
            {
                error: 'Failed to compute sync status',
                details: error instanceof Error ? error.message : 'Unknown status error'
            },
            { status: 400 }
        );
    }
}