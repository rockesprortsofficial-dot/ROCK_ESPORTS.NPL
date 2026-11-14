# LIVE BROADCAST — implementation and activation status

Adds one navigation item named exactly **LIVE BROADCAST**. `index.html` is unchanged. An additive bootstrap at the end of the existing Classic group addon loads the new stylesheet and six isolated scripts. All existing website content, branding, navigation and feature logic is preserved; the original Classic addon content is retained verbatim before its new bootstrap. Activation was explicitly authorized by the owner. On 15 November 2026 (Asia/Tokyo), the broadcast-only foundation/studio SQL and the new rock-broadcast-studio function were activated. Existing LiveKit meeting services are unchanged. Website release is tracked in PR #10. No real studio session, public video stream, YouTube/TikTok stream or notification was started.

## Working locally

- Reference-inspired red, blue and cyan neon broadcast layout; eight team cards on each side on desktop/landscape, 64 individual portrait/name/health/status/kill slots without clicking a team. Mobile portrait puts gameplay above two team columns; scrolling is expected, not simultaneous readability of 64 tiny faces on a phone.
- Large gameplay preview, two host frames, animated monitoring ring, status legend, top-four public ranking, match info and statistics. All 16 ranks appear in the owner results panel. Ended match mode expands host frames.
- Owner dashboard gated with the existing owner login identity. Backend SQL enforces ownership using an allowlisted verified account UUID, independently of UI visibility.
- Registered Classic team picker: refresh/search existing and newly arriving registrations; explicitly select a team for A1–A16. Imports the team logo, four real portraits, PUBG names and private real names. Images are converted to small embedded WebP assets, not expiring signed URLs. Duplicate registration selection is blocked. Publishing deliberately makes selected portraits public; organizer must confirm consent.
- Manual team/player corrections, portrait replacement, health, knock/out/revive via status changes, kills, placement and player slot swaps. Registration and group source records are never modified.
- Published Classic group-name/logo import only when an explicitly matched group contains 16 teams. Existing eight-team groups are preserved; the registered-team picker assembles a 16-team match roster independently.
- PMWC 10/6/5/4/3/2/1/1, zero for 9–16, +1 per player elimination. Totals and ranking recalculate from owner data. Provisional tie order: total points, eliminations, placement, stable slot. Tournament-specific tie rules still need confirmation.
- Owner results design follows the supplied results reference: history sidebar, match header/winner, all 16 rankings, selectable four-player details, summary, verify/correction/export controls. Final snapshots are append-only; corrections require a reason. Overall tournament ranking counts the newest verified revision of each match/group once.
- Native Excel (.xlsx) export with a 16-team results sheet and 64-player details sheet, CSV, private JSON backup and browser Print/Save PDF. XLSX ZIP/CRC/XML, Unicode and formula-like text handling are tested. Server backup scheduling is not configured.
- Separate broadcast header and monitoring name/logo preview, upload, publish and restore-last-published. PNG/JPEG/WebP up to 2 MB input, resized to 256 px. No generated replacement logo. Original site branding remains unchanged. Host 1 and Host 2 also have independent neon/blue/gold/clean frame themes, an uploaded frame backdrop, brightness, contrast and framing zoom. These appear in the outgoing canvas. This frames the real camera; it does not perform person segmentation or remove the physical room background. SVG and advanced logo transforms remain deferred.
- Optional non-obstructive promotion area below gameplay: every 900 seconds from match start, shown for 34 seconds; editable HTTPS links, off by default. No fake official links.
- Local screen/camera previews with cleanup. Screen requests up to 1080p/60; actual resolution, frame rate and system audio depend on browser/OS. No recording.
- Game/system audio plus owner mic and remote co-host mix for composed output. Private studio publishes separate raw game/microphone tracks and subscribes only to remote hosts, providing mix-minus without intentionally returning a host’s own mic. Independent game/owner mic volumes, level meter, mic/camera toggles and optional headphone sound check. Echo cancellation/noise suppression are requested; monitoring defaults off. Only game-tab/window audio should be captured: whole-system audio can capture host playback and reintroduce echo outside the routing graph. The new server function is deployed; physical two-device verification still requires an owner studio session.

## Backend activation required

Review and test `supabase/rock-live-broadcast.sql`, and `supabase/rock-broadcast-studio.sql`, then separately authorize applying them to the intended project. It creates only broadcast-specific tables/functions/policies. It resolves the existing **verified** owner account once; if absent, operations remain denied until an authorized database administrator allowlists the correct UUID. Existing project policies are untouched.

