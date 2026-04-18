# Decisions Log

Each PR appends one or more entries here describing choices made that weren't
explicitly covered by the spec. Write "no deviations" if the PR follows the
spec exactly.

---

## PR 1 — Scaffold

- Added `postcss.config.js` to the frontend alongside `tailwind.config.js`; required by Tailwind v3 with Vite and not explicitly listed in the spec's file tree.
- Added `frontend/index.html` (Vite entry point); omitted from the spec's file tree but required for a functional Vite project.
- Added `frontend/src/index.css` for Tailwind directives; required for Tailwind to inject utility classes.
- Added `frontend/eslint.config.js` (flat ESLint config for eslint v9); the spec pins eslint ^9.17.0 which uses the flat config format.
- Added `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `@eslint/js`, `typescript-eslint`, and `globals` as devDependencies; required by the eslint flat config but not listed in the spec's dependency table.
- Placeholder checkpoint `.pt` files are committed as `.pt.placeholder` text files to avoid binary blobs in git; actual `.pt` files are gitignored.
- Added `backend/migrations/` directory with `001_init.sql` stub; referenced in the spec's Supabase setup section but missing from the repo structure diagram.
- Added `backend/tests/integration/__init__.py`; the spec references `backend/tests/integration/` for integration tests but doesn't list it in the tree.
