# Third-party notices and asset provenance

Alchemy’s original code and content use the license described in
[LICENSE.md](./LICENSE.md). Third-party software and content retain their own
licenses; nothing in the Alchemy license overrides those terms.

The current asset register contains unresolved release blockers. Do not treat
this document's presence as clearance for public distribution.

## Software dependencies

Runtime and development dependencies are declared in `package.json` and locked
in `package-lock.json`. Their package metadata and included license files are
the authoritative notices for those distributions. Packaged desktop builds
must preserve notices required by Electron, Chromium, Node.js, Steamworks, and
other bundled dependencies.

## Afterglow CRT

The CRT screen overlays adapt the scanline and glass styling and preset values
from [Afterglow CRT](https://github.com/HauntedCrusader/afterglow-crt),
Copyright (c) 2026 HauntedCrusader, under the MIT license. The full notice is
preserved in [public/licenses/afterglow-crt.txt](./public/licenses/afterglow-crt.txt)
and copied into web and desktop builds.

## Asset provenance register

Every third-party art, audio, music, or font source must be recorded before a
public release. Keep one row per source pack or licensor and link the local
license or receipt when redistribution terms are not public.

| Asset group                                          | Source / licensor                                                         | License or permission                                    | Attribution required    | Local evidence                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Original Alchemy code, documentation, and visual art | Ryan McIntire                                                             | CC BY-NC 4.0                                             | Yes                     | [LICENSE.md](./LICENSE.md); project owner confirms all artwork is original                                      |
| Inter font (`public/fonts/Inter.woff2`)              | [The Inter Project Authors](https://github.com/rsms/inter/tree/66647c0bb) | SIL Open Font License 1.1                                | Preserve license notice | [Local license copy](./public/licenses/inter-ofl.txt)                                                           |
| Registered and curated game sound effects            | Source packs under `Raw Assets/Sound Effects/`                            | Project owner states CC0 packs; exact sources unverified | Unknown                 | Pack names and license records unavailable — release blocker                                                    |
| Thirteen Suno-generated music tracks                 | [Track links below](#music-source-links)                                  | Account entitlement at creation/download not verified    | Review applicable terms | Embedded song IDs and creation dates; private subscription/download evidence not yet recorded — release blocker |

Files whose provenance is not represented above are not cleared for public
distribution merely because they exist under `Raw Assets/`, `public/`, or
`src/assets/optimized/`. Add the applicable row and preserve its evidence before
shipping. Secrets, purchase receipts, and private license keys must not be
committed; record a stable private evidence location instead.

The Inter WOFF2 name table identifies version 4.001 and project commit
`66647c0bb`; the local license copy matches that revision.

The current game sound registry has 40 generated sources and 12 curated OGGs.
The project owner states the sounds came from [CC0](https://creativecommons.org/publicdomain/zero/1.0/)
free-use packs, but does not have the pack names or license records. Seven
registered WAVs have an embedded `Pixel Combat` album tag; that tag alone does
not establish a license. Identify the source packs and their CC0 notices before
clearing the sound effects for distribution.

### Music source links

Every MP3 under `Raw Assets/Music/` embeds a Suno song URL, a creator account,
and a creation timestamp. These links identify the source but do not
prove the account's rights for game distribution. Record private evidence of the
applicable plan and download rights before clearing these tracks for release;
[Suno's terms](https://suno.com/terms) and [rights guidance](https://help.suno.com/en/articles/2416769)
distinguish account tiers and creation circumstances.

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
5. Confirm source-specific permissions for processed sounds and retain the
   Suno account/download evidence that applies to each music track.

An incomplete provenance record is a release blocker.
