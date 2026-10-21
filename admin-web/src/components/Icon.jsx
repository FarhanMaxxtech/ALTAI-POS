// Small line icons drawn on a 24×24 grid. Each entry is one SVG path ("M" = move to, "L"/"h"/"v" = line,
// "a" = arc). Colour comes from the surrounding text (currentColor), so icons follow light/dark mode.
const paths = {
    home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
    return: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
    cash: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5M6 10v4M18 10v4',
    shirt: 'M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z',
    tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
    folder: 'M3 6h6l2 2h10v11H3z',
    percent: 'M19 5L5 19M7 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4M17 15a2 2 0 1 1 0 4 2 2 0 0 1 0-4',
    box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
    arrows: 'M4 8h15l-3-3M20 16H5l3 3',
    clipboard: 'M9 3h6v3H9zM7 4.5H5V21h14V4.5h-2M9 13l2 2 4-4',
    signal: 'M12 12h.01M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13',
    users: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M22 20v-1a4 4 0 0 0-3-3.9M16 4.2a3.5 3.5 0 0 1 0 6.6',
    chart: 'M4 20V11M10 20V5M16 20v-7M2 20h20',
    store: 'M3 9l2-5h14l2 5M4 9v11h16V9M3 9h18M9 20v-6h6v6',
    badge: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
    megaphone: 'M3 10v4h3l7 5V5L6 10zM16 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11',
    menu: 'M4 6h16M4 12h16M4 18h16',
    close: 'M6 6l12 12M18 6L6 18',
    logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
};

export default function Icon({ name, size = 18 }) {
    const d = paths[name];
    if (!d) return null;
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d={d} />
        </svg>
    );
}
