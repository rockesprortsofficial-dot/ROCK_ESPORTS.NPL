# LIVE BROADCAST modes

The existing LIVE BROADCAST tab contains three inner tabs: TOURNAMENT, GAMEPLAY and MEMBERS WATCH PARTY. Existing Tournament state, manual scoring, registered-team selection and match history are not written by the new modes. The original index.html and existing Meeting Room backend are unchanged.

## Owner workflow

1. Use the existing owner login. Open LIVE BROADCAST and select GAMEPLAY or MEMBERS WATCH PARTY.
2. Click **Create / reconnect this mode**. A new session displays a private co-host invitation once; copy it privately. Reconnecting an existing session does not reveal its original invitation password. If it was lost, end that mode and create a new session.
3. Enable the camera and microphone, choosing the laptop/USB/headset devices. Connect a shared app/browser tab/screen, or choose the HDMI capture card and its audio input. Source, camera and microphone changes are sent to the private call automatically.
4. Other participants can already watch the shared source and talk inside the website call. YouTube/TikTok are not required.
5. Click **Start website output** to publish the composed screen for read-only visitors. This does not start a platform livestream.
6. Optional: select YouTube/TikTok, enter private RTMP server/key fields or use existing server destinations, then start selected platforms. Platform LIVE permission and available egress capacity remain necessary. These actions can use paid server capacity.

**Pause website output** stops public/platform output and keeps the private call. **End this mode & streams** stops that mode's call and output. Switching inner tabs stops the owner's local capture/output and leaves their call; it does not edit Tournament records or end other members' conversations. Calls expire after six hours.

## Existing members and co-host

Watch Party uses the existing ROCK ESPORTS Meeting Room login and active membership. It creates no new accounts and does not change member credentials or registration. Sign in in Meeting Room, close the Messenger overlay, return to Watch Party and choose **Join with Meeting Room login**. Enable camera/mic separately when ready. The join notice explains that names, camera and voice can appear in website and platform output.

The browser obtains only a copy of the current signed Meeting Room access token through an additive read-only bridge; remembered refresh/device secrets are not exposed. The server verifies the token signature, private-member grant, current active member record and remembered-device session where present. New active members are checked on each join rather than copied into a fixed roster. A Watch Party co-host needs both the private invitation and existing member login. Gameplay co-host uses its private invitation.

Owner can close/reopen new entries, mute participant audio and remove a member/co-host from the current session. Removed identities cannot get fresh admission tokens for that session. Member logout triggers local call cleanup; periodic call checks also validate active membership/device state. Signed heartbeat tickets cannot join/publish to a room and permit only renewal/own-call cleanup. The server rechecks membership; UI visibility is not authorization.

## Layout and visitors

Game/shared video remains the dominant screen area. Gameplay has two small host camera tiles and a circular monitoring logo. Watch Party adds every joined participant to an adaptive bottom grid; it shrinks/reflows as participants join and grows again when they leave. There is no fixed ten-person layout limit. All video uses original orientation; source video is contained without cropping. Existing published owner branding is reused.

Visitors receive a separate composed-output room with no publishing or data-message grant. They see no member/owner controls and never request camera/microphone. Sound is enabled through a playback button; the video controls govern combined incoming audio/video. Website output must be started by the owner before visitors can watch. Public mode links can use `?broadcastMode=gameplay#live-broadcast` or `?broadcastMode=watchparty#live-broadcast`.

## Capacity and verification limits

Default server admission capacity is 100 call participants including hosts, configurable for new rooms using `BROADCAST_SOCIAL_MAX_PARTICIPANTS` (guarded range 2–500). Actual account quotas, bandwidth and device decoding may impose lower practical limits. Layout was tested with up to 200 tiles; this is not a 200-device transport/load test or an unlimited-capacity promise.

The owner publishes only selected game sound to the call and their microphone separately. Remote voices are mixed once into public output. Game-only headphone monitoring excludes the owner's own microphone. Use headphones and keep call audio out of shared system/game sound. Real multi-device echo, latency, USB hardware and external platform delivery still need user/device testing. HDMI capture does not route a laptop mic into PUBG on an iPhone.

No sample sessions, member records, livestreams or notifications are started by deployment/tests. Private platform keys are submitted only for explicit owner actions, not persisted in public state or the application database. Runtime keys and account setup remain external requirements.