Public visitors read only the current sanitized snapshot. Owner history has no public read, update or delete permissions. Publishing uses an optimistic revision check to reject stale writes. Public projection omits real names, PUBG UID, contacts, registration storage paths and private match history. Public refresh polls every 30 seconds; ranking recalculates immediately after each explicit owner publish. This is not a telemetry-driven realtime service.

Draft edits live in memory until published or saved as a verified result. Refresh/closing the page loses unsaved edits. History currently loads the newest 100 saved revisions. Public snapshots are not a substitute for private history backup. Match history storage is now enabled in production after authorization; no demo results were inserted.

## Streaming implementation ready for staged activation

The new `rock-broadcast-studio` Edge Function and browser adapter implement a dedicated two-host private studio, a separate public output room, owner-only control, high-entropy co-host ID/password invitations, owner revocation with private-room rotation (old tokens cannot access future host media), 60-second scoped join tokens, read-only viewers, start/pause/stop and server-side YouTube/TikTok RTMP egress. Existing meeting rooms/functions are not reused or changed. Platform stream URLs/keys remain server-only. Duplicate simulcast requests are guarded by an atomic state claim. Stop failures are reported for retry, and local output is disconnected even if a stop request fails.

The outgoing 1920×1080 canvas includes gameplay, both host cameras, all 64 player portraits/status, PMWC ranking, owner branding and promotions. Static graphics/images are cached; video redraw defaults to 30 FPS, with an optional 60 FPS output setting for capable devices/connections. Host camera settings and game audio must be selected correctly. Keep the broadcaster tab visible: background-tab canvas throttling, network, device/GPU and platform transcoding can affect smoothness and latency. There is no claim of zero latency, guaranteed 60 FPS or zero acoustic echo.

The new server function is deployed using existing project-level LiveKit configuration. Its status endpoint returned HTTP 200/offline, unauthenticated studio creation returned 403, and anonymous private results/studio reads were denied. Actual LiveKit room/egress availability and platform permissions still require an owner session test. No real stream was started. Local tests cover role grants, invitation security, API authorization/start/stop/revoke, outgoing track routing, own-mic exclusion, remote co-host mix, native browser canvas/audio and mocked LiveKit calls. They do not prove real Internet transport performance. A private/unlisted end-to-end test on two physical devices plus a separate viewer is required after activation.

ROCK MONITORING currently shows owner-entered status and computed scores. Automatic health/knock/revive detection, kill attribution, automatic elimination placement, kill feed, damage, survival, circle timeline, MVP and replay need authorized reliable game telemetry or an explicitly validated spectator-data integration. Unknown values display `—`, never invented metrics. No fake viewer count or LIVE video badge is shown.

## 22-point plan coverage

| Plan | This phase |
|---|---|
| 1 Browser broadcasting | Preview + 1080p composed-output publisher implemented; deployment/testing pending |
| 2 Multi-platform | Server-only YouTube/TikTok egress code; keys/permissions and activation pending |
| 3 Classic registrations | Owner refresh/search/select, four portraits, UID privacy |
| 4 Groups | Safe 16-team import; existing 8-team groups retained |
| 5–6 Team/player layout | 16 × 4 individual visible slots; responsive |
| 7 Health/status | Manual corrections and status rendering; no game detection |
| 8–9 Graphics/gameplay priority | Reference-inspired neon structure, no gameplay overlays |
| 10 Monitoring | Manual source clearly labeled; automatic monitoring pending |
| 11 Monitoring ring | Animated ring with owner branding, reduced-motion support |
| 12 Two hosts | Separate private studio, invitations, camera/mic routing and mix-minus; physical test pending |
| 13 Host switching | Ended-match layout expands host frames |
| 14 Team/player editing | Names/logos/photos/status/kills/placement/swaps in private draft |
| 15 Statistics | Computed from manual player data; unknown telemetry stays blank |
| 16 Verification | Required placements, private final snapshots and correction reasons |
| 17 Promotions | 15-minute / 34-second timer below gameplay, owner links/toggle |
| 18 Protection | Existing auth + new backend owner allowlist; no production changes |
| 19 History | Private immutable snapshots, latest-correction overall, XLSX/CSV/JSON/print |
| 20 PMWC | Exact agreed points and elimination calculation |
| 21 Ranking | Automatic calculation on manual publish; provisional tie policy |
| 22 Branding | Separate preview/upload/publish/restore; advanced transforms deferred |

