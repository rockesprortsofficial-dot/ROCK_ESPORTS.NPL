# WOW GROUP DIVISION

An independent tab added to the existing ROCK ESPORTS site. Existing name, URL,
navigation entries, site data, TDM, tournament, registration and draw modules are retained.

## Owner workflow

1. Sign in using the existing ADMIN / EDIT login with the authorized owner account.
2. Open **WOW GROUP DIVISION**, choose **2v2**, **3v3** or **4v4**, then **OWNER · EDIT TOURNAMENT**.
3. Add/remove groups and teams. Each team has exactly the selected mode's player count.
   Edit team/player names and choose team logos/player photos. JPG, PNG and WebP
   uploads up to 5 MB are resized to a maximum 384 pixels for publication.
4. **SAVE ONLINE** publishes changes. **CANCEL** discards unsaved changes.
5. Start a manual draw, or choose a future date/time and schedule it. The time field
   uses the owner's device timezone; public times use each viewer's device timezone.
   The server stores one shuffled order, reveals one team every three seconds and
   distributes teams evenly across groups. The owner's browser may be closed.
6. After the draw completes, select qualifiers within each group and build the bracket.
   Save to publish it. Pick match winners and save results. Semifinal losers play for #3.
   BYEs advance automatically. Correcting a winner clears all dependent results.
7. Reset the mode's draw/bracket before adding/removing teams or changing groups
   after a draw. Names, logos and player photos remain editable without resetting.

Each mode has independent teams, groups, draw and results. Public updates are polled
every three seconds while the page is visible. Unchanged replies omit photos/state.
For a two-team final there is no third-place team.

## Deployment and verification

`supabase/rock-wow-setup.sql` is additive to existing site tables. It creates one new
WOW table, owner write RPC and public read RPC. Raw table access is revoked for
anonymous/authenticated visitors; server write checks require the existing owner's
authenticated JWT. Scheduled orders remain private until each reveal time. Revision
checks reject stale saves from another owner session. Running setup again retains data.

Before deployment, apply SQL to the existing Supabase project, then run:

```
node tests/wow-core.cjs
node --check rock-wow.js
node --check rock-wow-core.js
```

`tests/wow-database.sql` runs in Supabase SQL Editor. It tests permissions, revision
conflicts, scheduled/manual draws, unchanged polling and qualifiers inside a transaction
and rolls back all sample state. Run it before real events, with no concurrent owner edits.

Browser QA covers the real site's new tab and public connection, and the owner editor
using an isolated local fixture. No QA teams are kept in the production database.

## Backup / rollback

Original source commit: `ed1819bed775af7c27b8bcef34e3c5a9669f4713`.
GitHub backup branch: `backup/before-wow-2026-11-05`.
The original 18.5 MB index is backed up separately by the implementation chat.
Only three asset references were appended to `index.html`, verified byte-for-byte
against its backup with those references removed. New UI/navigation are inserted by
`rock-wow.js`; CSS is scoped to the new section. The uploaded ROCK logo is preserved
as `assets/rock-wow-logo.jpg`.

To hide the feature, remove its three asset references from the page. Keep the WOW
database data for recovery. No existing table needs changing for rollback.
