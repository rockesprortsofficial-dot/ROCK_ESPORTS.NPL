# LIVE BROADCAST — safe implementation phase

Adds one navigation item named exactly **LIVE BROADCAST**. `index.html` is unchanged. An additive bootstrap at the end of the existing Classic group addon loads the new stylesheet and three isolated scripts. All existing website content, branding, navigation and feature logic is preserved; the original Classic addon content is retained verbatim before its new bootstrap. No deployment, production database change, streaming connection or notification is performed.

## Working locally

- Reference-inspired red, blue and cyan neon broadcast layout; eight team cards on each side on desktop/landscape, 64 individual portrait/name/health/status/kill slots without clicking a team. Mobile portrait puts gameplay above two team columns; scrolling is expected, not simultaneous readability of 64 tiny faces on a phone.
- Large gameplay preview, two host frames, animated monitoring ring, status legend, top-four public ranking, match info and statistics. All 16 ranks appear in the owner results panel. Ended match mode expands host frames.
- Owner dashboard gated with the existing owner login identity. Backend SQL enforces ownership using an allowlisted verified account UUID, independently of UI visibility.
- Registered Classic team picker: refresh/search existing and newly arriving registrations; explicitly select a team for A1–A16. Imports the team logo, four real portraits, PUBG names and private real names. Images are converted to small embedded WebP assets, not expiring signed URLs. Duplicate registration selection is blocked. Publishing deliberately makes selected portraits public; organizer must confirm consent.
- Manual team/player corrections, portrait replacement, health, knock/out/revive via status changes, kills, placement and player slot swaps. Registration and group source records are never modified.
- Published Classic group-name/logo import only when an explicitly matched group contains 16 teams. Existing eight-team groups are preserved; the registered-team picker assembles a 16-team match roster independently.
- PMWC 10/6/5/4/3/2/1/1, zero for 9–16, +1 per player elimination. Totals and ranking recalculate from owner data. Provisional tie order: total points, eliminations, placement, stable slot. Tournament-specific tie rules still need confirmation.
- Owner results design follows the supplied results reference: history sidebar, match header/winner, all 16 rankings, selectable four-player details, summary, verify/correction/export controls. Final snapshots are append-only; corrections require a reason. Overall tournament ranking counts the newest verified revision of each match/group once.
- CSV export (Excel compatible), private JSON backup and browser Print/Save PDF. No native XLSX export or server backup scheduler in this phase.
- Separate broadcast header and monitoring name/logo preview, upload, publish and restore-last-published. PNG/JPEG/WebP up to 2 MB input, resized to 256 px. No generated replacement logo. Original site branding remains unchanged. SVG and logo size/position controls are deferred.
- Optional non-obstructive promotion area below gameplay: every 900 seconds from match start, shown for 34 seconds; editable HTTPS links, off by default. No fake official links.
- Local screen/camera previews with cleanup. Screen requests up to 1080p/60; actual resolution, frame rate and system audio depend on browser/OS. No recording.
- Local game/system audio plus microphone mixer, independent volumes, mixed audio track, level indicator and optional headphone monitoring. Echo cancellation/noise suppression requested for mic. Monitoring defaults off. Audio is not transmitted remotely in this phase.

## Backend activation required

Review and test `supabase/rock-live-broadcast.sql`, then separately authorize applying it to the intended project. It creates only broadcast-specific tables/functions/policies. It resolves the existing **verified** owner account once; if absent, operations remain denied until an authorized database administrator allowlists the correct UUID. Existing project policies are untouched.

Public visitors read only the current sanitized snapshot. Owner history has no public read, update or delete permissions. Publishing uses an optimistic revision check to reject stale writes. Public projection omits real names, PUBG UID, contacts, registration storage paths and private match history. Public refresh polls every 30 seconds; ranking recalculates immediately after each explicit owner publish. This is not a telemetry-driven realtime service.

Draft edits live in memory until published or saved as a verified result. Refresh/closing the page loses unsaved edits. History currently loads the newest 100 saved revisions. Public snapshots are not a substitute for private history backup. Match history storage is ready for reviewed setup but has not been enabled in production.

