'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type SyncFolder = {
    id: string;
    storageKey: string;
    folderPath: string;
    enabled: boolean;
    lastScannedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

type SyncSummary = {
    scannedFolders: number;
    scannedFiles: number;
    created: number;
    updated: number;
    skipped: number;
    missingMarked: number;
    errors: Array<{
        storageKey: string;
        folderPath: string;
        error: string;
    }>;
};

type BackfillDeletedSummary = {
    scannedFolders: number;
    scannedFiles: number;
    createdDeletedPhotos: number;
    alreadyTracked: number;
    existingPhotos: number;
    errors: Array<{
        storageKey: string;
        folderPath: string;
        error: string;
    }>;
};

type DirectoryTreeResponse = {
    directories?: string[];
    error?: string;
    details?: string;
};

type DirectoryNode = {
    name: string;
    path: string;
    children: DirectoryNode[];
};

type SyncStatusSummary = {
    scope: {
        storageKey: string;
        folderPath: string;
    };
    configuredFoldersTotal: number;
    enabledFoldersTotal: number;
    unconfiguredDirectories: number;
    neverSyncedFolders: number;
    needsResyncFolders: number;
    folderErrors: Array<{
        folderId: string;
        storageKey: string;
        folderPath: string;
        error: string;
    }>;
};

type SyncFolderTreeNode = {
    name: string;
    path: string;
    children: SyncFolderTreeNode[];
    folder?: SyncFolder;
};

function IconFolder() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
    );
}

function IconFolderOpen() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1" />
            <path d="M3 11h18l-2 7a2 2 0 0 1-2 1H5a2 2 0 0 1-2-2z" />
        </svg>
    );
}

function IconPlus() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
        </svg>
    );
}

function IconRefresh() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
        </svg>
    );
}

function IconTrash() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
        </svg>
    );
}

function IconSearch() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
        </svg>
    );
}

function IconClose() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M18 6 6 18" />
            <path d="M6 6l12 12" />
        </svg>
    );
}

function IconChevronRight() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="m9 18 6-6-6-6" />
        </svg>
    );
}

function buildDirectoryTree(paths: string[]): DirectoryNode {
    const root: DirectoryNode = {
        name: '/',
        path: '',
        children: []
    };

    for (const rawPath of paths) {
        const normalizedPath = rawPath.trim().replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
        if (!normalizedPath) continue;

        const parts = normalizedPath.split('/').filter(Boolean);
        let current = root;

        for (let index = 0; index < parts.length; index += 1) {
            const part = parts[index];
            const currentPath = parts.slice(0, index + 1).join('/');

            let child = current.children.find((node) => node.name === part);
            if (!child) {
                child = {
                    name: part,
                    path: currentPath,
                    children: []
                };
                current.children.push(child);
                current.children.sort((left, right) => left.name.localeCompare(right.name));
            }

            current = child;
        }
    }

    return root;
}

function buildConfiguredFoldersTree(folders: SyncFolder[]): SyncFolderTreeNode {
    const root: SyncFolderTreeNode = {
        name: '/',
        path: '',
        children: []
    };

    for (const folder of folders) {
        const normalizedPath = folder.folderPath.trim().replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
        const parts = normalizedPath ? normalizedPath.split('/').filter(Boolean) : [];
        let current = root;

        if (parts.length === 0) {
            current.folder = folder;
            continue;
        }

        for (let index = 0; index < parts.length; index += 1) {
            const part = parts[index];
            const currentPath = parts.slice(0, index + 1).join('/');

            let child = current.children.find((node) => node.name === part);
            if (!child) {
                child = {
                    name: part,
                    path: currentPath,
                    children: []
                };
                current.children.push(child);
                current.children.sort((left, right) => left.name.localeCompare(right.name));
            }

            current = child;
        }

        current.folder = folder;
    }

    return root;
}

const panelCardStyle = {
    padding: 16,
    borderRadius: 16,
    border: '1px solid #e4e7ec',
    background: '#ffffff',
    boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)'
} as const;

const sectionTitleStyle = {
    fontSize: 14,
    fontWeight: 700,
    color: '#101828',
    margin: 0
} as const;

