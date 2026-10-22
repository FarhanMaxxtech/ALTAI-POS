// Shown for menu items that aren't built yet. It tells the reader what the page will do,
// when it's planned, and where its data will come from, straight from navigation.js.
export default function ComingSoon({ item }) {
    return (
        <>
            <div className="page-header">
                <h1>{item.label}</h1>
                <span className="status-pill">Not built yet</span>
            </div>
            <section className="card placeholder">
                <p>{item.summary}</p>
                <dl className="facts">
                    <div><dt>Planned for</dt><dd>{item.phase ?? '—'}</dd></div>
                    <div><dt>Data from</dt><dd>{item.source ?? '—'}</dd></div>
                </dl>
            </section>
        </>
    );
}
