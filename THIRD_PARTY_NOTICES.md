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

## Asset provenance register

Every third-party art, audio, music, or font source must be recorded before a
public release. Keep one row per source pack or licensor and link the local
license or receipt when redistribution terms are not public.

| Asset group               | Source / licensor                              | License or permission     | Attribution required    | Local evidence                                  |
| ------------------------- | ---------------------------------------------- | ------------------------- | ----------------------- | ----------------------------------------------- |
| Original Alchemy assets   | Ryan McIntire                                  | CC BY-NC 4.0              | Yes                     | [LICENSE.md](./LICENSE.md)                      |
| Inter font                | Rasmus Andersson / Inter contributors          | SIL Open Font License 1.1 | Preserve license notice | License copy not yet recorded — release blocker |
| Third-party sound effects | Source packs under `Raw Assets/Sound Effects/` | Not yet recorded          | Unknown                 | Provenance not yet recorded — release blocker   |
| Third-party music         | Sources under `Raw Assets/Music/`              | Not yet recorded          | Unknown                 | Provenance not yet recorded — release blocker   |
| Third-party visual art    | Non-original sources under `Raw Assets/`       | Not yet recorded          | Unknown                 | Provenance not yet recorded — release blocker   |

Files whose provenance is not represented above are not cleared for public
distribution merely because they exist under `Raw Assets/`, `public/`, or
`src/assets/optimized/`. Add the applicable row and preserve its evidence before
shipping. Secrets, purchase receipts, and private license keys must not be
committed; record a stable private evidence location instead.

## Release review

Before promoting a public build:

1. Compare new or changed raw assets with this register.
2. Confirm commercial redistribution is permitted for the intended storefront.
3. Add required in-game, store-page, or file-level attribution.
4. Verify packaged dependency notices remain present where their licenses
   require them.

An incomplete provenance record is a release blocker.
