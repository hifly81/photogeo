import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getPhotoStorageRoot, resolvePhotoAbsolutePath } from '@/lib/filesystem-storage';
import { listAvailableSyncDirectories } from '@/lib/filesystem-sync';

type SyncFolderRow = {
    id: string;
    userId: string;
    storageKey: string;
    folderPath: string;
    enabled: boolean;
    lastScannedAt: Date | null;
};

type SyncStatusFolderError = {
    folderId: string;
    storageKey: string;
    folderPath: string;
    error: string;
};

export type FilesystemSyncStatusSummary = {
    scope: {
        storageKey: string;
        folderPath: string;
    };
    configuredFoldersTotal: number;
    enabledFoldersTotal: number;
    unconfiguredDirectories: number;
    neverSyncedFolders: number;
    needsResyncFolders: number;
    folderErrors: SyncStatusFolderError[];
};

function normalizeFolderPath(folderPath: string) {
    if (!folderPath || folderPath === '.') return '';
    const normalized = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    return normalized;
}

function isSameOrNestedFolder(candidate: string, configured: string) {
    const a = normalizeFolderPath(candidate);
    const b = normalizeFolderPath(configured);

    if (!b) return true;
    return a === b || a.startsWith(`${b}/`);
}

function matchesFolderPrefix(filePath: string, folderPath: string) {
    const normalizedFile = normalizeFolderPath(filePath);
    const normalizedFolder = normalizeFolderPath(folderPath);

    if (!normalizedFolder) return true;
    return normalizedFile === normalizedFolder || normalizedFile.startsWith(`${normalizedFolder}/`);
}

function toRelativeStoragePath(storageRoot: string, absoluteFilePath: string) {
    return normalizeFolderPath(path.relative(storageRoot, absoluteFilePath));
}

async function sha256File(absoluteFilePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const file = await fs.readFile(absoluteFilePath);
    hash.update(file);
    return hash.digest('hex');
}

async function walkFilesRecursive(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const out: string[] = [];

    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...(await walkFilesRecursive(full)));
        } else if (entry.isFile()) {
            out.push(full);
        }
    }

    return out;
}

function isSupportedPhotoFile(filePath: string) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff', '.gif'].includes(ext);
}

async function folderHasChanges(userId: string, folder: SyncFolderRow): Promise<boolean> {
    const storageRoot = getPhotoStorageRoot(folder.storageKey);
    const normalizedFolderPath = normalizeFolderPath(folder.folderPath);
    const absoluteFolderPath = normalizedFolderPath ? path.join(storageRoot, normalizedFolderPath) : storageRoot;

    const folderStat = await fs.stat(absoluteFolderPath);
    if (!folderStat.isDirectory()) {
        throw new Error('Configured path is not a directory');
    }

    const absoluteFiles = await walkFilesRecursive(absoluteFolderPath);
    const currentRelativeFiles = new Set<string>();

    for (const absoluteFile of absoluteFiles) {
        if (!isSupportedPhotoFile(absoluteFile)) continue;
        const relativePath = toRelativeStoragePath(storageRoot, absoluteFile);
        currentRelativeFiles.add(relativePath);

        const existingPhoto = await prisma.photo.findFirst({
            where: {
                userId,
                storageKey: folder.storageKey,
                filePath: relativePath
            },
            select: {
                id: true,
                fileHash: true,
                source: true
            }
        });

        const deleted = await prisma.deletedPhoto.findUnique({
            where: {
                userId_storageKey_filePath: {
                    userId,
                    storageKey: folder.storageKey,
                    filePath: relativePath
                }
            },
            select: { id: true }
        });

        // New file: not tracked as photo and not intentionally deleted
        if (!existingPhoto && !deleted) return true;

        // If intentionally deleted, sync currently skips it; do not mark as pending forever
        if (deleted) continue;

        if (existingPhoto?.source === 'filesystem_sync') {
            const onDiskHash = await sha256File(absoluteFile);
            if (existingPhoto.fileHash !== onDiskHash) return true;
        }
    }

    // Check tracked files that disappeared from disk (and are not already marked missing)
    const trackedPhotos = await prisma.photo.findMany({
        where: {
            userId,
            source: 'filesystem_sync',
            storageKey: folder.storageKey
        },
        select: {
            id: true,
            filePath: true,
            missingFromDisk: true
        }
    });

    for (const photo of trackedPhotos) {
        if (!matchesFolderPrefix(photo.filePath, folder.folderPath)) continue;
        if (currentRelativeFiles.has(normalizeFolderPath(photo.filePath))) continue;

        if (!photo.missingFromDisk) {
            // Missing and not yet acknowledged
            return true;
        }

        // If it was already marked missing, do not keep flagging pending forever
    }

    return false;
}

export async function getFilesystemSyncStatusSummary(
    userId: string,
    storageKeyInput: string,
    selectedFolderPathInput: string
): Promise<FilesystemSyncStatusSummary> {
    const storageKey = storageKeyInput.trim();
    if (!storageKey) {
        throw new Error('Storage key is required');
    }

    const selectedFolderPath = normalizeFolderPath(selectedFolderPathInput);

    const allFolders = await prisma.syncFolder.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' }
    });

    const configuredFoldersTotal = allFolders.length;
    const enabledFoldersTotal = allFolders.filter((f) => f.enabled).length;

    const foldersInScope = allFolders.filter(
        (f) => f.storageKey === storageKey && isSameOrNestedFolder(f.folderPath, selectedFolderPath)
    );

    const enabledFoldersInScope = foldersInScope.filter((f) => f.enabled);

    const scopedConfiguredRoots = enabledFoldersInScope.map((f) => normalizeFolderPath(f.folderPath));
    const availableDirectories = await listAvailableSyncDirectories(storageKey, scopedConfiguredRoots);

    const directoriesInScope = availableDirectories.filter((dir) => isSameOrNestedFolder(dir, selectedFolderPath));

    // availableDirectories already excludes configured/nested configured roots.
    // Keep only true in-scope candidates and exclude the selected root itself if already configured root.
    const unconfiguredDirectories = directoriesInScope.filter((dir) => {
        const normalizedDir = normalizeFolderPath(dir);
        return !scopedConfiguredRoots.some((root) => isSameOrNestedFolder(normalizedDir, root));
    }).length;

    let neverSyncedFolders = 0;
    let needsResyncFolders = 0;
    const folderErrors: SyncStatusFolderError[] = [];

    for (const folder of enabledFoldersInScope) {
        if (!folder.lastScannedAt) {
            neverSyncedFolders += 1;
            continue;
        }

        try {
            const changed = await folderHasChanges(userId, folder as SyncFolderRow);
            if (changed) needsResyncFolders += 1;
        } catch (error) {
            folderErrors.push({
                folderId: folder.id,
                storageKey: folder.storageKey,
                folderPath: folder.folderPath,
                error: error instanceof Error ? error.message : 'Unknown status error'
            });
        }
    }

    return {
        scope: {
            storageKey,
            folderPath: selectedFolderPath
        },
        configuredFoldersTotal,
        enabledFoldersTotal,
        unconfiguredDirectories,
        neverSyncedFolders,
        needsResyncFolders,
        folderErrors
    };
}