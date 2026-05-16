import { Link, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import ClipFormPage from './pages/ClipFormPage';

export default function App() {
  return (
    <div className="min-h-full bg-bg text-text">
      <header className="border-b border-surface/50 bg-bg-soft">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            Personal Clip Player
          </Link>
          <nav className="flex items-center gap-4 text-sm text-text-muted">
            <Link to="/" className="hover:text-text">
              Dashboard
            </Link>
            <Link
              to="/clips/new"
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-soft"
            >
              New clip
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clips/new" element={<ClipFormPage mode="create" />} />
          <Route path="/clips/:id/edit" element={<ClipFormPage mode="edit" />} />
        </Routes>
      </main>
    </div>
  );
}