## Validation

`node tests/broadcast-core.cjs` checks exact scoring, ranking, all 64 slots, privacy projection, invalid placements/status and exact promotion boundaries, plus cumulative correction deduplication.

`node tests/broadcast-browser.cjs` uses Playwright and a mocked backend. Serve repository locally and set `BROADCAST_TEST_URL` to its origin. It tests old navigation preservation, 16×4 DOM slots, registered/new registration selection, branding preview versus publish, final validation, history/detail selection, desktop/landscape/mobile overflow, and logout cleanup. Screenshots contain synthetic test data, not real tournament results.

`node tests/broadcast-audio.cjs` uses synthetic game sound and browser fake microphones, not user hardware. Confirms mixing, individual gain controls, default monitoring off and cleanup. It cannot establish real remote echo or stream quality. `broadcast-studio.cjs` adds mocked-SDK track routing, native 1080p canvas capture/cache and output cleanup checks; `broadcast-studio-service.cjs` verifies the server handler with mocked database/LiveKit services; `broadcast-studio-policy.cjs` checks isolated role grants and invitation hashing. `broadcast-export.cjs` plus `broadcast-export.py` independently inspect native XLSX ZIP/CRC/XML output.

`node tests/broadcast-database.cjs` uses local PGlite (`PGLITE_PATH` optional) to test the SQL, anonymous/non-owner access denial, owner publication, stale revision rejection, private field rejection and append-only private history. Local test suites do not access production; separate authorized production checks used only public status and anonymous-access denial tests.

Existing Classic group browser regression is also run against the modified full page using `tests/run-existing-regression.cjs`; original test source is not changed.

## Operator setup and end-to-end checks

1. Review/apply `supabase/rock-live-broadcast.sql`, then `supabase/rock-broadcast-studio.sql` to the intended project. Both passed local Postgres/PGlite checks and were applied after explicit owner approval. Confirm the verified owner UUID is correctly allowlisted.
2. Deploy only the new `rock-broadcast-studio` function; `verify_jwt=false` is intentional for public viewers/co-host invitations. Owner actions separately verify Supabase user JWT and the database owner allowlist. Do not change existing meeting/token functions.
3. Confirm existing server secrets `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` and Supabase defaults. For platforms configure `BROADCAST_YOUTUBE_RTMP_URL` and/or `BROADCAST_TIKTOK_RTMP_URL` using each platform’s approved RTMP destination/key, never chat or frontend fields.
4. Website activation was explicitly authorized. PR #10 tracks the website merge/Pages release; its current GitHub status is authoritative.
5. In Owner Dashboard publish real roster/branding, create studio, share its invitation privately, connect owner/co-host and select game-only sound. Verify both hosts hear one another once, own mic is absent from return, camera themes appear, and no clipping/echo is heard.
6. Start website output, verify from a separate viewer, then explicitly select/start platform streams. Test pause/end/reconnect and confirm platform dashboards stop. No automatic notification is sent.

Still deferred: automatic authorized game telemetry/kill feed/circle/damage/MVP/replay, person-segmentation backgrounds, advanced logo transforms, durable private draft storage, history pagination beyond 100 revisions and automated server backup jobs. Existing drafts remain in memory until explicitly published or saved as a verified result. Final history is private and append-only after database activation.

Host video orientation is intentionally unmirrored in preview and composed output. The pipeline does not apply `scaleX(-1)` or a horizontal canvas flip. An asymmetric red-left/blue-right native video test checks the outgoing pixels, and the browser test checks a positive preview transform. Camera-driver/source transformations outside the website still require physical-device verification.


USB webcams: Owner and co-host both have camera selectors and Refresh buttons. Browser `enumerateDevices` lists USB and built-in video inputs; a selected device is requested explicitly by device ID at an ideal 1280×720/30 FPS. Device-change refresh and unplug/reconnect handling are included. Camera switching requests `audio:false` and preserves the active microphone. New camera access is cancelled if the studio/page is stopped while permission is pending. Labels appear after browser permission; USB camera/driver/OS/browser support and permissions must still be verified on the physical PC/laptop. Synthetic browser tests cover discovery, exact selection, unplug, reconnect and microphone preservation. No device IDs are published in the scoreboard or stored in server branding.

Production activation checks: one verified owner allowlisted; one empty public snapshot slot; zero saved demo matches and zero studios. Existing advisory warnings were not changed. New no-policy INFO notices on the server-only studio table/private allowlist reflect intentional default-deny access. No private data was made public.