const mutedTextStyle = {
    fontSize: 13,
    color: '#475467'
} as const;

const iconButtonStyle = {
    width: 28,
    minWidth: 28,
    height: 28,
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
} as const;

const roundActionButtonStyle = {
    width: 38,
    height: 38,
    borderRadius: '999px',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
} as const;

type ToggleSwitchProps = {
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
    label: string;
};

function ToggleSwitch({ checked, onChange, disabled = false, label }: ToggleSwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={onChange}
            disabled={disabled}
            style={{
                width: 46,
                height: 28,
                borderRadius: 999,
                border: checked ? '1px solid #12b76a' : '1px solid #d0d5dd',
                background: checked ? '#12b76a' : '#eaecf0',
                position: 'relative',
                padding: 0,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                transition: 'all 0.18s ease'
            }}
        >
            <span
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    top: 2,
                    left: checked ? 20 : 2,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 1px 2px rgba(16, 24, 40, 0.18)',
                    transition: 'left 0.18s ease'
                }}
            />
        </button>
    );
}

type DirectoryTreeItemProps = {
    node: DirectoryNode;
    depth: number;
    expandedPaths: Set<string>;
    onToggle: (path: string) => void;
    onSelect: (path: string) => void;
    addingPath: string | null;
};

function DirectoryTreeItem({
                               node,
                               depth,
                               expandedPaths,
                               onToggle,
                               onSelect,
                               addingPath
                           }: DirectoryTreeItemProps) {
    const hasChildren = node.children.length > 0;
    const isExpanded = node.path === '' || expandedPaths.has(node.path);
    const isAdding = addingPath === node.path;

    return (
        <div className="stack" style={{ gap: 4 }}>
            <div
                className="row"
                style={{
                    gap: 8,
                    alignItems: 'center',
                    paddingLeft: depth * 18
                }}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        className="secondary"
                        onClick={() => onToggle(node.path)}
                        style={iconButtonStyle}
                    >
                        <span
                            style={{
                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform 0.18s ease',
                                display: 'inline-flex'
                            }}
                        >
                            <IconChevronRight />
                        </span>
                    </button>
                ) : (
                    <span style={{ display: 'inline-block', width: 28 }} />
                )}

                <button
                    type="button"
                    className="secondary"
                    style={{
                        textAlign: 'left',
                        justifyContent: 'space-between',
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        borderRadius: 12
                    }}
                    onClick={() => onSelect(node.path)}
                    disabled={isAdding}
                >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ color: '#f79009' }}>
                            {hasChildren && isExpanded ? <IconFolderOpen /> : <IconFolder />}
                        </span>
                        <span>{node.name}</span>
                    </span>

                    <span
                        className="small"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            color: isAdding ? '#475467' : '#027a48',
                            fontWeight: 700,
                            flexShrink: 0
                        }}
                    >
                        {isAdding ? 'Adding…' : (
                            <>
                                <IconPlus />
                                <span>Add</span>
                            </>
                        )}
                    </span>
                </button>
            </div>

            {hasChildren && isExpanded ? (
                <div className="stack" style={{ gap: 4 }}>
                    {node.children.map((child) => (
                        <DirectoryTreeItem
                            key={child.path}
                            node={child}
                            depth={depth + 1}
                            expandedPaths={expandedPaths}
                            onToggle={onToggle}
                            onSelect={onSelect}
                            addingPath={addingPath}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}

type ConfiguredFolderTreeItemProps = {
    node: SyncFolderTreeNode;
    depth: number;
    expandedPaths: Set<string>;
    onToggle: (path: string) => void;
    onRunSync: (folder: SyncFolder) => void;
    onToggleFolder: (folder: SyncFolder) => void;
    onDeleteFolder: (id: string) => void;
    syncing: boolean;
};

function ConfiguredFolderTreeItem({
                                      node,
                                      depth,
                                      expandedPaths,
                                      onToggle,
                                      onRunSync,
                                      onToggleFolder,
                                      onDeleteFolder,
                                      syncing
                                  }: ConfiguredFolderTreeItemProps) {
    const hasChildren = node.children.length > 0;
    const isExpanded = node.path === '' || expandedPaths.has(node.path);
    const folder = node.folder;
    const isConfigured = Boolean(folder);

    return (
        <div className="stack" style={{ gap: 8 }}>
            <div
                style={{
                    ...panelCardStyle,
                    marginLeft: depth * 18,
                    padding: 12,
                    background: folder
                        ? folder.enabled
                            ? '#ffffff'
                            : '#fcfcfd'
                        : '#ffffff',
                    border: folder
                        ? folder.enabled
                            ? '1px solid #d0d5dd'
                            : '1px solid #eaecf0'
                        : '1px solid #f2f4f7'
                }}
            >
                <div
                    className="row"
                    style={{
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        flexWrap: 'wrap'
                    }}
                >
                    <div className="row" style={{ gap: 10, alignItems: 'center', minWidth: 0, flex: 1 }}>
                        <button
                            type="button"
                            className="secondary"
                            onClick={() => onToggle(node.path)}
                            style={iconButtonStyle}
                        >
                            <span
                                style={{
                                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.18s ease',
                                    display: 'inline-flex'
                                }}
                            >
                                <IconChevronRight />
                            </span>
                        </button>

                        <span style={{ color: folder?.enabled ? '#f79009' : '#98a2b3', display: 'inline-flex' }}>
                            {hasChildren && isExpanded ? <IconFolderOpen /> : <IconFolder />}
                        </span>

                        <strong style={{ color: '#101828', wordBreak: 'break-word' }}>
                            {node.path || '/'}
                        </strong>
                    </div>
                </div>

                {isExpanded ? (
                    <div style={{ marginTop: 12 }}>
                        <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                {folder ? (
                                    <span
                                        className="small"
                                        style={{
                                            padding: '3px 10px',
                                            borderRadius: 999,
                                            background: folder.enabled ? '#ecfdf3' : '#f2f4f7',
                                            color: folder.enabled ? '#027a48' : '#475467',
                                            border: folder.enabled ? '1px solid #abefc6' : '1px solid #d0d5dd',
                                            fontWeight: 600
                                        }}
                                    >
                                        {folder.enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                ) : null}
                            </div>

                            {folder ? (
                                <>
                                    <div style={mutedTextStyle}>Storage: {folder.storageKey}</div>
                                    <div style={mutedTextStyle}>
                                        Last scanned: {folder.lastScannedAt ? new Date(folder.lastScannedAt).toLocaleString() : 'Never'}
                                    </div>
                                </>
                            ) : (
                                <div style={mutedTextStyle}>Parent folder</div>
                            )}
                        </div>

                        {isConfigured ? (
                            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
                                <div
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '6px 8px',
                                        border: '1px solid #eaecf0',
                                        borderRadius: 999,
                                        background: '#fff'
                                    }}
                                >
                                    <ToggleSwitch
                                        checked={Boolean(folder?.enabled)}
                                        onChange={() => folder && onToggleFolder(folder)}
                                        label={folder?.enabled ? 'Disable sync' : 'Enable sync'}
                                    />
                                </div>

                                <button
                                    type="button"
                                    className="secondary"
                                    onClick={() => folder && onRunSync(folder)}
                                    disabled={syncing || !folder?.enabled}
                                    style={roundActionButtonStyle}
                                    aria-label="Sync folder now"
                                    title="Sync folder now"
                                >
                                    <IconRefresh />
                                </button>

                                <button
                                    type="button"
                                    className="danger"
                                    onClick={() => folder && onDeleteFolder(folder.id)}
                                    style={roundActionButtonStyle}
                                    aria-label="Remove folder"
                                    title="Remove folder"
                                >
                                    <IconTrash />
                                </button>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {hasChildren && isExpanded ? (
                <div className="stack" style={{ gap: 8 }}>
                    {node.children.map((child) => (
                        <ConfiguredFolderTreeItem
                            key={child.path}
                            node={child}
                            depth={depth + 1}
                            expandedPaths={expandedPaths}
                            onToggle={onToggle}
                            onRunSync={onRunSync}
                            onToggleFolder={onToggleFolder}
                            onDeleteFolder={onDeleteFolder}
                            syncing={syncing}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}

export function FilesystemSyncPanel() {
    const [folders, setFolders] = useState<SyncFolder[]>([]);
    const [storageKey, setStorageKey] = useState('main');
    const [folderPath, setFolderPath] = useState('');
    const [availableDirectories, setAvailableDirectories] = useState<string[]>([]);
    const [loadingDirectories, setLoadingDirectories] = useState(false);
    const [isDirectoryPickerOpen, setIsDirectoryPickerOpen] = useState(false);
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
    const [configuredExpandedPaths, setConfiguredExpandedPaths] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [backfillingDeleted, setBackfillingDeleted] = useState(false);
    const [addingPath, setAddingPath] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [statusLoading, setStatusLoading] = useState(false);
    const [statusError, setStatusError] = useState<string | null>(null);
    const [statusSummary, setStatusSummary] = useState<SyncStatusSummary | null>(null);
    const statusReqIdRef = useRef(0);

    async function loadFolders() {
        setLoading(true);

        try {
            const response = await fetch('/api/sync-folders');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error ?? 'Failed to load sync folders');
            }

            setFolders(data.folders ?? []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load sync folders');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadFolders();
    }, []);

    async function loadSyncStatus(nextStorageKey = storageKey, nextFolderPath = folderPath) {
        const reqId = ++statusReqIdRef.current;
        setStatusLoading(true);
        setStatusError(null);

        try {
            const params = new URLSearchParams({
                storageKey: nextStorageKey.trim() || 'main',
                folderPath: nextFolderPath || ''
            });

            const response = await fetch(`/api/sync-folders/status?${params.toString()}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.details ?? data.error ?? 'Failed to load sync status');
            }

            // prevent stale responses from overwriting newer selection
            if (reqId !== statusReqIdRef.current) return;
            setStatusSummary(data.summary ?? null);
        } catch (statusLoadError) {
            if (reqId !== statusReqIdRef.current) return;
            setStatusError(statusLoadError instanceof Error ? statusLoadError.message : 'Failed to load sync status');
            setStatusSummary(null);
        } finally {
            if (reqId === statusReqIdRef.current) {
                setStatusLoading(false);
            }
        }
    }

    useEffect(() => {
        void loadSyncStatus(storageKey, folderPath);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storageKey, folderPath]);

    const enabledCount = useMemo(() => folders.filter((folder) => folder.enabled).length, [folders]);
    const directoryTree = useMemo(() => buildDirectoryTree(availableDirectories), [availableDirectories]);
    const configuredFoldersTree = useMemo(() => buildConfiguredFoldersTree(folders), [folders]);

    async function loadAvailableDirectories() {
        const trimmedStorageKey = storageKey.trim();

        setError(null);
        setAvailableDirectories([]);
        setExpandedPaths(new Set());
        setIsDirectoryPickerOpen(true);

        if (!trimmedStorageKey) {
            setLoadingDirectories(false);
            setError('Storage key is required');
            return;
        }

        setLoadingDirectories(true);

        try {
            const response = await fetch(`/api/sync-folders/tree?storageKey=${encodeURIComponent(trimmedStorageKey)}`);
            const data = (await response.json()) as DirectoryTreeResponse;

            if (!response.ok) {
                throw new Error(data.details ?? data.error ?? 'Failed to load filesystem tree');
            }

            setAvailableDirectories(data.directories ?? []);
        } catch (treeError) {
            setError(treeError instanceof Error ? treeError.message : 'Failed to load filesystem tree');
        } finally {
            setLoadingDirectories(false);
        }
    }

    function toggleExpanded(path: string) {
        if (!path) return;

        setExpandedPaths((current) => {
            const next = new Set(current);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    }

    function toggleConfiguredExpanded(path: string) {
        if (!path) return;

        setConfiguredExpandedPaths((current) => {
            const next = new Set(current);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    }

    async function runFolderSync(folder: SyncFolder) {
        setSyncing(true);
        setError(null);
        setMessage(null);

        try {
            const response = await fetch('/api/photos/fs-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folderId: folder.id
                })
            });

            const data = (await response.json()) as SyncSummary & { error?: string; details?: string };

            if (!response.ok) {
                throw new Error(data.details ?? data.error ?? 'Filesystem sync failed');
            }

            const parts = [
                `Folder synced: ${folder.folderPath || '/'}`,
                `Files scanned: ${data.scannedFiles}`,
                `Created: ${data.created}`,
                `Updated: ${data.updated}`,
                `Skipped: ${data.skipped}`
            ];

            if (data.missingMarked > 0) {
                parts.push(`Missing marked: ${data.missingMarked}`);
            }

            if (data.errors.length > 0) {
                parts.push(`Folder errors: ${data.errors.length}`);
            }

            setMessage(parts.join(' · '));
            await loadFolders();
            await loadSyncStatus();
        } catch (syncError) {
            setError(syncError instanceof Error ? syncError.message : 'Filesystem sync failed');
        } finally {
            setSyncing(false);
        }
    }

    async function addFolderFromPath(selectedFolderPath: string, runSyncAfterAdd = true) {
        setSaving(true);
        setError(null);
        setMessage(null);
        setAddingPath(selectedFolderPath);

        try {
            const response = await fetch('/api/sync-folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storageKey,
                    folderPath: selectedFolderPath,
                    enabled: true
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.details ?? data.error ?? 'Could not create sync folder');
            }

            setFolderPath('');
            setAvailableDirectories((current) =>
                current.filter((dir) => dir !== selectedFolderPath && !dir.startsWith(`${selectedFolderPath}/`))
            );
            setIsDirectoryPickerOpen(false);
            setMessage(runSyncAfterAdd ? 'Sync folder added. Starting sync…' : 'Sync folder added.');
            await loadFolders();
            await loadSyncStatus(storageKey, folderPath);

            if (runSyncAfterAdd && data.folder) {
                await runFolderSync(data.folder);
            }
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Could not create sync folder');
        } finally {
            setSaving(false);
            setAddingPath(null);
        }
    }

    async function addFolder(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        await addFolderFromPath(folderPath, true);
    }

    async function toggleFolder(folder: SyncFolder) {
        setError(null);
        setMessage(null);

        try {
            const response = await fetch(`/api/sync-folders/${folder.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: !folder.enabled
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.details ?? data.error ?? 'Could not update sync folder');
            }

            setFolders((current) =>
                current.map((item) => (item.id === folder.id ? data.folder : item))
            );
            await loadSyncStatus();
        } catch (toggleError) {
            setError(toggleError instanceof Error ? toggleError.message : 'Could not update sync folder');
        }
    }

    async function deleteFolder(id: string) {
        setError(null);
        setMessage(null);

        try {
            const response = await fetch(`/api/sync-folders/${id}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error ?? 'Could not delete sync folder');
            }

            setFolders((current) => current.filter((folder) => folder.id !== id));
            await loadSyncStatus();
            setMessage('Sync folder removed.');
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'Could not delete sync folder');
        }
    }

    async function runSync() {
        setSyncing(true);
        setError(null);
        setMessage(null);

        try {
            const response = await fetch('/api/photos/fs-sync', {
                method: 'POST'
            });

            const data = (await response.json()) as SyncSummary & { error?: string; details?: string };

            if (!response.ok) {
                throw new Error(data.details ?? data.error ?? 'Filesystem sync failed');
            }

            const parts = [
                `Folders scanned: ${data.scannedFolders}`,
                `Files scanned: ${data.scannedFiles}`,
                `Created: ${data.created}`,
                `Updated: ${data.updated}`,
                `Skipped: ${data.skipped}`
            ];

            if (data.missingMarked > 0) {
                parts.push(`Missing marked: ${data.missingMarked}`);
            }

            if (data.errors.length > 0) {
                parts.push(`Folder errors: ${data.errors.length}`);
            }

            setMessage(parts.join(' · '));

            await loadFolders();
            await loadSyncStatus();
        } catch (syncError) {
            setError(syncError instanceof Error ? syncError.message : 'Filesystem sync failed');
        } finally {
            setSyncing(false);
        }
    }

    async function runDeletedBackfill() {
        setBackfillingDeleted(true);
        setError(null);
        setMessage(null);

        try {
            const response = await fetch('/api/photos/fs-sync/backfill-deleted', {
                method: 'POST'
            });

            const data = (await response.json()) as BackfillDeletedSummary & { error?: string; details?: string };

            if (!response.ok) {
                throw new Error(data.details ?? data.error ?? 'Deleted photos backfill failed');
            }

            const parts = [
                `Folders scanned: ${data.scannedFolders}`,
                `Files scanned: ${data.scannedFiles}`,
                `DeletedPhoto created: ${data.createdDeletedPhotos}`,
                `Already tracked: ${data.alreadyTracked}`,
                `Existing Photo rows: ${data.existingPhotos}`
            ];

            if (data.errors.length > 0) {
                parts.push(`Folder errors: ${data.errors.length}`);
            }

            setMessage(parts.join(' · '));
        } catch (backfillError) {
            setError(backfillError instanceof Error ? backfillError.message : 'Deleted photos backfill failed');
        } finally {
            setBackfillingDeleted(false);
        }
    }

    return (
        <section className="card stack">
            <div>
                <h2 style={{ marginBottom: 4 }}>Filesystem sync</h2>
            </div>

            <div id="filesystem-sync-panel-content" className="stack" style={{ gap: 16 }}>
                <div
                    style={{
                        ...panelCardStyle,
                        background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)'
                    }}
                >
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div className="stack" style={{ gap: 4 }}>
                            <h3 style={{ ...sectionTitleStyle, fontSize: 16 }}>Overview</h3>


                            <span style={mutedTextStyle}>
                                {loading ? 'Loading…' : `${folders.length} configured folder(s), ${enabledCount} enabled`}
                                {!statusLoading && statusSummary
                                    ? ` · ${statusSummary.unconfiguredDirectories} not yet added · ${statusSummary.neverSyncedFolders} never synced · ${statusSummary.needsResyncFolders} need re-sync`
                                    : ''}
                            </span>
                        </div>

                        {statusLoading ? (
                            <div className="small" style={{ color: '#57606a' }}>
                                Computing sync status…
                            </div>
                        ) : null}
                        {statusError ? (
                            <div className="small" style={{ color: '#b42318' }}>
                                {statusError}
                            </div>
                        ) : null}
                        {statusSummary && statusSummary.folderErrors.length > 0 ? (
                            <div className="small" style={{ color: '#b42318' }}>
                                {statusSummary.folderErrors.length} folder(s) could not be checked
                            </div>
                        ) : null}




                        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="secondary"
                                onClick={() => void runDeletedBackfill()}
                                disabled={backfillingDeleted || enabledCount === 0}
                                style={roundActionButtonStyle}
                                aria-label={backfillingDeleted ? 'Backfilling deleted photos' : 'Backfill deleted photos'}
                                title={backfillingDeleted ? 'Backfilling deleted photos' : 'Backfill deleted photos'}
                            >
                                <IconTrash />
                            </button>

                            <button
                                type="button"
                                onClick={() => void runSync()}
                                disabled={syncing || enabledCount === 0}
                                style={roundActionButtonStyle}
                                aria-label={syncing ? 'Syncing enabled folders' : 'Run sync for enabled folders'}
                                title={syncing ? 'Syncing enabled folders' : 'Run sync for enabled folders'}
                            >
                                <IconRefresh />
                            </button>
                        </div>
                    </div>

                </div>

                {error ? <div className="card error-banner">{error}</div> : null}
                {message ? <div className="card success-banner">{message}</div> : null}

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)',
                        gap: 16,
                        alignItems: 'start'
                    }}
                >
                    <div style={panelCardStyle} className="stack">
                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                            <h3 style={sectionTitleStyle}>Add new folder</h3>
                            <button
                                type="button"
                                className="secondary"
                                onClick={() => void loadAvailableDirectories()}
                                disabled={loadingDirectories}
                                style={roundActionButtonStyle}
                                aria-label={loadingDirectories ? 'Loading folders' : 'Browse folders'}
                                title={loadingDirectories ? 'Loading folders' : 'Browse folders'}
                            >
                                <IconSearch />
                            </button>
                        </div>

                        <form onSubmit={addFolder} className="stack" style={{ gap: 12 }}>
                            <label>
                                Storage key
                                <input
                                    value={storageKey}
                                    onChange={(event) => setStorageKey(event.target.value)}
                                    placeholder="main"
                                />
                            </label>

                            <label>
                                Selected folder
                                <input
                                    value={folderPath || '/'}
                                    readOnly
                                    placeholder="Choose a folder from the tree"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => void loadAvailableDirectories()}
                                />
                            </label>

                            <div className="small" style={{ color: '#027a48', fontWeight: 600 }}>
                                Tip: click directly on a folder in the tree to add it and start sync immediately.
                            </div>
                        </form>

                        {isDirectoryPickerOpen ? (
                            <div
                                className="stack"
                                style={{
                                    padding: 12,
                                    maxHeight: 440,
                                    overflow: 'auto',
                                    borderRadius: 14,
                                    background: '#fcfcfd',
                                    border: '1px solid #eaecf0'
                                }}
                            >
                                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                    <strong>Folder tree</strong>
                                    <button
                                        type="button"
                                        className="secondary"
                                        onClick={() => setIsDirectoryPickerOpen(false)}
                                        style={roundActionButtonStyle}
                                        aria-label="Close folder tree"
                                        title="Close folder tree"
                                    >
                                        <IconClose />
                                    </button>
                                </div>

                                {loadingDirectories ? (
                                    <div className="small">Loading folders…</div>
                                ) : availableDirectories.length === 0 ? (
                                    <div className="small">No folders available to add.</div>
                                ) : (
                                    <div className="stack" style={{ gap: 6 }}>
                                        <button
                                            type="button"
                                            className="secondary"
                                            style={{
                                                textAlign: 'left',
                                                justifyContent: 'flex-start',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                borderRadius: 12
                                            }}
                                            onClick={() => {
                                                setFolderPath('');
                                                setIsDirectoryPickerOpen(false);
                                            }}
                                        >
                                            <IconFolder />
                                            <span>/</span>
                                        </button>

                                        {directoryTree.children.map((child) => (
                                            <DirectoryTreeItem
                                                key={child.path}
                                                node={child}
                                                depth={0}
                                                expandedPaths={expandedPaths}
                                                onToggle={toggleExpanded}
                                                onSelect={(path) => {
                                                    setFolderPath(path);
                                                    void addFolderFromPath(path, true);
                                                }}
                                                addingPath={addingPath}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>

                    <div style={panelCardStyle} className="stack">
                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <h3 style={sectionTitleStyle}>Configured folders</h3>
                        </div>

                        {folders.length === 0 && !loading ? (
                            <div className="small">No sync folders configured yet.</div>
                        ) : (
                            <div className="stack" style={{ gap: 8 }}>
                                {configuredFoldersTree.folder ? (
                                    <ConfiguredFolderTreeItem
                                        node={configuredFoldersTree}
                                        depth={0}
                                        expandedPaths={configuredExpandedPaths}
                                        onToggle={toggleConfiguredExpanded}
                                        onRunSync={(folder) => void runFolderSync(folder)}
                                        onToggleFolder={(folder) => void toggleFolder(folder)}
                                        onDeleteFolder={(id) => void deleteFolder(id)}
                                        syncing={syncing}
                                    />
                                ) : null}

                                {configuredFoldersTree.children.map((child) => (
                                    <ConfiguredFolderTreeItem
                                        key={child.path}
                                        node={child}
                                        depth={0}
                                        expandedPaths={configuredExpandedPaths}
                                        onToggle={toggleConfiguredExpanded}
                                        onRunSync={(folder) => void runFolderSync(folder)}
                                        onToggleFolder={(folder) => void toggleFolder(folder)}
                                        onDeleteFolder={(id) => void deleteFolder(id)}
                                        syncing={syncing}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}