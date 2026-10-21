// Every page of the admin site, in sidebar order. ONE list, used by both the sidebar and the
// router (App.jsx), so a menu item and its URL can never drift apart.
//
// Adding a page:
//   1. add an item here with status 'planned' → it appears in the menu with a "Soon" page
//   2. build the page component, register it in `pages` in App.jsx, and set status 'ready'
//
// item fields:
//   path     URL of the page
//   label    text in the menu
//   icon     name from components/Icon.jsx
//   status   'ready' (built) or 'planned' (shows the "coming soon" page)
//   page     key in App.jsx `pages` (ready items only)
//   phase    when it's planned to be built (see the team plan)
//   source   where its data comes from: 'Team API' or 'ALTAI backend'
//   summary  one sentence: what the page will let you do

export const navigation = [
    {
        title: 'Overview',
        items: [
            { path: '/', label: 'Dashboard', icon: 'home', status: 'ready', page: 'home',
                summary: 'Welcome page and what is ready so far.' },
        ],
    },
    {
        title: 'Sales',
        items: [
            { path: '/sales', label: 'Sales', icon: 'receipt', status: 'planned', phase: 'Phase 2', source: 'ALTAI backend',
                summary: 'Every sale with its lines, discounts, payments and receipt number. Filter by date, store and cashier.' },
            { path: '/returns', label: 'Returns', icon: 'return', status: 'planned', phase: 'Phase 4', source: 'ALTAI backend',
                summary: 'Returns and exchanges, with the original receipt and how the refund was paid.' },
            { path: '/shifts', label: 'Shifts & cash', icon: 'cash', status: 'ready', page: 'shifts', source: 'ALTAI backend',
                summary: 'Till shifts: opening float, cash in and out, counted cash, and the daily Z report.' },
        ],
    },
    {
        title: 'Catalog',
        items: [
            { path: '/products', label: 'Products', icon: 'shirt', status: 'ready', page: 'products', source: 'Team API',
                summary: 'Scan or paste RFID tags to see which products, SKUs and stores they belong to.' },
            { path: '/prices', label: 'Prices', icon: 'tag', status: 'ready', page: 'prices', source: 'ALTAI backend',
                summary: 'Set the selling price per SKU and per store, and update a whole style at once.' },
            { path: '/categories', label: 'Categories', icon: 'folder', status: 'planned', phase: 'Phase 1', source: 'Team API',
                summary: 'How products are grouped, e.g. Tops → T-shirts.' },
            { path: '/promotions', label: 'Promotions', icon: 'percent', status: 'planned', phase: 'Phase 5', source: 'ALTAI backend',
                summary: 'Deals such as buy 2 get 1 or 2nd item 50% off, with start and end dates.' },
        ],
    },
    {
        title: 'Inventory',
        items: [
            { path: '/stock', label: 'Stock levels', icon: 'box', status: 'planned', phase: 'Phase 1', source: 'Team API',
                summary: 'How many of each SKU every store has right now.' },
            { path: '/transfers', label: 'Transfers', icon: 'arrows', status: 'planned', phase: 'Phase 2', source: 'Team API',
                summary: 'Stock moved between stores and the warehouse, and who approved it.' },
            { path: '/stock-counts', label: 'Stock counts', icon: 'clipboard', status: 'planned', phase: 'Phase 2', source: 'Team API',
                summary: 'Stock takes and their differences between counted and expected stock.' },
            { path: '/rfid', label: 'RFID tags', icon: 'signal', status: 'planned', phase: 'Phase 1', source: 'Team API',
                summary: 'Manage tags: assign new tags to a SKU, and mark tags as missing, sold or retired.' },
        ],
    },
    {
        title: 'Customers',
        items: [
            { path: '/customers', label: 'Customers', icon: 'users', status: 'ready', page: 'customers', source: 'ALTAI backend',
                summary: 'Regular customers by phone number, with their consent to WhatsApp and email promotions.' },
            { path: '/campaigns', label: 'Campaigns', icon: 'megaphone', status: 'ready', page: 'campaigns', source: 'ALTAI backend',
                summary: 'Promotional messages by WhatsApp or email to customers who agreed to receive them.' },
        ],
    },
    {
        title: 'Reports',
        items: [
            { path: '/reports', label: 'Reports', icon: 'chart', status: 'planned', phase: 'Phase 5', source: 'ALTAI backend',
                summary: 'Sales by store, day, staff, style, size and colour; best sellers and payment totals.' },
        ],
    },
    {
        title: 'Admin',
        items: [
            { path: '/stores', label: 'Stores', icon: 'store', status: 'ready', page: 'stores', source: 'Team API',
                summary: 'The stores your account can access.' },
            { path: '/staff', label: 'Staff', icon: 'badge', status: 'planned', phase: 'Phase 3', source: 'Team API',
                summary: 'Staff accounts and what each person is allowed to do.' },
            { path: '/settings', label: 'Settings', icon: 'settings', status: 'ready', page: 'settings', source: 'ALTAI backend',
                summary: 'Store details, SST tax settings and the receipt header and footer.' },
        ],
    },
];

export const allNavItems = navigation.flatMap((section) => section.items);
