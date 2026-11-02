'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { PhotoRecord } from '@/types/photo';
import type { PhotoSuggestions } from '@/types/photo-suggestions';
import type { SelectedDateFilter, SelectedLocationFilter } from '@/components/settings-shell';
import { LocationAutocomplete, type GeocodeResult } from '@/components/location-autocomplete';

const PhotoMap = dynamic(() => import('@/components/photo-map').then((mod) => mod.PhotoMap), {
    ssr: false
});

const emptyFilters = {
    from: '',
    to: '',
    country: '',
    city: '',
    tag: ''
};

const pageSizeOptions = [10, 25, 50, 75, 100] as const;
const minMapHeight = 320;
const maxMapHeight = 900;
const mapResizeStep = 120;

type PhotoListTab = 'all' | 'with-geolocation' | 'missing-geolocation' | 'missing-location-info';

type HomePageProps = {
    selectedTags?: string[];
    selectedPersonId?: string | null;
    selectedClusterKey?: string | null;
    selectedDateFilter?: SelectedDateFilter;
    selectedLocationFilter?: SelectedLocationFilter;
};

function IconShrink() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M15 9h6" />
            <path d="M3 15h6" />
            <path d="m21 9-3-3" />
            <path d="m21 9-3 3" />
            <path d="m3 15 3-3" />
            <path d="m3 15 3 3" />
        </svg>
    );
}

function IconExpand() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M9 3H3v6" />
            <path d="M15 21h6v-6" />
            <path d="m3 3 7 7" />
            <path d="m21 21-7-7" />
            <path d="M21 9V3h-6" />
            <path d="M3 15v6h6" />
            <path d="m21 3-7 7" />
            <path d="m3 21 7-7" />
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

function IconOpen() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
        </svg>
    );
}

function IconAnalyze() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
            <path d="M11 8v3l2 2" />
        </svg>
    );
}

function IconExternal() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M14 3h7v7" />
            <path d="M10 14 21 3" />
            <path d="M21 14v4a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h4" />
        </svg>
    );
}

function IconSave() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
            <path d="M17 21v-8H7v8" />
            <path d="M7 3v5h8" />
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

function IconPlus() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
        </svg>
    );
}

function IconReset() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 3v6h6" />
        </svg>
    );
}

function IconChevronLeft() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="m15 18-6-6 6-6" />
        </svg>
    );
}

function IconChevronRight() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="m9 18 6-6-6-6" />
        </svg>
    );
}

function IconChevronsLeft() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="m11 17-5-5 5-5" />
            <path d="m18 17-5-5 5-5" />
        </svg>
    );
}

function IconChevronsRight() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="m13 17 5-5-5-5" />
            <path d="m6 17 5-5-5-5" />
        </svg>
    );
}

function IconImages() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10" r="1.5" />
            <path d="m21 15-5-5L5 21" />
        </svg>
    );
}

function IconPin() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M12 21s-6-5.33-6-11a6 6 0 1 1 12 0c0 5.67-6 11-6 11Z" />
            <circle cx="12" cy="10" r="2.5" />
        </svg>
    );
}

function IconPinOff() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="m2 2 20 20" />
            <path d="M12 21s-6-5.33-6-11a6 6 0 0 1 9.42-4.92" />
            <path d="M18 8.58A6.02 6.02 0 0 1 18 10c0 5.67-6 11-6 11" />
            <path d="M9.5 9.5a2.5 2.5 0 0 0 3 3" />
        </svg>
    );
}

function IconAlertCircle() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5" />
            <path d="M12 16h.01" />
        </svg>
    );
}

function IconEdit() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
    );
}

const mapIconButtonStyle = {
    width: 36,
    height: 36,
    borderRadius: '999px',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1
} as const;

const modalIconButtonStyle = {
    width: 38,
    height: 38,
    borderRadius: '999px',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1
} as const;

const modalDangerIconButtonStyle = {
    ...modalIconButtonStyle,
    background: '#fef3f2',
    border: '1px solid #fecdca',
    color: '#b42318'
} as const;

const filterIconButtonStyle = {
    width: 36,
    height: 36,
    borderRadius: '999px',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1
} as const;

const tabButtonBaseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center'
} as const;

function getTabIcon(tab: PhotoListTab) {
    switch (tab) {
        case 'all':
            return <IconImages />;
        case 'with-geolocation':
            return <IconPin />;
        case 'missing-geolocation':
            return <IconPinOff />;
        case 'missing-location-info':
            return <IconAlertCircle />;
        default:
            return <IconImages />;
    }
}

