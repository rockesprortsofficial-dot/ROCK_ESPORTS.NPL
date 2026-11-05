# Community ImageKit provider

Status: implementation prepared; requires an ImageKit Forever Free account, Supabase deployment, and real upload/playback validation before activation. Existing B2 posts are not migrated automatically.

## Setup

1. Use ImageKit's **Forever Free** plan. Do not add a payment method or upgrade. The published limits are 3 GB stored, 20 GB delivered per month, 25 MB per image and 100 MB per video. Limits may change; verify the account dashboard. This is not unlimited delivery.
2. Store the existing ImageKit public key, private key and URL endpoint **only in the Supabase Edge Function secrets**, named `ROCK_IMAGEKIT_PUBLIC_KEY`, `ROCK_IMAGEKIT_PRIVATE_KEY`, and `ROCK_IMAGEKIT_URL_ENDPOINT`. Endpoint format: `https://ik.imagekit.io/ACCOUNT_ID`. Never put the private key in browser JavaScript, GitHub, logs, a chat message, or this document.
3. Deploy `supabase/functions/rock-community-imagekit/` as a separate function. Keep `ROCK_IMAGEKIT_ENABLED` unset or `false` initially. No B2 function or B2 secret is changed.
4. Apply `supabase/rock-community-imagekit.sql` to add a unique index only for ImageKit media markers. No existing B2/Supabase records or table permissions change.
5. On a staging copy, temporarily enable the function and verify a real small image and video: direct signed upload, server metadata verification, post publication, guest playback, signed-link expiry/retry, deletion by author/admin, and rejected deletion by another member. Confirm the existing website origin is retained; do not expand CORS to wildcard. Disable immediately if any check fails.
6. Deploy both identical community feed entry files, then set `ROCK_IMAGEKIT_ENABLED=true` after validation. New uploads prefer ImageKit. Existing B2 and Supabase posts retain their original playback and deletion paths.

The frontend detects disabled/unavailable ImageKit config and retains its previous upload provider. Existing ImageKit posts can still be read when new ImageKit uploads are disabled, provided its keys remain configured.

## Security and behavior

- ImageKit Upload V2 signs the complete upload form with a one-use, 10-minute JWT. Folder, random filename, private visibility, overwrite prevention, MIME allowlist and size checks are bound to that signature. The private key remains server-side.
- Publication uses the user's Supabase identity and existing database permissions. It verifies the provider's metadata against the signed session before storing `ik:FILE_ID`. Private playback links are issued only for published posts and expire after one hour.
- No video transformation, AI operation, autoplay or looping is added. Native file playback is retained. MOV/codec compatibility depends on the browser; this change does not transcode videos.
- Storage preflight checks account-wide original file sizes with 200 MB headroom below the documented 3 GB free quota. This is best effort, not an atomic reservation or a complete accounting of revisions/derivatives. ImageKit's Free-plan enforcement remains the hard limit. Delivery still stops if the monthly allowance is exhausted.
- If an upload succeeds but publication fails, the file remains private in ImageKit. It is not automatically deleted after an ambiguous network failure. An administrator can review unposted files in the ImageKit dashboard before cleanup; this avoids deleting successfully published media on a timeout.
- Rollback: set `ROCK_IMAGEKIT_ENABLED=false`. Keep the function and its keys for existing ImageKit posts. Do not roll back to a frontend that cannot understand `ik:` markers after ImageKit posts exist.

## Local validation

Run from repository root:

```text
node --check rock-community-feed.js
node --check rock-community-feed-v2.js
node --check supabase/functions/rock-community-imagekit/index.ts
node tests/community-imagekit.cjs
node tests/community-provider.cjs
node tests/community-media.cjs
node tests/wow-core.cjs
git diff --check
```

Tests mock Supabase and ImageKit; they cannot replace real account validation. `index.html`, existing B2 backend, service worker, other tabs and authentication flow are untouched.

Sources: https://imagekit.io/plans/ ; https://imagekit.io/docs/api-reference/upload-file/upload-file-v2 ; https://imagekit.io/docs/media-delivery-basic-security
