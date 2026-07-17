# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

"Biosoft" is a tool for Biodanza facilitators to plan classes ("clases"): sequencing music tracks into exercises ("ejercicios"), grouping exercises, and playing them back with fade-in/fade-out, crossfade ("empalme"), clipped start/end, and repeat controls. The repo has two mostly-independent halves that share only the music-collection folder conventions:

1. **`UI/`** — the actual application. A single-page, offline-first AngularJS 1.x app (no server backend, no build step). It's distributed as a zip of static files and opened locally (`file://`) or hosted as a plain static site.
2. **.NET (`Biodanza.Model`, `Hyperlinks`, `HyperlinkTests`)** — Windows-only offline tooling used by the maintainer to prepare Excel-based music catalogs (adding playable hyperlinks to `.xls` files, matching catalog rows to actual audio files on disk). This is not part of the shipped app.

## UI app architecture (`UI/`)

Entry point is [UI/biosoft.html](UI/biosoft.html), which loads AngularJS + vendored libs (`app/scripts/vendor/`) and the app's own scripts in a fixed `<script>` order — there is no bundler/npm, so **new scripts must be added to `biosoft.html` manually in dependency order**.

- **Routing**: [UI/app/scripts/main.js](UI/app/scripts/main.js) defines `ngRoute` routes (`#/clases`, `#/ejercicios`, `#/musicas`, `#/cargarMusica`, `#/cargarEjercicios`, `#/clase/:id`, etc.), each backed by a controller in `app/scripts/controllers/` and an HTML partial (referenced by `templateUrl`, not present as separate files in this listing — check how partials are served before assuming a path).
- **Data model — no backend, no REST calls**. All app data lives in a global `db` object (`db.ejercicios`, `db.musicas`, `db.colecciones`, `db.grupos`) that is:
  - seeded once from static JS files in `UI/app/data/` (e.g. `ejercicios.js`, generated from SQL via [UI/app/data/generaDb.ps1](UI/app/data/generaDb.ps1), which is a one-off export script, not something run as part of normal dev),
  - then persisted/read from browser `localStorage` via `ngStorage` (keys like `ngStorage-biosoft_ejercicios`, `ngStorage-biosoft_musica_<coleccion>`) — see [UI/app/scripts/services/loaderService.js](UI/app/scripts/services/loaderService.js).
  - `loaderService` builds ad-hoc lookup indices by `eval`-ing dynamic property names (e.g. `db.ejercicios.x<id>`, `db.musicas.x<coleccion>_<cd>_<pista>`); when touching this file, preserve that indexing scheme rather than replacing it, since other services rely on the same key format.
- **Playback**: [UI/app/scripts/services/playerService.js](UI/app/scripts/services/playerService.js) drives a single hidden `<audio>` element, resolving each track's file path as `pathMusica + coleccion + carpeta + archivo` and layering timing features (crossfade, progressive volume in/out, auto-advance through a `clase`'s exercise list) on top of native HTML5 audio events.
- **Search/ranking**: `modelEjerciciosService` and `modelMusicaService` in [UI/app/scripts/services.js](UI/app/scripts/services.js) implement custom weighted-token search over exercises/music (accent-insensitive via `.normalize('NFD')`) rather than using a library — replicate that normalization approach if extending search.
- Music audio files themselves are **not** in this repo; they live in an external "coleccion" folder tree (see `UI/app/data` and the `.sql`/`.xlsx` catalog files) referenced by relative paths at runtime.

There is no test suite, linter, or build tool for the UI — it's plain JS/HTML/CSS. To try changes, open [UI/biosoft.html](UI/biosoft.html) directly in a browser (or serve `UI/` over any static file server) and exercise the relevant route.

## .NET solution (`Hyperlinks/Hyperlinks.sln`)

Old-style (.NET Framework 4.0, non-SDK-style `.csproj`, NuGet `packages.config`) solution with four projects:

- **`Biodanza.Model`** — shared library: EF6 `Entities` model (`Entities.edmx`) pointing at a local SQL Server DB (`BiodanzaEntities`, see [Biodanza.Model/App.config](Biodanza.Model/App.config), defaults to `data source=.;initial catalog=Biodanza`), plus standalone helpers that don't touch the DB: `BioCol` (reads/writes `.xls` catalogs via NPOI, adds file hyperlinks), `FileSearch` (matches a catalog's CD/track number to an actual audio file on disk using pattern files `FormatosArchivosMusica.txt`/`FormatosCarpetas.txt`), `ImportIBF` (importer for a different catalog source format).
- **`Hyperlinks`** — console app (`Program.cs`) wrapping `BioCol`: given an Excel workbook of a music collection, adds/removes clickable hyperlinks to the matching audio file in a given column. Run as `Hyperlinks.exe -p "<path>" -l <col> -n <col> -h "<sheet>"` (see `Parametros.cs` for all flags; `-a h` adds links, `-a x` removes them).
- **`HyperlinkTests`** — MSTest + FluentAssertions tests for `FileSearch`/`BioCol`. **These are not hermetic**: they hardcode an absolute path (`D:\Google Drive\Biodanza\Musica\...`) and a specific `.xls` file that only exist on the maintainer's machine, so they will fail (file/path not found) on any other machine or in CI. Don't treat their failure as a regression unless that data is present.

Build/test via Visual Studio or MSBuild (`msbuild Hyperlinks.sln`); there's no `dotnet` SDK-style tooling here (TargetFrameworkVersion v4.0, `packages.config` restore).

## Root-level scripts and data

- `deploy.cmd` / `deployWithoutMusic.cmd` / `deploy musicaBsAs.cmd` / `deploy musicaIBF.cmd`: package `UI/` (plus external music folders on the maintainer's `D:\Google Drive\Biodanza\...`) into distributable zips with 7-Zip. These reference maintainer-specific absolute paths and are not portable — don't "fix" the hardcoded paths without confirming with the user, they're intentional for this deployment workflow.
- `*.sql` files at the root and in `Queries/`/`UI/app/data/` are ad-hoc queries/migrations against the `Biodanza` SQL Server DB used to regenerate the static `app/data/*.js` exports; they aren't wired into any migration framework.
- `cimeb/`, `Ajustes Ejercicios.sql`, `ArchivosTest/` hold reference/source catalog data (e.g. `cimeb_catalogo_ibf_2012_espanol.docm`, `BsAs.xls`) used when building or cross-checking music collections — treat as fixtures/reference data, not code.

## Organizacion de archivos de musicas
Dentro de la carpeta musicas, estan la colecciones de musica. Cada carpeta es una coleccion. Dentro de cada carpeta debe haber un archivo NombreCarpeta.xlsx. En el archivo esta el mapeo de musicas con ejercicios y con la ubicacion del archivo. Todas las pestañas deben tener la misma info solo que ordenada de diferente manera. LAs pestañas que tienen las columnas archivo y carpeta son las que sirven. Generalmente primer columna de cada pestaña tiene la clave de la musica. Dicha clave tiene 2 partes que identifican numero de  carpeta y numero el archivo separadas por un . o un - o :
Para la carpeta tenes que ver que empiece con ese numero. Para el archivo puede ser que enmpiece por ese numero o por el numero de carpeta y luego el numero de archivo. El excel debe tener correctamente mapeado cada musica con la ubicacion en disco indicada por las columnas carpeta y archivo