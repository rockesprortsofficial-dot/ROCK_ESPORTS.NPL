# TDM neon tournament changes

Only TDM Group Division and Live Draw are changed. Site name, logo, navigation, WOW, community, registration, calls, notifications and other modules are preserved. `index.html` differs from the inspected commit only by one TDM script include.

## Final rules (latest reference supplied by owner)

| Players | Groups | Per group | Total matches |
|---|---|---|---|
| 8 | A–D | 2 | 12 |
| 16 | A–D | 4 | 24 |
| 24 | A–F | 4 | 36 |
| 32 | A–H | 4 | 48 |

Initial matches stay within their assigned group. After that, eligible players from different groups may meet in their winner/loser routes, as explicitly confirmed by the owner. The last two winner-route match winners play the Grand Final (#1/#2). Those two matches' losers play for #3. The loser of that third-place match plays the loser-route champion for #4. All first-round losers play again in the loser route. Earlier winner-route losses and subsequent loser-route losses eliminate players. For 24 players, four byes per route are fixed by the initial random draw to reduce 12 entrants to 8; every entrant remains represented.

The latest detailed loser-rematch reference supersedes the earlier image that directly assigned #3/#4 to the first-round losers' route.

## Files changed

- `index.html`: one script include immediately before the final body close; no existing bytes removed or rewritten.
- `rock-tdm.js`: TDM-specific graph, archive, draw controls, per-player winner checkboxes, confirmed results, profiles and public read-only display.
- `rock-tdm.css`: scoped neon design and responsive presentation.
- `supabase/rock-tdm-setup.sql`: additive tables and owner-checked RPCs, persisted graph, snapshots, revision locks and scheduled reveals.
- `tests/tdm-database.cjs`: PostgreSQL/PGlite progression, permission, history and deletion tests.
- `tests/tdm-browser.cjs`: browser interaction with real local PostgreSQL RPCs, owner checkmarks, public winner display, portraits/logos, responsive rendering.
- `TDM-TOURNAMENTS.md`: this document.

## Storage and authorization

New tournaments use `rock_tdm_tournaments` with a unique UUID, revision and state. State contains original creation date, immutable participant/photo/logo snapshots, initial random order, complete bracket edges, every draw, confirmed scores, results and untruncated events. Creating a tournament inserts a new row. It never replaces another tournament.

Anonymous and authenticated clients have no direct table permissions. Public RPCs read tournament data and apply already-scheduled server reveals. All discretionary actions go through `rock_tdm_owner`, which checks `auth.uid()` and the trusted JWT email `rockesprorts.official@gmail.com`. Match readiness, winner membership, scores, prior round draws and revision locks are enforced in PostgreSQL. Confirmed results cannot be replaced. Delete requires owner login, the current revision and exact tournament-ID confirmation. The interface additionally asks for confirmation and the word DELETE.

The setup copies the current original TDM draw into `rock_tdm_legacy_snapshots` without changing the shared `rock_esports_live_draw` table, policies or data. Legacy snapshots appear as read-only historical records. Their original routes/results are not reinterpreted as new-format tournaments. Existing historical data already overwritten before this change cannot be recovered from the current row alone.

The initial shuffled roster automatically creates within-group match pairs; no manual opponent entry is required. Live Draw displays explicit player-versus-player match cards and Group Division displays the same pairings. Confirmed winner/loser routes automatically resolve later opponents.

A new round cannot be drawn until every already-published match is confirmed. Repeated draws during an unfinished round are rejected by PostgreSQL; the next-round button is also disabled.

New rounds append draw records under the same tournament ID. Their pairings follow persisted bracket routes; they never reshuffle confirmed matches. Scheduled reveal uses the server's timestamp and is materialized when the public list is read, so no owner browser needs to remain open. Public refresh is every eight seconds.

## Validation

Tests execute the SQL against an isolated PostgreSQL engine (PGlite), not the production database. Twelve complete tournaments (three per size) verified all 12/24/36/48 matches, group-only initial pairings, loser rematches, distinct top four, every eliminated player, photos/logos, immutable dates/results/draws, server scheduled reveal and retained prior tournaments. Anonymous and other-account writes/deletes fail; a correctly confirmed owner deletion succeeds. SQL setup also runs twice to verify repeatability.

Browser checks use Chromium/Chrome, the actual TDM code and local PostgreSQL RPCs at widths 1536 and 390. They verify one winner checkbox per player, exclusive winner selection, score confirmation, public ✓ WIN, no public editing, all matches, player images, retained unsaved input during polling and no horizontal page overflow. The actual repository index was also loaded with external services replaced by local read-only fixtures to check CSS/integration. These checks do not establish the production project's current grants, network behavior or live deployment state.

To run the database tests, install `@electric-sql/pglite` and point `TDM_PGLITE_PATH` to its package, or install it under the sibling `tdm-test-runtime/node_modules` directory. Browser tests additionally require `playwright`, `sharp` and Chrome. Test images and names are clearly marked TEST and are never sent to production.

## Release sequence — not executed

1. Review this diff and the sample screenshots. Back up the production project.
2. Run `supabase/rock-tdm-setup.sql` in the existing Supabase project's SQL Editor using project-owner access. This is additive; it does not alter other modules' policies.
3. Verify owner and visitor roles against the actual Supabase project.
4. After explicit release confirmation, merge/publish the website files and check the two TDM tabs on desktop and mobile.

No production SQL, tournament mutations, deletion, merge or deployment was executed during this work. The new code intentionally refuses to create a tournament when its required RPC setup is missing.

## Completed reset/delete and old-system removal

Only the new TDM Live Draw controls are shown. Obsolete live-draw modes, legacy public cards and their reset control are hidden. WOW code and data are untouched. Old snapshots remain protected in storage; an owner-only, twice-confirmed cleanup button can delete an old snapshot and clear the shared legacy row only when its exact ID/content hash still matches. A changed or non-TDM shared draw is preserved.

New tournaments cannot be reset or deleted before every bracket match has a confirmed result. After completion, Reset archives the tournament, keeps every result/draw/player image and clears the active selection/form for a fresh tournament. Archived results remain available in the selector. Delete removes only the selected completed tournament after owner confirmation. Both restrictions are enforced by PostgreSQL. The controls repaint after saving so they cannot remain accidentally disabled by the save-in-progress flag.
