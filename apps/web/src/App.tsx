import { ReactNode, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { Layout } from './components/Layout';
import { EmptyState } from './components/Notice';
import { LoginPage, SignupPage } from './pages/AuthPages';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { FeedPage } from './pages/FeedPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { ThreadPage } from './pages/ThreadPage';
import { VerifyPage } from './pages/VerifyPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  return user ? <>{children}</> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

export default function App() {
  const { user } = useAuth();
  const theme = user?.preferences.theme ?? 'system';

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
  }, [theme]);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/feed" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/feed" element={<RequireAuth><FeedPage /></RequireAuth>} />
        <Route path="/thread/:id" element={<RequireAuth><ThreadPage /></RequireAuth>} />
        <Route path="/profile/:id" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/connections" element={<RequireAuth><ConnectionsPage /></RequireAuth>} />
        <Route path="/verify" element={<RequireAuth><VerifyPage /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        <Route path="*" element={<EmptyState title="Page not found">That page does not exist.</EmptyState>} />
      </Route>
    </Routes>
  );
}
