# Backup manifest

Offline source archive created **2026-09-04**. Restore from GitHub first (`docs/RECOVERY.md`). Use the zip only if Git is unavailable.

| | |
|---|---|
| File | `PEPTIX_BACKUP_2026-09-04.zip` |
| Location | `C:\Users\PolatMehmetErkan\Documents\PEPTIX-BACKUPS\PEPTIX_BACKUP_2026-09-04.zip` |
| Size | 3 240 704 bytes (3.09 MiB) |
| SHA-256 | `3f5bc289e2a0235f138f3acc7350b26b132725e846e9d853d5aed79f511dec36` |
| Entries | 741 |
| Git at zip | `d4ccee3` (`main`); recovery docs land in the following commit on the same branch |
| Readable | Yes (`tar -tf` lists `src/`, `docs/RECOVERY.md`, `supabase/migrations/0049_order_progress.sql`, `.env.example`) |

Contains: `src` (including tests), `public`, `supabase` (migrations, functions, `config.toml`), `docs`, `scripts`, `package.json`, `package-lock.json`, tsconfig/Vite/ESLint/Tailwind/Vercel, `.env.example`, README, `.cursor/rules/project-memory.mdc`.

Excludes: `node_modules`, `dist`, `.git`, `.env`, `.env.local`, `.vercel`, service-role keys, OAuth/Telegram secrets, customer/order dumps, production SQL data dumps.
