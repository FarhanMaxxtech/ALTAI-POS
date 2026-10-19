import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

// Wrap any page that needs a logged-in user. Not logged in → go to /login,
// remembering where they wanted to go so we can send them back after login.
export default function RequireAuth({ children }) {
    const { status } = useAuth();
    const location = useLocation();

    if (status === 'checking') {
        return <div className="center-screen muted" role="status">Checking your session…</div>;
    }
    if (status !== 'signed-in') {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }
    return children;
}
