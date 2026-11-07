# Marketing media

Rebuild: `npm run short:record` (films the live site, driven by the voice timeline in `marketing/short/narration.mjs`; writes `marketing/short/.work/`), then `npm run short:build`.
Default is the narrated version. Old music-only version: `npm run short:build -- --no-voice [--music "path/to/track.mp3"] [--music-start 12.5]`
(defaults live at the top of the no-voice branch in `marketing/short/build.mjs`).

Audio sources (read in place, never copied into the repo):
- Voiceover, three parts: `F:/Files/Music/My Music/song_exports/voice/v1.mp3` (intro), `v2.mp3` (middle), `v3.mp3` (end).
- Background music: `F:/Files/Music/My Music/song_exports/lofi_seville.mp3` (about 18 dB under the voice, ducked while talking).
Speech boundaries, transcript and cue times are in `narration.mjs`; edit them there if a voice file changes, then re-record and rebuild.

| File | Length | Spec | Captions |
|---|---|---|---|
| `video/synergy-wizard-short.mp4` | ~73.5 s | 1080x1920, 30 fps, H.264 + AAC 192k, -14 LUFS (two-pass loudnorm), real site footage, end card with logo + URL | Burned-in subtitles = the narration, lower part of the frame. End card: Free. Updated every patch. - poe2.90sgamer.com - a 90sGamer.com tool |

## YouTube

**Title:** Find any Path of Exile 2 skill by what it DOES (free tool) #Shorts

**Description:**
Need a quick way to find a PoE2 skill that complements your build? Just ask in plain words. Synergy Wizard searches every gem, support and passive by what it does, and is updated every patch. Free, and in beta - feedback welcome.
https://poe2.90sgamer.com/?utm_source=youtube&utm_medium=social&utm_campaign=short_launch

**Hashtags:** #PathOfExile2 #PoE2 #ARPG #GamingTools #Shorts

## How-to tutorial (search, hide words, save and share a list)

Rebuild from the live site: `npm run howto:record -- landscape` then `npm run howto:build -- landscape` (same with `vertical`).
Captions only, no voiceover; music is `lofi_seville.mp3` (read in place), -16 LUFS. Scripts: `marketing/tutorial/`.

| File | Length | Use |
|---|---|---|
| `video/synergy-wizard-howto-landscape.mp4` | ~50 s, 1920x1080 | YouTube video, help link on the site or 90sGamer page |
| `video/synergy-wizard-howto-vertical.mp4` | ~50 s, 1080x1920 | YouTube Shorts, TikTok, Instagram Reels |

**Title (landscape):** How to use Synergy Wizard: search PoE2 skills and uniques, save and share a list
**Title (vertical):** Find PoE2 skills and uniques by what they DO, then save and share your list #Shorts

**Description:**
Describe what your build needs in plain words and Synergy Wizard finds the Path of Exile 2 skill gems, supports, passives and uniques that do it. Hide what doesn't fit with a minus (-"energy shield"), star anything to save it to My list, and share the list with one link. Free, updated every patch.
https://poe2.90sgamer.com/?utm_source=youtube&utm_medium=social&utm_campaign=howto

**Hashtags:** #PathOfExile2 #PoE2 #ARPG #PoE2Builds
