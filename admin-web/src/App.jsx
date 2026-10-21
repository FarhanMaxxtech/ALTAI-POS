import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import LoginPage from './features/auth/LoginPage.jsx';
import RequireAuth from './features/auth/RequireAuth.jsx';
import HomePage from './features/home/HomePage.jsx';
import SettingsPage from './features/settings/SettingsPage.jsx';

// Every URL of the admin site. Pages that need login are wrapped in <RequireAuth>.
export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/settings" element={<RequireAuth><AppShell><SettingsPage /></AppShell></RequireAuth>} />
            <Route path="/" element={<RequireAuth><AppShell><HomePage /></AppShell></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