export function HomePage({
                             selectedTags = [],
                             selectedPersonId = null,
                             selectedClusterKey = null,
                             selectedDateFilter = { mode: 'all' },
                             selectedLocationFilter = { mode: 'all' }
                         }: HomePageProps) {
    const [photos, setPhotos] = useState<PhotoRecord[]>([]);
    const [selectedPhoto, setSelectedPhoto] = useState<PhotoRecord | null>(null);
    const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
    const [lastSelectedPhotoId, setLastSelectedPhotoId] = useState<string | null>(null);
    const [filters, setFilters] = useState(emptyFilters);
    const [tagName, setTagName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [photoListTab, setPhotoListTab] = useState<PhotoListTab>('all');
    const [placeQuery, setPlaceQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(100);
    const [totalPhotos, setTotalPhotos] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [isMapOpen, setIsMapOpen] = useState(true);
    const [mapHeight, setMapHeight] = useState(720);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<PhotoSuggestions | null>(null);
    const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editorStatus, setEditorStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [counts, setCounts] = useState({
        all: 0,
        withGeolocation: 0,
        missingGeolocation: 0,
        missingLocationInfo: 0
    });

    const query = useMemo(() => {
        const params = new URLSearchParams();
        const activeFilters = { ...filters };

        Object.entries(activeFilters).forEach(([key, value]) => {
            if (key === 'tag') return;
            if (value) params.set(key, value);
        });

        if (selectedTags.length > 0) {
            params.set('tags', selectedTags.join(','));
        }

        if (selectedDateFilter.mode === 'year') {
            params.set('dateYear', selectedDateFilter.year);
        }

        if (selectedDateFilter.mode === 'month') {
            params.set('dateYear', selectedDateFilter.year);
            params.set('dateMonth', selectedDateFilter.month);
        }

        if (selectedDateFilter.mode === 'no-date') {
            params.set('noDate', 'true');
        }

        if (selectedLocationFilter.mode === 'country') {
            if (selectedLocationFilter.country === null) {
                params.set('locationNoCountry', 'true');
                params.set('locationCountry', '');
                params.set('locationCity', '');
            } else {
                params.set('locationCountry', selectedLocationFilter.country);
                params.set('locationCity', '');
            }
        }

        if (selectedLocationFilter.mode === 'city') {
            if (selectedLocationFilter.country === null) {
                params.set('locationNoCountry', 'true');
                params.set('locationCountry', '');
                params.set('locationCity', selectedLocationFilter.city);
            } else {
                params.set('locationCountry', selectedLocationFilter.country);
                params.set('locationCity', selectedLocationFilter.city);
            }
        }

        if (selectedPersonId) {
            params.set('personId', selectedPersonId);
        }

        if (selectedClusterKey) {
            params.set('clusterKey', selectedClusterKey);
        }

        params.set('page', String(currentPage));
        params.set('pageSize', String(pageSize));

        if (photoListTab === 'with-geolocation') {
            params.set('mode', 'with-geolocation');
        } else if (photoListTab === 'missing-geolocation') {
            params.set('mode', 'missing-geolocation');
        } else if (photoListTab === 'missing-location-info') {
            params.set('mode', 'missing-location-info');
        } else {
            params.set('mode', 'all');
        }

        return params.toString();
    }, [
        currentPage,
        pageSize,
        filters,
        photoListTab,
        selectedClusterKey,
        selectedDateFilter,
        selectedLocationFilter,
        selectedPersonId,
        selectedTags
    ]);

    const selectedPhotosCount = selectedPhotoIds.length;
    const isMultiSelection = selectedPhotosCount > 1;

    async function loadPhotos() {
        const response = await fetch(`/api/photos?${query}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error ?? 'Failed to load photos');
        }

        const nextPhotos = data.photos ?? [];
        setPhotos(nextPhotos);
        setTotalPhotos(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
        setCounts({
            all: data.counts?.all ?? 0,
            withGeolocation: data.counts?.withGeolocation ?? 0,
            missingGeolocation: data.counts?.missingGeolocation ?? 0,
            missingLocationInfo: data.counts?.missingLocationInfo ?? 0
        });

        if (selectedPhoto) {
            const refreshed = nextPhotos.find((photo: PhotoRecord) => photo.id === selectedPhoto.id) ?? null;
            setSelectedPhoto(refreshed);
        }

        setSelectedPhotoIds((current) => current.filter((id) => nextPhotos.some((photo: PhotoRecord) => photo.id === id)));
        setLastSelectedPhotoId((current) => (current && nextPhotos.some((photo: PhotoRecord) => photo.id === current) ? current : null));
    }

    useEffect(() => {
        void loadPhotos().catch((loadError) => {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load photos');
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    useEffect(() => {
        setCurrentPage(1);
    }, [
        pageSize,
        photoListTab,
        filters.from,
        filters.to,
        filters.country,
        filters.city,
        selectedLocationFilter,
        selectedTags,
        selectedPersonId,
        selectedClusterKey
    ]);

    useEffect(() => {
        setPlaceQuery(selectedPhoto?.placeName ?? selectedPhoto?.city ?? '');
    }, [selectedPhoto?.id, selectedPhoto?.placeName, selectedPhoto?.city]);

    useEffect(() => {
        setSuggestions(null);
    }, [selectedPhoto?.id, isMultiSelection]);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedDateFilter]);

    useEffect(() => {
        if (photoListTab === 'all' && counts.all === 0) {
            if (counts.withGeolocation > 0) {
                setPhotoListTab('with-geolocation');
                return;
            }
            if (counts.missingGeolocation > 0) {
                setPhotoListTab('missing-geolocation');
                return;
            }
            if (counts.missingLocationInfo > 0) {
                setPhotoListTab('missing-location-info');
                return;
            }
        }

        if (photoListTab === 'with-geolocation' && counts.withGeolocation === 0) {
            setPhotoListTab('all');
        }

        if (photoListTab === 'missing-geolocation' && counts.missingGeolocation === 0) {
            setPhotoListTab('all');
        }

        if (photoListTab === 'missing-location-info' && counts.missingLocationInfo === 0) {
            setPhotoListTab('all');
        }
    }, [photoListTab, counts]);

    function openEditor(photo?: PhotoRecord) {
        if (photo) {
            setSelectedPhoto(photo);
            if (!selectedPhotoIds.includes(photo.id)) {
                setSelectedPhotoIds([photo.id]);
            }
            setLastSelectedPhotoId(photo.id);
        }

        if (!selectedPhoto && !photo) return;
        setIsEditorOpen(true);
    }

    function closeEditor() {
        if (isSaving) return;
        setIsEditorOpen(false);
        setTagName('');
        setSuggestions(null);
        setEditorStatus(null);
    }

    async function analyzeSelectedPhoto() {
        if (!selectedPhoto || isMultiSelection) return;

        setError(null);
        setSuccessMessage(null);
        setSuggestions(null);
        setIsAnalyzingPhoto(true);

        try {
            const response = await fetch(`/api/photos/${selectedPhoto.id}/suggestions`, {
                method: 'POST'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error ?? 'Failed to analyze photo');
            }

            setSuggestions(data.suggestions ?? {});
        } catch (analysisError) {
            setError(analysisError instanceof Error ? analysisError.message : 'Failed to analyze photo');
        } finally {
            setIsAnalyzingPhoto(false);
        }
    }

    function applySuggestionField(field: keyof PhotoSuggestions) {
        if (!selectedPhoto || !suggestions) return;

        if (field === 'tags') {
            const nextTags = suggestions.tags ?? [];
            if (nextTags.length === 0) return;

            const existingTagNames = new Set(selectedPhoto.tags.map(({ tag }) => tag.name.toLowerCase()));
            const newTagItems = nextTags
                .filter((name) => !existingTagNames.has(name.toLowerCase()))
                .map((name, index) => ({
                    tag: {
                        id: `suggested-${index}-${name}`,
                        name
                    }
                }));

            setSelectedPhoto({
                ...selectedPhoto,
                tags: [...selectedPhoto.tags, ...newTagItems]
            });

            setSuggestions((current) => {
                if (!current) return current;
                const next = { ...current };
                delete next.tags;
                return next;
            });

            return;
        }

        const value = suggestions[field];
        if (value == null) return;

        const nextPhoto: PhotoRecord = { ...selectedPhoto };

        if (field === 'caption' && typeof value === 'string') nextPhoto.caption = value;
        if (field === 'takenAt' && typeof value === 'string') nextPhoto.takenAt = value;
        if (field === 'latitude' && typeof value === 'number') nextPhoto.latitude = value;
        if (field === 'longitude' && typeof value === 'number') nextPhoto.longitude = value;
        if (field === 'country' && typeof value === 'string') nextPhoto.country = value;
        if (field === 'placeName' && typeof value === 'string') {
            nextPhoto.placeName = value;
            setPlaceQuery(value);
        }
        if (field === 'city' && typeof value === 'string') nextPhoto.city = value;

        setSelectedPhoto(nextPhoto);

        setSuggestions((current) => {
            if (!current) return current;
            const next = { ...current };
            delete next[field];
            return next;
        });
    }

    function applyAllSuggestions() {
        if (!selectedPhoto || !suggestions) return;

        let nextPhoto: PhotoRecord = { ...selectedPhoto };

        if (typeof suggestions.caption === 'string') nextPhoto.caption = suggestions.caption;
        if (typeof suggestions.takenAt === 'string') nextPhoto.takenAt = suggestions.takenAt;
        if (typeof suggestions.latitude === 'number') nextPhoto.latitude = suggestions.latitude;
        if (typeof suggestions.longitude === 'number') nextPhoto.longitude = suggestions.longitude;
        if (typeof suggestions.country === 'string') nextPhoto.country = suggestions.country;
        if (typeof suggestions.placeName === 'string') {
            nextPhoto.placeName = suggestions.placeName;
            setPlaceQuery(suggestions.placeName);
        }
        if (typeof suggestions.city === 'string') nextPhoto.city = suggestions.city;

        if (Array.isArray(suggestions.tags) && suggestions.tags.length > 0) {
            const existingTagNames = new Set(nextPhoto.tags.map(({ tag }) => tag.name.toLowerCase()));
            const newTagItems = suggestions.tags
                .filter((name) => !existingTagNames.has(name.toLowerCase()))
                .map((name, index) => ({
                    tag: {
                        id: `suggested-${index}-${name}`,
                        name
                    }
                }));

            nextPhoto.tags = [...nextPhoto.tags, ...newTagItems];
        }

        setSelectedPhoto(nextPhoto);
        setSuggestions({});
    }

    function hasSuggestions(currentSuggestions: PhotoSuggestions | null) {
        if (!currentSuggestions) return false;

        return Boolean(
            currentSuggestions.caption ||
            currentSuggestions.takenAt ||
            typeof currentSuggestions.latitude === 'number' ||
            typeof currentSuggestions.longitude === 'number' ||
            currentSuggestions.country ||
            currentSuggestions.placeName ||
            currentSuggestions.city ||
            (currentSuggestions.tags && currentSuggestions.tags.length > 0)
        );
    }

    async function savePhoto() {
        if (!selectedPhoto) return;
        setError(null);
        setSuccessMessage(null);
        setEditorStatus(null);
        setIsSaving(true);

        try {
            const response = await fetch(`/api/photos/${selectedPhoto.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    caption: selectedPhoto.caption,
                    country: selectedPhoto.country,
                    city: selectedPhoto.city,
                    placeName: selectedPhoto.placeName,
                    latitude: selectedPhoto.latitude,
                    longitude: selectedPhoto.longitude,
                    takenAt: selectedPhoto.takenAt
                })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                const message = data.error ?? data.details ?? 'Save failed';
                setError(message);
                setEditorStatus({ type: 'error', message });
                return;
            }

            setSuccessMessage('Photo updated successfully.');
            setEditorStatus({ type: 'success', message: 'Saved.' });

            await loadPhotos().catch(() => {
                setEditorStatus({
                    type: 'success',
                    message: 'Saved. List not refreshed!'
                });
            });
        } catch (saveError) {
            const message = saveError instanceof Error ? saveError.message : 'Save failed';
            setError(message);
            setEditorStatus({ type: 'error', message: `Error: ${message}` });
        } finally {
            setIsSaving(false);
        }
    }

    async function saveSelectedPhotosLocation(location: {
        city: string | null;
        country: string | null;
        placeName?: string | null;
        latitude: number | null;
        longitude: number | null;
    }) {
        if (selectedPhotoIds.length === 0) return;

        setError(null);
        setSuccessMessage(null);
        setEditorStatus(null);
        setIsSaving(true);

        try {
            const updates = await Promise.all(
                selectedPhotoIds.map((photoId) =>
                    fetch(`/api/photos/${photoId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(location)
                    })
                )
            );

            const failed = updates.find((response) => !response.ok);
            if (failed) {
                const data = await failed.json().catch(() => ({}));
                const message = data.error ?? data.details ?? 'Batch update failed';
                setError(message);
                setEditorStatus({ type: 'error', message });
                return;
            }

            const okMsg =
                selectedPhotoIds.length > 1
                    ? `Details saved on ${selectedPhotoIds.length} photos.`
                    : 'Details saved.';
            setSuccessMessage(okMsg);
            setEditorStatus({ type: 'success', message: okMsg });

            await loadPhotos().catch(() => {
                setEditorStatus({
                    type: 'success',
                    message: `${okMsg} (update error.)`
                });
            });
        } catch (batchError) {
            const message = batchError instanceof Error ? batchError.message : 'Batch update failed';
            setError(message);
            setEditorStatus({ type: 'error', message: `Salvataggio non riuscito: ${message}` });
        } finally {
            setIsSaving(false);
        }
    }

    async function deletePhoto(photoToDelete: PhotoRecord | null = selectedPhoto) {
        if (!photoToDelete) return;
        setError(null);
        setSuccessMessage(null);

        const response = await fetch(`/api/photos/${photoToDelete.id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const data = await response.json();
            setError(data.error ?? 'Delete failed');
            return;
        }

        setSelectedPhoto((current) => (current?.id === photoToDelete.id ? null : current));
        setSelectedPhotoIds((current) => current.filter((id) => id !== photoToDelete.id));
        setSuccessMessage('Photo deleted successfully.');
        setIsEditorOpen(false);
        setSuggestions(null);
        await loadPhotos();
    }

    async function addTag() {
        if (!selectedPhoto || !tagName.trim()) return;
        setError(null);
        setSuccessMessage(null);

        const response = await fetch(`/api/photos/${selectedPhoto.id}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tagName })
        });

        if (!response.ok) {
            const data = await response.json();
            setError(data.error ?? 'Could not add tag');
            return;
        }

        setTagName('');
        setSuccessMessage('Tag added successfully.');
        await loadPhotos();
    }

    async function addSuggestedTags(tags: string[]) {
        if (!selectedPhoto || tags.length === 0 || isMultiSelection) return;

        setError(null);
        setSuccessMessage(null);

        for (const suggestedTag of tags) {
            const response = await fetch(`/api/photos/${selectedPhoto.id}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tagName: suggestedTag })
            });

            if (!response.ok) {
                const data = await response.json();
                setError(data.error ?? `Could not add suggested tag: ${suggestedTag}`);
                return;
            }
        }

        setSuggestions((current) => {
            if (!current) return current;
            const next = { ...current };
            delete next.tags;
            return next;
        });

        setSuccessMessage('Suggested tags added successfully.');
        await loadPhotos();
    }

    async function removeTag(name: string) {
        if (!selectedPhoto) return;
        setError(null);
        setSuccessMessage(null);

        const response = await fetch(`/api/photos/${selectedPhoto.id}/tags?tagName=${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const data = await response.json();
            setError(data.error ?? 'Could not remove tag');
            return;
        }

        setSuccessMessage('Tag removed successfully.');
        await loadPhotos();
    }

    function applyLocation(result: GeocodeResult) {
        if (!selectedPhoto) return;

        const location = {
            city: result.city || selectedPhoto.city,
            country: selectedPhoto.country,
            placeName: result.name || selectedPhoto.placeName || selectedPhoto.city,
            latitude: result.latitude,
            longitude: result.longitude
        };

        setPlaceQuery(result.name || result.label);
        setSelectedPhoto({
            ...selectedPhoto,
            ...location
        });
    }

    function handlePhotoSelection(photo: PhotoRecord, event: React.MouseEvent<HTMLElement>) {
        if (event.shiftKey && lastSelectedPhotoId) {
            const lastIndex = photos.findIndex((item) => item.id === lastSelectedPhotoId);
            const currentIndex = photos.findIndex((item) => item.id === photo.id);

            if (lastIndex >= 0 && currentIndex >= 0) {
                const [start, end] = lastIndex < currentIndex ? [lastIndex, currentIndex] : [currentIndex, lastIndex];
                const rangeIds = photos.slice(start, end + 1).map((item) => item.id);
                const clickedPhotoWasSelected = selectedPhotoIds.includes(photo.id);

                setSelectedPhotoIds((current) => {
                    const next = new Set(current);
                    rangeIds.forEach((id) => {
                        if (clickedPhotoWasSelected) next.delete(id);
                        else next.add(id);
                    });
                    return photos.filter((item) => next.has(item.id)).map((item) => item.id);
                });
            } else {
                setSelectedPhotoIds((current) =>
                    current.includes(photo.id) ? current.filter((id) => id !== photo.id) : [...current, photo.id]
                );
            }
        } else if (event.metaKey || event.ctrlKey) {
            setSelectedPhotoIds((current) =>
                current.includes(photo.id) ? current.filter((id) => id !== photo.id) : [...current, photo.id]
            );
        } else {
            setSelectedPhotoIds([photo.id]);
        }

        setSelectedPhoto(photo);
        setLastSelectedPhotoId(photo.id);
    }

    function increaseMapHeight() {
        setMapHeight((current) => Math.min(current + mapResizeStep, maxMapHeight));
    }

    function decreaseMapHeight() {
        setMapHeight((current) => Math.max(current - mapResizeStep, minMapHeight));
    }

    function openOriginalImage() {
        if (!selectedPhoto) return;
        window.open(selectedPhoto.imageUrl, '_blank', 'noopener,noreferrer');
    }

    function renderTabButton(tab: PhotoListTab, label: string, count: number) {
        const active = photoListTab === tab;

        return (
            <button type="button" className={active ? '' : 'secondary'} onClick={() => setPhotoListTab(tab)} style={tabButtonBaseStyle}>
                {getTabIcon(tab)}
                <span>{label}</span>
                <span
                    className="small"
                    style={{
                        fontWeight: 700,
                        color: '#1f2937',
                        flexShrink: 0
                    }}
                >
                    ({count})
                </span>
            </button>
        );
    }

    return (
        <div className="stack" style={{ gap: 16 }}>
            {error && <div className="card error-banner">{error}</div>}
            {successMessage && <div className="card success-banner">{successMessage}</div>}

            <div className="stack">
                <section className="card stack">
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" className="secondary" onClick={decreaseMapHeight} disabled={!isMapOpen || mapHeight <= minMapHeight} aria-label="Smaller map" title="Smaller map" style={mapIconButtonStyle}>
                                <IconShrink />
                            </button>
                            <button type="button" className="secondary" onClick={increaseMapHeight} disabled={!isMapOpen || mapHeight >= maxMapHeight} aria-label="Larger map" title="Larger map" style={mapIconButtonStyle}>
                                <IconExpand />
                            </button>
                            <button type="button" className="secondary" onClick={() => setIsMapOpen((current) => !current)} aria-label={isMapOpen ? 'Close map' : 'Open map'} title={isMapOpen ? 'Close map' : 'Open map'} style={mapIconButtonStyle}>
                                {isMapOpen ? <IconClose /> : <IconOpen />}
                            </button>
                        </div>
                    </div>

                    <div style={{ height: isMapOpen ? mapHeight : 0, overflow: 'hidden', transition: 'height 0.25s ease' }}>
                        <div className="map-wrap" style={{ height: mapHeight }}>
                            <PhotoMap
                                photos={photos}
                                selectedPhoto={selectedPhoto}
                                onSelectPhoto={setSelectedPhoto}
                                onPickLocation={(lat, lng) => {
                                    if (!selectedPhoto) return;
                                    const nextPhoto = { ...selectedPhoto, latitude: lat, longitude: lng };
                                    setSelectedPhoto(nextPhoto);
                                }}
                            />
                        </div>
                    </div>
                </section>

                <section className="card stack">
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <h2 style={{ margin: 0 }}>Photos</h2>
                        <span className="small">
                            {totalPhotos} result(s) · page {currentPage} of {totalPages}
                        </span>
                    </div>

                    <div
                        className="card stack"
                        style={{
                            position: 'sticky',
                            top: 12,
                            zIndex: 20,
                            padding: 12,
                            background: 'var(--background, #fff)',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06)'
                        }}
                    >
                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                                {counts.all > 0 ? renderTabButton('all', 'All photos', counts.all) : null}
                                {counts.withGeolocation > 0 ? renderTabButton('with-geolocation', 'With geolocation', counts.withGeolocation) : null}
                                {counts.missingGeolocation > 0 ? renderTabButton('missing-geolocation', 'Without geolocation', counts.missingGeolocation) : null}
                                {counts.missingLocationInfo > 0 ? renderTabButton('missing-location-info', 'Missing location info', counts.missingLocationInfo) : null}
                            </div>

                            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span className="small">Active tags: {selectedTags.length > 0 ? selectedTags.join(', ') : 'none'}</span>

                                <span className="small">Selected: {selectedPhotosCount}</span>
                                <button type="button" onClick={() => openEditor()} disabled={!selectedPhoto} style={tabButtonBaseStyle}>
                                    <IconEdit />
                                    <span>{isMultiSelection ? `Edit selected (${selectedPhotosCount})` : 'Edit selected'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="stack" style={{ gap: 12 }}>
                            <strong>Filters</strong>

                            <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <label>
                                    From
                                    <input type="datetime-local" onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value ? new Date(e.target.value).toISOString() : '' }))} />
                                </label>
                                <label>
                                    To
                                    <input type="datetime-local" onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value ? new Date(e.target.value).toISOString() : '' }))} />
                                </label>
                                <label>
                                    Country
                                    <input value={filters.country} onChange={(e) => setFilters((prev) => ({ ...prev, country: e.target.value }))} />
                                </label>
                                <label>
                                    City
                                    <input value={filters.city} onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value }))} />
                                </label>
                                <button type="button" className="secondary" onClick={() => setFilters(emptyFilters)} aria-label="Reset filters" title="Reset filters" style={filterIconButtonStyle}>
                                    <IconReset />
                                </button>
                            </div>
                        </div>

                        <div
                            className="row"
                            style={{
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 12,
                                flexWrap: 'wrap'
                            }}
                        >
                            <div
                                className="row"
                                style={{
                                    gap: 12,
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    minHeight: 36
                                }}
                            >
                                <span className="small" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 36 }}>
                                    Showing {photos.length} of {totalPhotos} photo(s)
                                </span>

                                <label
                                    className="small"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        minHeight: 36
                                    }}
                                >
                                    <span>Per page</span>
                                    <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ minWidth: 80, height: 36 }}>
                                        {pageSizeOptions.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div
                                className="row"
                                style={{
                                    gap: 8,
                                    alignItems: 'center',
                                    flexWrap: 'nowrap',
                                    minHeight: 36
                                }}
                            >
                                <button type="button" className="secondary" onClick={() => setCurrentPage(1)} disabled={currentPage <= 1} aria-label="First page" title="First page" style={filterIconButtonStyle}>
                                    <IconChevronsLeft />
                                </button>
                                <button type="button" className="secondary" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage <= 1} aria-label="Previous page" title="Previous page" style={filterIconButtonStyle}>
                                    <IconChevronLeft />
                                </button>
                                <span
                                    className="small"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        minHeight: 36,
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    Page {currentPage} / {totalPages}
                                </span>
                                <button type="button" className="secondary" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages} aria-label="Next page" title="Next page" style={filterIconButtonStyle}>
                                    <IconChevronRight />
                                </button>
                                <button type="button" className="secondary" onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages} aria-label="Last page" title="Last page" style={filterIconButtonStyle}>
                                    <IconChevronsRight />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="photo-list">
                        {photos.map((photo) => {
                            const isSelected = selectedPhotoIds.includes(photo.id);

                            return (
                                <article
                                    key={photo.id}
                                    className="photo-card card"
                                    onClick={(event) => handlePhotoSelection(photo, event)}
                                    onDoubleClick={() => openEditor(photo)}
                                    style={{
                                        cursor: 'pointer',
                                        border: isSelected ? '2px solid #0f62fe' : undefined,
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div className="row" style={{ position: 'absolute', top: 8, right: 8, gap: 8, zIndex: 1 }}>
                                        <button
                                            type="button"
                                            className="secondary"
                                            aria-label={`Edit ${photo.originalFilename}`}
                                            title="Edit photo"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                openEditor(photo);
                                            }}
                                            style={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: '999px',
                                                padding: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 14,
                                                lineHeight: 1
                                            }}
                                        >
                                            ✎
                                        </button>

                                        <button
                                            type="button"
                                            className="danger"
                                            aria-label={`Delete ${photo.originalFilename}`}
                                            title="Delete photo"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                void deletePhoto(photo);
                                            }}
                                            style={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: '999px',
                                                padding: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 16,
                                                lineHeight: 1
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>

                                    <img src={photo.imageUrl} alt={photo.originalFilename} />
                                    <div className="stack" style={{ minWidth: 0 }}>
                                        <strong
                                            style={{
                                                display: 'block',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: '100%'
                                            }}
                                            title={photo.originalFilename}
                                        >
                                            {photo.originalFilename}
                                        </strong>
                                        <span className="small">{photo.takenAt ? new Date(photo.takenAt).toLocaleString() : 'No date'}</span>
                                        {'missingFromDisk' in photo && photo.missingFromDisk ? (
                                            <span className="small" style={{ color: '#b42318' }}>
                                                Missing from disk
                                            </span>
                                        ) : null}
                                        <span className="small">
                                            {photo.placeName || photo.country || photo.city ? [photo.placeName, photo.city, photo.country].filter(Boolean).join(' · ') : 'No location label'}
                                        </span>
                                        <div className="tag-list">
                                            {photo.tags.map(({ tag }) => (
                                                <span key={tag.id} className="tag">
                                                    {tag.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            </div>

            {isEditorOpen && selectedPhoto && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15, 23, 42, 0.55)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        padding: 24,
                        zIndex: 1000,
                        overflow: 'auto'
                    }}
                >
                    <section
                        className="card"
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            width: 'min(1100px, calc(100vw - 48px))',
                            maxWidth: 'calc(100vw - 48px)',
                            maxHeight: 'calc(100vh - 48px)',
                            overflow: 'auto',
                            padding: 20
                        }}
                    >
                        <div className="stack" style={{ gap: 16 }}>
                            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                <h2 style={{ margin: 0 }}>{isMultiSelection ? `Edit selection (${selectedPhotosCount})` : 'Edit photo'}</h2>
                                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                                    {!isMultiSelection ? (
                                        <button
                                            type="button"
                                            className="secondary"
                                            onClick={() => void analyzeSelectedPhoto()}
                                            disabled={isAnalyzingPhoto}
                                            aria-label={isAnalyzingPhoto ? 'Analyzing photo' : 'Analyze photo'}
                                            title={isAnalyzingPhoto ? 'Analyzing photo' : 'Analyze photo'}
                                            style={modalIconButtonStyle}
                                        >
                                            <IconAnalyze />
                                        </button>
                                    ) : null}

                                    <button type="button" className="secondary" onClick={openOriginalImage} aria-label="Open original" title="Open original" style={modalIconButtonStyle}>
                                        <IconExternal />
                                    </button>

                                    <button type="button" className="secondary" onClick={closeEditor} aria-label="Close" title="Close" disabled={isSaving} style={modalIconButtonStyle}>
                                        <IconClose />
                                    </button>
                                </div>
                            </div>

                            <div className="card" style={{ padding: 12, background: '#0f172a08' }}>
                                <div
                                    style={{
                                        width: '100%',
                                        height: 'min(60vh, 640px)',
                                        overflow: 'auto',
                                        borderRadius: 8,
                                        border: '1px solid #d0d5dd',
                                        background: '#f8fafc',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 8
                                    }}
                                >
                                    <img
                                        src={selectedPhoto.imageUrl}
                                        alt={selectedPhoto.originalFilename}
                                        style={{
                                            display: 'block',
                                            maxWidth: '100%',
                                            maxHeight: '100%',
                                            width: 'auto',
                                            height: 'auto',
                                            objectFit: 'contain',
                                            borderRadius: 8
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="small">{selectedPhoto.originalFilename}</div>
                            {isMultiSelection && <div className="small">Multi-selection active. Changes to location apply to all selected photos.</div>}

                            {editorStatus ? (
                                <div
                                    className="small"
                                    role={editorStatus.type === 'error' ? 'alert' : 'status'}
                                    aria-live="polite"
                                    style={{
                                        padding: '8px 10px',
                                        borderRadius: 8,
                                        border: editorStatus.type === 'error' ? '1px solid #fecdca' : '1px solid #abefc6',
                                        background: editorStatus.type === 'error' ? '#fef3f2' : '#ecfdf3',
                                        color: editorStatus.type === 'error' ? '#b42318' : '#027a48'
                                    }}
                                >
                                    {editorStatus.message}
                                </div>
                            ) : null}

                            {!isMultiSelection && hasSuggestions(suggestions) ? (
                                <div className="card stack" style={{ gap: 12, padding: 12, background: '#ecfdf3', border: '1px solid #abefc6' }}>
                                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                        <h3 style={{ margin: 0 }}>Suggestions</h3>
                                        <button type="button" className="secondary" onClick={applyAllSuggestions}>
                                            Apply all
                                        </button>
                                    </div>

                                    {suggestions.caption ? (
                                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                            <div className="stack" style={{ gap: 4 }}>
                                                <strong>Caption</strong>
                                                <div className="small">{suggestions.caption}</div>
                                            </div>
                                            <button type="button" className="secondary" onClick={() => applySuggestionField('caption')}>
                                                Apply
                                            </button>
                                        </div>
                                    ) : null}

                                    {suggestions.takenAt ? (
                                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                            <div className="stack" style={{ gap: 4 }}>
                                                <strong>Taken at</strong>
                                                <div className="small">{new Date(suggestions.takenAt).toLocaleString()}</div>
                                            </div>
                                            <button type="button" className="secondary" onClick={() => applySuggestionField('takenAt')}>
                                                Apply
                                            </button>
                                        </div>
                                    ) : null}

                                    {typeof suggestions.latitude === 'number' ? (
                                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                            <div className="stack" style={{ gap: 4 }}>
                                                <strong>Latitude</strong>
                                                <div className="small">{suggestions.latitude}</div>
                                            </div>
                                            <button type="button" className="secondary" onClick={() => applySuggestionField('latitude')}>
                                                Apply
                                            </button>
                                        </div>
                                    ) : null}

                                    {typeof suggestions.longitude === 'number' ? (
                                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                            <div className="stack" style={{ gap: 4 }}>
                                                <strong>Longitude</strong>
                                                <div className="small">{suggestions.longitude}</div>
                                            </div>
                                            <button type="button" className="secondary" onClick={() => applySuggestionField('longitude')}>
                                                Apply
                                            </button>
                                        </div>
                                    ) : null}

                                    {suggestions.country ? (
                                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                            <div className="stack" style={{ gap: 4 }}>
                                                <strong>Country</strong>
                                                <div className="small">{suggestions.country}</div>
                                            </div>
                                            <button type="button" className="secondary" onClick={() => applySuggestionField('country')}>
                                                Apply
                                            </button>
                                        </div>
                                    ) : null}

                                    {suggestions.placeName ? (
                                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                            <div className="stack" style={{ gap: 4 }}>
                                                <strong>Place</strong>
                                                <div className="small">{suggestions.placeName}</div>
                                            </div>
                                            <button type="button" className="secondary" onClick={() => applySuggestionField('placeName')}>
                                                Apply
                                            </button>
                                        </div>
                                    ) : null}

                                    {suggestions.city ? (
                                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                            <div className="stack" style={{ gap: 4 }}>
                                                <strong>City</strong>
                                                <div className="small">{suggestions.city}</div>
                                            </div>
                                            <button type="button" className="secondary" onClick={() => applySuggestionField('city')}>
                                                Apply
                                            </button>
                                        </div>
                                    ) : null}

                                    {Array.isArray(suggestions.tags) && suggestions.tags.length > 0 ? (
                                        <div className="stack" style={{ gap: 8 }}>
                                            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                                <div className="stack" style={{ gap: 4 }}>
                                                    <strong>Tags</strong>
                                                    <div className="tag-list">
                                                        {suggestions.tags.map((tag) => (
                                                            <span key={tag} className="tag">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="row" style={{ gap: 8 }}>
                                                    <button type="button" className="secondary" onClick={() => applySuggestionField('tags')}>
                                                        Apply to form
                                                    </button>
                                                    <button type="button" className="secondary" onClick={() => void addSuggestedTags(suggestions.tags ?? [])}>
                                                        Add tags
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}

                            {!isMultiSelection && suggestions && !hasSuggestions(suggestions) && !isAnalyzingPhoto ? <div className="small">No missing fields could be suggested for this photo.</div> : null}

                            <label>
                                Caption
                                <textarea value={selectedPhoto.caption ?? ''} onChange={(e) => setSelectedPhoto({ ...selectedPhoto, caption: e.target.value })} disabled={isMultiSelection} />
                            </label>

                            <label>
                                Taken at
                                <input
                                    type="datetime-local"
                                    value={selectedPhoto.takenAt ? new Date(selectedPhoto.takenAt).toISOString().slice(0, 16) : ''}
                                    onChange={(e) =>
                                        setSelectedPhoto({
                                            ...selectedPhoto,
                                            takenAt: e.target.value ? new Date(e.target.value).toISOString() : null
                                        })
                                    }
                                    disabled={isMultiSelection}
                                />
                            </label>

                            <div className="row">
                                <label>
                                    Latitude
                                    <input
                                        type="number"
                                        step="any"
                                        value={selectedPhoto.latitude ?? ''}
                                        onChange={(e) =>
                                            setSelectedPhoto({
                                                ...selectedPhoto,
                                                latitude: e.target.value ? Number(e.target.value) : null
                                            })
                                        }
                                    />
                                </label>
                                <label>
                                    Longitude
                                    <input
                                        type="number"
                                        step="any"
                                        value={selectedPhoto.longitude ?? ''}
                                        onChange={(e) =>
                                            setSelectedPhoto({
                                                ...selectedPhoto,
                                                longitude: e.target.value ? Number(e.target.value) : null
                                            })
                                        }
                                    />
                                </label>
                            </div>

                            <span className="small">Tip: click on the map while this photo is selected to set its position.</span>

                            <div className="row" style={{ alignItems: 'flex-start' }}>
                                <label>
                                    Country
                                    <input value={selectedPhoto.country ?? ''} onChange={(e) => setSelectedPhoto({ ...selectedPhoto, country: e.target.value })} />
                                </label>

                                <label style={{ width: '100%' }}>
                                    Place
                                    <LocationAutocomplete
                                        label=""
                                        value={placeQuery}
                                        placeholder="Search a place, museum, landmark, or city"
                                        onChange={(value) => {
                                            setPlaceQuery(value);
                                            setSelectedPhoto({
                                                ...selectedPhoto,
                                                placeName: value,
                                                latitude: null,
                                                longitude: null
                                            });
                                        }}
                                        onSelect={applyLocation}
                                    />
                                </label>
                            </div>

                            <div className="row">
                                <label style={{ width: '100%' }}>
                                    City
                                    <input value={selectedPhoto.city ?? ''} onChange={(e) => setSelectedPhoto({ ...selectedPhoto, city: e.target.value })} />
                                </label>
                            </div>

                            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                                <button
                                    type="button"
                                    className="secondary"
                                    aria-label={isMultiSelection ? `Apply location to ${selectedPhotosCount} photos` : 'Save changes'}
                                    title={isMultiSelection ? `Apply location to ${selectedPhotosCount} photos` : 'Save changes'}
                                    style={modalIconButtonStyle}
                                    disabled={isSaving}
                                    onClick={() => {
                                        if (isSaving) return;
                                        if (isMultiSelection) {
                                            void saveSelectedPhotosLocation({
                                                city: selectedPhoto.city ?? null,
                                                country: selectedPhoto.country ?? null,
                                                placeName: selectedPhoto.placeName ?? null,
                                                latitude: selectedPhoto.latitude ?? null,
                                                longitude: selectedPhoto.longitude ?? null
                                            });
                                            return;
                                        }

                                        void savePhoto();
                                    }}
                                >
                                    <IconSave />
                                </button>

                                <button type="button" className="danger" aria-label="Delete photo" title="Delete photo" onClick={() => void deletePhoto()} disabled={isMultiSelection || isSaving} style={modalDangerIconButtonStyle}>
                                    <IconTrash />
                                </button>
                            </div>

                            <div className="stack">
                                <h3>Tags</h3>
                                <div className="tag-list">
                                    {selectedPhoto.tags.map(({ tag }) => (
                                        <span key={tag.id} className="tag">
                                            {tag.name}
                                            <button type="button" className="danger small-button" onClick={() => void removeTag(tag.name)}>
                                                x
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                                    <input value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="e.g. panorama" />
                                    <button type="button" className="secondary" onClick={() => void addTag()} disabled={isMultiSelection} aria-label="Add tag" title="Add tag" style={modalIconButtonStyle}>
                                        <IconPlus />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}