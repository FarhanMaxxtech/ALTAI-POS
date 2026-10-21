// Shown on every inventory page: these pages only show what's in the team's system.
// Approving, voiding and creating transfers, counts and adjustments happen in the team's website
// (decision 006), until the team confirms those endpoints and provides a test server.
export default function ViewOnlyNote() {
    return (
        <p className="alert info">
            View only. These figures come live from the team's stock system. To approve, void or create
            transfers, counts and adjustments, use the team's website.
        </p>
    );
}
