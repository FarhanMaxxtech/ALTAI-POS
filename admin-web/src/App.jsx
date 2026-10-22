import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import ComingSoon from './components/ComingSoon.jsx';
import LoginPage from './features/auth/LoginPage.jsx';
import RequireAuth from './features/auth/RequireAuth.jsx';
import HomePage from './features/home/HomePage.jsx';
import StoresPage from './features/stores/StoresPage.jsx';
import SettingsPage from './features/settings/SettingsPage.jsx';
import { allNavItems } from './navigation.js';

// Built pages, by the `page` key used in navigation.js.
const pages = {
    home: HomePage,
    stores: StoresPage,
    settings: SettingsPage,
};

// Every URL of the admin site. The routes are generated from navigation.js, so every menu item
// has a page: the real one when it's built, otherwise the "not built yet" page.
export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            {/* Layout route: login check + sidebar once, the pages render inside AppShell's <Outlet /> */}
            <Route element={<RequireAuth><AppShell /></RequireAuth>}>
                {allNavItems.map((item) => {
                    const Page = item.status === 'ready' ? pages[item.page] : null;
                    return (
                        <Route
                            key={item.path}
                            path={item.path}
                            element={Page ? <Page /> : <ComingSoon item={item} />}
                        />
                    );
                })}
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
