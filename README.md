# iconia

CLI and React component library for [iconia.io](https://iconia.io) — manage SVG icon collections and import them as typed React components at build time.

## Install

```bash
npm install iconia
# or
bun add iconia
# or
pnpm add iconia
```

## Quick start

```bash
npx iconia init        # create iconia.config.ts
npx iconia add my-icons  # add a collection and download icons
```

## Configuration

`iconia.config.ts` in your project root:

```ts
import type { IconiaConfig } from 'iconia';

export default {
  apiKey: process.env.ICONIA_API_KEY,
  collections: ['my-icons', 'team-brand'],
} satisfies IconiaConfig;
```

Set `ICONIA_API_KEY` to an API key generated in your [iconia.io dashboard](https://iconia.io/settings/api-keys).

---

## CLI commands

### `iconia init`

Create a starter `iconia.config.ts` in the current directory.

```bash
npx iconia init
```

---

### `iconia add <slug>`

Add a collection to your project: validates it exists on the server, updates `iconia.config.ts`, downloads icons and generates React components.

```bash
npx iconia add my-icons
npx iconia add team-brand
```

---

### `iconia remove <slug>`

Remove a collection: deletes generated files and removes the slug from `iconia.config.ts`.

```bash
npx iconia remove my-icons
```

---

### `iconia pull`

Full re-download and regeneration of all (or one) collection. Replaces existing generated files.

```bash
npx iconia pull                    # all collections from config
npx iconia pull --collection my-icons  # one collection only
```

---

### `iconia sync`

Incremental update: compares server fingerprints with the local `.iconia-lock.json` and only regenerates collections that have changes (new icons, updated icons, deleted icons).

```bash
npx iconia sync                    # all collections
npx iconia sync --collection my-icons
```

Output shows a diff per collection:

```
  my-icons: +3 added  (arrow-right, chevron-down, x)
  team-brand: ~1 updated  (logo)
  old-set: up to date
```

---

### `iconia upload <path>`

Upload a single SVG file or an entire folder of SVGs to a collection on iconia.io.

```bash
npx iconia upload ./icons/arrow.svg --collection my-icons
npx iconia upload ./icons/ --collection my-icons
npx iconia upload ./icons/ --collection my-icons --tags ui,navigation
```

Options:
- `-c, --collection <slug>` — target collection **(required)**
- `--tags <tags>` — comma-separated tags applied to all uploaded icons

---

## Using icons in your project

After `pull` or `sync`, import icons directly from the collection:

```tsx
import { ArrowRight, Home, Settings } from 'iconia/my-icons';

export function App() {
  return (
    <div>
      <ArrowRight className="size-5" />
      <Home strokeWidth={1.5} />
      <Settings color="gray" />
    </div>
  );
}
```

All icons accept standard `SVGProps<SVGSVGElement>` and forward refs.

---

## Lockfile

`iconia sync` reads and writes `.iconia-lock.json` in your project root. It stores the fingerprint of every downloaded icon so that `sync` can detect changes without diffing SVG content.

Commit this file to version control so your team shares the same sync baseline.

---

## API key

Generate an API key at **iconia.io → Settings → API Keys**. The key authenticates CLI requests and scopes them to your collections.

```bash
export ICONIA_API_KEY=ik_...
```

Or add it to `.env` and load it via your preferred env tooling (`dotenv`, Vite, Next.js, etc.).
