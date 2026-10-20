import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Icon from './Icon.jsx';

// The frame around every signed-in page.
// Wide screens: sidebar always visible on the left.
// Phones (under 900px): the sidebar is hidden; the ☰ button opens it as a drawer over the page.
// <Outlet /> is where React Router puts the current page, so the shell stays mounted while you navigate.
export default function AppShell() {
    const [menuOpen, setMenuOpen] = useState(false);

    // Close the drawer with Escape, and stop the page behind it from scrolling while it's open.
    useEffect(() => {
        if (!menuOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [menuOpen]);

    return (
        <div className={menuOpen ? 'shell menu-open' : 'shell'}>
            <header className="mobile-bar">
                <button type="button" className="icon-button" onClick={() => setMenuOpen(true)}
                    aria-label="Open menu" aria-expanded={menuOpen} aria-controls="app-sidebar">
                    <Icon name="menu" size={20} />
                </button>
                <div className="brand-mark small" aria-hidden="true">A</div>
                <span className="mobile-bar-title">ALTAI POS</span>
            </header>

            <div className="sidebar-wrap" id="app-sidebar">
                <button type="button" className="icon-button drawer-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">
                    <Icon name="close" size={20} />
                </button>
                <Sidebar onNavigate={() => setMenuOpen(false)} />
            </div>
            <div className="backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />

            <main className="content">
                <Outlet />
            </main>
        </div>
    );
}
