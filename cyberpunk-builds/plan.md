# Cyberpunk Builds data and Supabase setup plan

## Goal

Provide a practical data-source and Supabase setup walkthrough for the existing Vite project. Users author their own builds, and build forms select items from a shared cyberware catalog.

## Todos

1. Identify a reliable Cyberpunk 2077 cyberware reference source and explain reuse, attribution, and game-version considerations.
2. Recommend a small relational schema for the shared cyberware catalog and user-owned build records, including build-to-cyberware selections.
3. Explain how to create the tables, secure user data with Supabase Auth and Row Level Security, and seed/import the catalog.
4. Explain how the existing Vite app should connect to Supabase using its installed client without exposing privileged credentials.

## Notes and decisions

- The repository is a Vite app and already includes `@supabase/supabase-js`.
- The requested scope is setup guidance rather than implementing the application.
- Builds will be authored by users; a shared, curated cyberware table provides consistent selectable options.
- Do not assume there is a complete, official, downloadable Cyberpunk 2077 dataset or API. Treat community-maintained wikis as research references, verify their current licensing/attribution requirements before reusing data, and track the game patch/version represented by curated records.
- Prefer manually curated, minimal structured fields over scraping or bulk-copying a wiki. Avoid importing proprietary descriptions, artwork, or other expressive material without permission.
- For a student/small catalog, Supabase Dashboard CSV import is a simple start. For repeatable development, use Supabase migrations and `supabase/seed.sql`; CSV import is not a substitute for schema/RLS configuration.
- Catalog rows are shared read-only reference data. Builds and build-item selections are private to their authenticated owner under RLS.

## Useful documentation

- [Supabase: Import data](https://supabase.com/docs/guides/database/import-data)
- [Supabase: Seed your database](https://supabase.com/docs/guides/local-development/seeding-your-database)
- [Supabase: Tables and data](https://supabase.com/docs/guides/database/tables)
- [Supabase: React quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs)
- [Cyberpunk Wiki: Cyberware](https://cyberpunk.fandom.com/wiki/Cyberware)
