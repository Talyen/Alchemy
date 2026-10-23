# Third-party notices and asset provenance

Alchemy’s original code and content use the license described in
[LICENSE.md](./LICENSE.md). Third-party software and content retain their own
licenses; nothing in the Alchemy license overrides those terms.

On October 23, 2026, Ryan McIntire confirmed that all original game content,
artwork, music and sound assets were created by him using AI tools, that the
applicable tools/accounts permitted commercial use at creation, and that no
third-party samples or source material were used. All AI content is prepared
during development; the game does not generate AI content during play. This
owner confirmation supersedes the earlier unresolved audio provenance notes.
Third-party fonts and software retain the notices below.

## Software dependencies

Runtime and development dependencies are declared in `package.json` and locked
in `package-lock.json`. Their package metadata and included license files are
the authoritative notices for those distributions. Packaged desktop builds
must preserve notices required by Electron, Chromium, Node.js, Steamworks, and
other bundled dependencies.

## Afterglow CRT

The former CRT screen overlays adapted the scanline and glass styling and preset values
from [Afterglow CRT](https://github.com/HauntedCrusader/afterglow-crt),
Copyright (c) 2026 HauntedCrusader, under the MIT license. The full notice is
preserved in [public/licenses/afterglow-crt.txt](./public/licenses/afterglow-crt.txt)
and copied into web and desktop builds. The CRT renderer and Screen Effects
option have been removed; this notice retains the attribution for that earlier work.

## Asset provenance register

Every third-party art, audio, music, or font source must be recorded before a
public release. Keep one row per source pack or licensor and link the local
license or receipt when redistribution terms are not public.

| Asset group                                          | Source / licensor                                                                | License or permission                                      | Attribution required                         | Local evidence                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Original Alchemy code, documentation, and visual art | Ryan McIntire                                                                    | CC BY-NC 4.0                                               | Yes                                          | [LICENSE.md](./LICENSE.md); Owner confirmation above; artwork created using AI                       |
| Inter font (`public/fonts/Inter.woff2`)              | [The Inter Project Authors](https://github.com/rsms/inter/tree/66647c0bb)        | SIL Open Font License 1.1                                  | Preserve license notice                      | [Local license copy](./public/licenses/inter-ofl.txt)                                                |
| Noto Sans SC (`public/fonts/noto-sans-sc.ttf`)       | [Noto Sans SC authors](https://github.com/google/fonts/tree/main/ofl/notosanssc) | SIL Open Font License 1.1; catalog subset of variable font | Preserve license notice                      | [Local license copy](./public/licenses/noto-sans-sc-ofl.txt)                                         |
| Noto Sans (`public/fonts/noto-sans.ttf`)             | [Noto Sans authors](https://github.com/google/fonts/tree/main/ofl/notosans)      | SIL Open Font License 1.1; catalog subset of variable font | Preserve license notice                      | [Local license copy](./public/licenses/noto-sans-ofl.txt)                                            |
| Registered and curated game sound effects            | Sources listed by the [sound asset registry](./scripts/assets/sound-assets.mjs)  | Owner-created using AI; commercial use confirmed           | No third-party source attribution identified | [Approved source ledger](./Docs/design/audio-review/approved-choices.json); Owner confirmation above |
| Thirteen Suno-generated music tracks                 | [Track links below](#music-source-links)                                         | Commercial-use entitlement at creation confirmed           | No third-party source attribution identified | Owner confirmation above; embedded song IDs and creation dates                                       |

Files whose provenance is not represented above are not cleared for public
distribution merely because they exist in the external Asset Library, `public/`,
or `src/assets/optimized/`. Add the applicable row and preserve its evidence before
shipping. Secrets, purchase receipts, and private license keys must not be
committed; record a stable private evidence location instead.

The Inter WOFF2 name table identifies version 4.001 and project commit
`66647c0bb`; the local license copy matches that revision.

The [sound asset registry](./scripts/assets/sound-assets.mjs) and
[approved cue mappings](./Docs/design/audio-review/approved-choices.json) retain
source paths, hashes and excerpt boundaries for processing and listening review.
Those technical records do not imply third-party ownership; the owner confirmation
above establishes the supplied source and commercial-use history.

### Music source links

The thirteen selected music masters in the external Asset Library, listed by
[`music-assets.mjs`](./scripts/assets/music-assets.mjs), embed a Suno song URL,
a creator account, and a creation timestamp. Prepared copies ship in `public/Music/`.
These links retain source traceability; the commercial-use confirmation above
covers the selected tracks.

| Local track             | Embedded source                                                         |
| ----------------------- | ----------------------------------------------------------------------- |
| `Battle 1.mp3`          | [Suno song](https://suno.com/song/d0104fa8-abc9-4d82-b1fd-e032313684b6) |
| `Battle 2.mp3`          | [Suno song](https://suno.com/song/588cd1f3-2984-476f-b6c4-2a7ad0317e3c) |
| `Battle 3.mp3`          | [Suno song](https://suno.com/song/99b91287-19d6-46c0-a686-98d0a5ff1188) |
| `Battle 4.mp3`          | [Suno song](https://suno.com/song/640c6881-690e-4818-b625-485213fc6c36) |
| `Battle 5.mp3`          | [Suno song](https://suno.com/song/b4eea5d8-88d5-41fd-a2dd-2b9fc872645e) |
| `Menu 1.mp3`            | [Suno song](https://suno.com/song/823cecec-5b96-4bf6-86f4-3c3dfa943379) |
| `Menu 2.mp3`            | [Suno song](https://suno.com/song/60c919cd-7d21-41d4-9215-b4e3cddabd04) |
| `Menu 3.mp3`            | [Suno song](https://suno.com/song/e6e503af-b130-42a8-9ec8-9765c6d6e7d9) |
| `Menu 4.mp3`            | [Suno song](https://suno.com/song/9adb2888-287e-4197-9446-0fd9e887b318) |
| `The Blight Treant.mp3` | [Suno song](https://suno.com/song/bc54dd77-7abe-4452-ac3b-e8bbfe596aff) |
| `The Forge Golem.mp3`   | [Suno song](https://suno.com/song/60848f6d-f340-4292-8f42-f37c05e2123a) |
| `The Frostwarden.mp3`   | [Suno song](https://suno.com/song/1267aaba-6058-4782-bef0-ee59d5978128) |
| `The Iron Bear.mp3`     | [Suno song](https://suno.com/song/b5c55082-0a7e-4067-b827-64791bc13275) |

## Release review

Before promoting a public build:

1. Compare new or changed raw assets with this register.
2. Confirm commercial redistribution is permitted for the intended storefront.
3. Add required in-game, store-page, or file-level attribution.
4. Verify packaged dependency notices remain present where their licenses
   require them.
5. Reconfirm commercial-use terms if new tools, account tiers or third-party
   source material are introduced; disclose shipped AI content in Steamworks.

The owner confirmation resolves the previously recorded audio-rights uncertainty.
New third-party sources still require their own permission and notices.
