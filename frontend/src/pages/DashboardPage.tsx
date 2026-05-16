import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ClipDto, type ClipsResponse } from '../lib/api';

export default function DashboardPage() {
  const [clips, setClips] = useState<ClipsResponse | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<number, string>>({});
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [playPulse, setPlayPulse] = useState<{ id: number; token: number } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [favoriteId, setFavoriteId] = useState<number | null>(null);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [clipToDelete, setClipToDelete] = useState<ClipDto | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api
        .getClips(search)
        .then((c) => {
          if (!cancelled) setClips(c);
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search]);

  const reloadClips = async () => {
    setClips(await api.getClips(search));
  };

  const handlePlay = async (id: number) => {
    const token = Date.now();
    setPlayPulse({ id, token });
    window.setTimeout(() => {
      setPlayPulse((current) =>
        current?.id === id && current.token === token ? null : current,
      );
    }, 337);
    setCardErrors((prev) => ({ ...prev, [id]: '' }));
    setPlayingId(id);
    try {
      await api.playClip(id);
    } catch (err) {
      setCardErrors((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setPlayingId(null);
    }
  };

  const requestDelete = (clip: ClipDto) => {
    setOpenMenuKey(null);
    setClipToDelete(clip);
  };

  const confirmDelete = async () => {
    if (!clipToDelete) return;
    const clip = clipToDelete;
    setCardErrors((prev) => ({ ...prev, [clip.id]: '' }));
    setDeletingId(clip.id);
    try {
      await api.deleteClip(clip.id);
      setClipToDelete(null);
      await reloadClips();
    } catch (err) {
      setCardErrors((prev) => ({
        ...prev,
        [clip.id]: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleFavorite = async (clip: ClipDto) => {
    setCardErrors((prev) => ({ ...prev, [clip.id]: '' }));
    setFavoriteId(clip.id);
    try {
      await api.setFavorite(clip.id, clip.is_favorite !== 1);
      await reloadClips();
    } catch (err) {
      setCardErrors((prev) => ({
        ...prev,
        [clip.id]: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setFavoriteId(null);
    }
  };

  if (error) {
    return (
      <section className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-red-200">
        <p className="font-semibold">Erro ao contactar o backend.</p>
        <p className="text-sm opacity-80">{error}</p>
      </section>
    );
  }

  if (!clips) {
    return <p className="text-text-muted">A carregar…</p>;
  }

  return (
    <section className="space-y-6">
      <div className="sticky top-0 z-30 rounded-md border border-surface bg-bg/95 p-3 shadow-lg backdrop-blur">
        <label htmlFor="dashboard-search" className="block text-sm font-medium">
          Buscar clipes
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="dashboard-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Título, categoria ou etiqueta..."
            className="min-w-0 flex-1 rounded-md border border-surface bg-bg-soft px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="rounded-md border border-surface px-3 py-2 text-sm hover:border-accent"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {clips.sections.map((section, idx) => (
        <article
          key={idx}
          className="rounded-md border border-surface bg-surface-soft p-4"
        >
          <h3 className="mb-2 text-base font-semibold">
            {section.type === 'favorites' ? 'Favoritos' : section.category.name}
          </h3>
          {section.clips.length === 0 ? (
            <p className="text-sm text-text-muted">Sem clipes nesta secção.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {section.clips.map((clip) => {
                const menuKey = `${section.type}-${section.type === 'category' ? section.category.id ?? 'none' : 'favorites'}-${clip.id}`;
                return (
                <li
                  key={clip.id}
                  className="overflow-hidden rounded-md border border-surface/70 bg-bg-soft text-sm"
                >
                  <div className="relative">
                    <img
                      src={clip.thumbnail_cropped_url}
                      alt=""
                      className="aspect-square w-full bg-surface object-cover"
                      loading="lazy"
                    />
                    <button
                      type="button"
                      aria-label={clip.is_favorite === 1 ? 'Remover dos favoritos' : 'Marcar como favorito'}
                      onClick={() => void handleToggleFavorite(clip)}
                      disabled={favoriteId === clip.id}
                      className={
                        'absolute left-2 top-2 z-10 rounded-full bg-black/45 px-2 py-1 text-xl leading-none shadow backdrop-blur ' +
                        (clip.is_favorite === 1 ? 'text-yellow-300' : 'text-white')
                      }
                    >
                      {clip.is_favorite === 1 ? '★' : '☆'}
                    </button>
                    <button
                      type="button"
                      aria-label="Abrir menu do clipe"
                      onClick={() => setOpenMenuKey((current) => (current === menuKey ? null : menuKey))}
                      className="absolute right-2 top-2 z-20 rounded-full bg-black/45 px-2 py-1 text-xl leading-none text-white shadow backdrop-blur"
                    >
                      ⋮
                    </button>
                    {openMenuKey === menuKey && (
                      <>
                        <button
                          type="button"
                          aria-label="Fechar menu"
                          onClick={() => setOpenMenuKey(null)}
                          className="fixed inset-0 z-20 cursor-default bg-transparent"
                        />
                        <div className="absolute right-2 top-11 z-30 min-w-32 overflow-hidden rounded-md border border-surface bg-bg shadow-xl">
                        <Link
                          to={`/clips/${clip.id}/edit`}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-soft"
                          onClick={() => setOpenMenuKey(null)}
                        >
                          <span aria-hidden="true">✎</span>
                          Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() => requestDelete(clip)}
                          disabled={deletingId === clip.id}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-200 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span aria-hidden="true">🗑</span>
                          {deletingId === clip.id ? 'Excluindo...' : 'Excluir'}
                        </button>
                      </div>
                      </>
                    )}
                    <button
                      type="button"
                      aria-label={`Tocar ${clip.title}`}
                      onClick={() => void handlePlay(clip.id)}
                      disabled={deletingId === clip.id}
                      className={
                        'absolute inset-0 flex items-center justify-center text-white transition duration-200 hover:bg-black/20 disabled:opacity-60 ' +
                        (playPulse?.id === clip.id ? 'bg-white/25' : 'bg-black/10')
                      }
                    >
                      <span
                        className={
                          'relative flex h-16 w-16 items-center justify-center rounded-full text-3xl shadow-lg backdrop-blur transition-all duration-300 ' +
                          (playPulse?.id === clip.id
                            ? 'scale-125 bg-white/90 text-bg ring-4 ring-white/60'
                            : 'scale-100 bg-black/45 text-white')
                        }
                      >
                        <span className="relative translate-x-0.5">▶</span>
                      </span>
                    </button>
                  </div>
                  <div className="p-3">
                    <p className="truncate font-medium">{clip.title}</p>
                    <p className="truncate text-xs text-text-muted">
                      {clip.category.name ?? '(sem categoria)'}
                    </p>
                  </div>
                  {cardErrors[clip.id] && (
                    <div className="border-t border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
                      {cardErrors[clip.id]}
                    </div>
                  )}
                </li>
                );
              })}
            </ul>
          )}
        </article>
      ))}
      {clipToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-clip-title"
          onClick={() => {
            if (deletingId !== clipToDelete.id) setClipToDelete(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div
            className="w-full max-w-sm rounded-lg border border-surface bg-bg p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-clip-title" className="text-lg font-semibold">
              Excluir clipe?
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              Esta ação removerá o clipe <strong className="text-text">{clipToDelete.title}</strong> e seus arquivos de áudio/thumbnail.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClipToDelete(null)}
                disabled={deletingId === clipToDelete.id}
                className="rounded-md border border-surface px-4 py-2 text-sm hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deletingId === clipToDelete.id}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId === clipToDelete.id ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
