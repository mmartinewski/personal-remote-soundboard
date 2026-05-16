export interface HealthResponse {
  status: 'ok';
  version: string;
  appData: string;
}

export interface SettingsResponse {
  playback_volume: number;
}

export interface ClipDto {
  id: number;
  title: string;
  category: { id: number | null; name: string | null };
  tags: string;
  thumbnail_cropped_url: string;
  volume: number;
  audio_normalize: number;
  is_favorite: number;
  created_at: string;
}

export type ClipsSection =
  | { type: 'favorites'; title: 'Favoritos'; clips: ClipDto[] }
  | { type: 'category'; category: { id: number | null; name: string }; clips: ClipDto[] };

export interface ClipsResponse {
  sections: ClipsSection[];
  playback_volume: number;
}

export interface PrefetchResponse {
  process_id: string;
  duration_seconds: number;
  audio_url: string;
  thumbnail_url: string;
  source_format: string;
}

export interface ClipDetail {
  id: number;
  title: string;
  youtube_url: string;
  start_time: string;
  end_time: string;
  category: { id: number | null; name: string | null };
  tags: string;
  thumbnail_crop_meta: string | null;
  thumbnail_original_url: string;
  thumbnail_cropped_url: string;
  volume: number;
  audio_normalize: number;
  is_favorite: number;
  created_at: string;
}

export interface CategorySuggestion {
  id: number;
  name: string;
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { message?: string };
      detail = body.message ?? '';
    } catch {
      /* noop */
    }
    throw new Error(
      detail || `Pedido falhou (${res.status} ${res.statusText})`,
    );
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => request<HealthResponse>('/api/health'),
  getClips: (search?: string) =>
    request<ClipsResponse>(
      '/api/clips' + (search ? `?search=${encodeURIComponent(search)}` : ''),
    ),
  getCategorySuggestions: (q: string) =>
    request<{ categories: CategorySuggestion[] }>(
      `/api/clips/suggestions/categories?q=${encodeURIComponent(q)}`,
    ),
  getTagSuggestions: (q: string) =>
    request<{ tags: string[] }>(
      `/api/clips/suggestions/tags?q=${encodeURIComponent(q)}`,
    ),
  getSettings: () => request<SettingsResponse>('/api/settings'),
  setVolume: (playback_volume: number) =>
    request<SettingsResponse>('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playback_volume }),
    }),
  stop: () =>
    request<{ status: 'stopped' }>('/api/clips/stop', { method: 'POST' }),
  prefetchYoutube: (youtube_url: string) =>
    request<PrefetchResponse>('/api/clips/prefetch/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ youtube_url }),
    }),
  testPlayStaging: (body: {
    process_id: string;
    start_time: string;
    end_time: string;
    volume?: number;
    audio_normalize?: boolean;
  }) =>
    request<{ status: string }>('/api/clips/test-play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  getClip: (id: number) => request<ClipDetail>(`/api/clips/${id}`),
  createClip: (form: FormData) =>
    request<{ id: number; message: string }>('/api/clips', {
      method: 'POST',
      body: form,
    }),
  updateClip: (id: number, form: FormData) =>
    request<{ id: number; message: string }>(`/api/clips/${id}`, {
      method: 'PUT',
      body: form,
    }),
  playClip: (id: number) =>
    request<{ status: string }>(`/api/clips/${id}/play`, { method: 'POST' }),
  setFavorite: (id: number, is_favorite: boolean) =>
    request<{ id: number; is_favorite: number }>(`/api/clips/${id}/favorite`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite }),
    }),
  deleteClip: (id: number) =>
    request<{ status: 'deleted'; id: number }>(`/api/clips/${id}`, {
      method: 'DELETE',
    }),
};
