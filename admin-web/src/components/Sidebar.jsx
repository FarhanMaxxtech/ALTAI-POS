import { NavLink } from 'react-router-dom';
import { navigation } from '../navigation.js';
import { useAuth } from '../features/auth/useAuth.js';
import Icon from './Icon.jsx';

// The left menu. Items come from navigation.js; NavLink adds the "active" class to the current page.
// onNavigate lets the phone layout close the menu after a tap.
export default function Sidebar({ onNavigate }) {
    const { user, signOut } = useAuth();

    return (
        <nav className="sidebar" aria-label="Main">
            <div className="sidebar-brand">
                <div className="brand-mark small" aria-hidden="true">A</div>
                <span>ALTAI POS</span>
            </div>

            <div className="sidebar-sections">
                {navigation.map((section) => (
                    <div className="nav-section" key={section.title}>
                        <h2 className="nav-heading">{section.title}</h2>
                        <ul>
                            {section.items.map((item) => (
                                <li key={item.path}>
                                    <NavLink
                                        to={item.path}
                                        end={item.path === '/'} // otherwise "/" would match every page
                                        className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                                        onClick={onNavigate}
                                    >
                                        <Icon name={item.icon} />
                                        <span className="nav-label">{item.label}</span>
                                        {item.status === 'planned' && <span className="soon">Soon</span>}
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            <div className="sidebar-user">
                <div className="sidebar-user-text">
                    <span className="sidebar-user-name">{user?.name ?? 'Signed in'}</span>
                    <span className="muted small">Merchant {user?.merchant_id ?? '—'}</span>
                </div>
                <button type="button" className="icon-button" onClick={signOut} aria-label="Sign out" title="Sign out">
                    <Icon name="logout" />
                </button>
            </div>
        </nav>
    );
}