## External integrations — not implemented or claimed live

Real public video delivery, YouTube/TikTok simulcast, stream pause/stop, compositor output, bitrate/adaptive delivery, remote owner/co-host camera/microphone connection and room access control require a streaming/WebRTC backend and platform permissions. Existing meeting-room code was inspected but is unchanged; there is no new public access to private meetings.

Both hosts must receive a **mix-minus** audio feed: remote host plus game audio, excluding their own microphone. The outgoing broadcast needs game + both host microphones. The local mixer is a foundation, not this remote routing implementation. Test on two physical clients with headphones, actual game sound, and private/unlisted website/YouTube/TikTok streams. Echo cancellation is a browser request, not a guarantee of zero echo; avoid doubling audio from a shared tab and another microphone/speaker path. Verify clipping, game/mic balance, sync and disconnect/reconnect before going live.

ROCK MONITORING currently shows owner-entered status and computed scores. Automatic health/knock/revive detection, kill attribution, automatic elimination placement, kill feed, damage, survival, circle timeline, MVP and replay need authorized reliable game telemetry or an explicitly validated spectator-data integration. Unknown values display `—`, never invented metrics. No fake viewer count or LIVE video badge is shown.

## 22-point plan coverage

| Plan | This phase |
|---|---|
| 1 Browser broadcasting | Local screen/camera/audio preview; remote broadcast pending |
| 2 Multi-platform | Not connected; backend/platform credentials required |
| 3 Classic registrations | Owner refresh/search/select, four portraits, UID privacy |
| 4 Groups | Safe 16-team import; existing 8-team groups retained |
| 5–6 Team/player layout | 16 × 4 individual visible slots; responsive |
| 7 Health/status | Manual corrections and status rendering; no game detection |
| 8–9 Graphics/gameplay priority | Reference-inspired neon structure, no gameplay overlays |
| 10 Monitoring | Manual source clearly labeled; automatic monitoring pending |
| 11 Monitoring ring | Animated ring with owner branding, reduced-motion support |
| 12 Two hosts | Frames plus local owner preview; remote co-host pending |
| 13 Host switching | Ended-match layout expands host frames |
| 14 Team/player editing | Names/logos/photos/status/kills/placement/swaps in private draft |
| 15 Statistics | Computed from manual player data; unknown telemetry stays blank |
| 16 Verification | Required placements, private final snapshots and correction reasons |
| 17 Promotions | 15-minute / 34-second timer below gameplay, owner links/toggle |
| 18 Protection | Existing auth + new backend owner allowlist; no production changes |
| 19 History | Private immutable snapshots, latest-correction overall, CSV/JSON/print |
| 20 PMWC | Exact agreed points and elimination calculation |
| 21 Ranking | Automatic calculation on manual publish; provisional tie policy |
| 22 Branding | Separate preview/upload/publish/restore; advanced transforms deferred |

## Validation

`node tests/broadcast-core.cjs` checks exact scoring, ranking, all 64 slots, privacy projection, invalid placements/status and exact promotion boundaries, plus cumulative correction deduplication.

`node tests/broadcast-browser.cjs` uses Playwright and a mocked backend. Serve repository locally and set `BROADCAST_TEST_URL` to its origin. It tests old navigation preservation, 16×4 DOM slots, registered/new registration selection, branding preview versus publish, final validation, history/detail selection, desktop/landscape/mobile overflow, and logout cleanup. Screenshots contain synthetic test data, not real tournament results.

`node tests/broadcast-audio.cjs` uses synthetic game sound and browser fake microphones, not user hardware. Confirms mixing, individual gain controls, default monitoring off and cleanup. It cannot establish real remote echo or stream quality.

`node tests/broadcast-database.cjs` uses local PGlite (`PGLITE_PATH` optional) to test the SQL, anonymous/non-owner access denial, owner publication, stale revision rejection, private field rejection and append-only private history. No production access.

Existing Classic group browser regression is also run against the modified full page using `tests/run-existing-regression.cjs`; original test source is not changed.
