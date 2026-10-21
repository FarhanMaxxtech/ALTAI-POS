import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import ComingSoon from './components/ComingSoon.jsx';
import LoginPage from './features/auth/LoginPage.jsx';
import RequireAuth from './features/auth/RequireAuth.jsx';
import CampaignsPage from './features/campaigns/CampaignsPage.jsx';
import CustomersPage from './features/customers/CustomersPage.jsx';
import HomePage from './features/home/HomePage.jsx';
import ProductsPage from './features/catalog/ProductsPage.jsx';
import ShiftsPage from './features/shifts/ShiftsPage.jsx';
import StoresPage from './features/stores/StoresPage.jsx';
import { allNavItems } from './navigation.js';

// Built pages, by the `page` key used in navigation.js.
const pages = {
    campaigns: CampaignsPage,
    customers: CustomersPage,
    home: HomePage,
    products: ProductsPage,
    shifts: ShiftsPage,
    stores: StoresPage,
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
