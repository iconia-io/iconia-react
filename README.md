# @iconia/react ![NPM Version](https://img.shields.io/npm/v/%40iconia%2Freact)

CLI and React component library for [iconia.io](https://iconia.io) — manage SVG icon collections and import them as typed React components at build time.

## Install

```bash
npm install @iconia/react
# or
bun add @iconia/react
# or
pnpm add @iconia/react
```

## Quick start

```bash
npx @iconia/react init        # create iconia.config.ts
npx @iconia/react add my-icons  # add a collection and download icons
```


### Shorter commands after install

Once `@iconia/react` is installed in your project you can drop the package name and use `iconia` directly:

```bash
iconia init
iconia add my-icons
iconia sync
iconia pull
```

## Configuration

`iconia.config.ts` in your project root:

```ts
import type { IconiaConfig } from "@iconia/react";

export default {
  collections: ["my-icons", "team-brand"],
  uploadBatchSize: 50, // icons per upload request, 1–100 (default: 50)
} satisfies IconiaConfig;
```

The CLI reads the API key from the `ICONIA_API_KEY` environment variable. You can also set `apiKey` directly in the config file, but using an env var is recommended. Generate a key in your [iconia.io dashboard](https://iconia.io/settings/api-keys).

---

## CLI commands

### `iconia init`

Create a starter `iconia.config.ts` in the current directory.

```bash
npx @iconia/react init
```

---

### `iconia add <slug>`

Add a collection to your project: validates it exists on the server, updates `iconia.config.ts`, downloads icons and generates React components.

```bash
npx @iconia/react add my-icons
npx @iconia/react add team-brand
```

---

### `iconia remove <slug>`

Remove a collection: deletes generated files and removes the slug from `iconia.config.ts`.

```bash
npx @iconia/react remove my-icons
```

---

### `iconia pull`

Full re-download and regeneration of all (or one) collection. Replaces existing generated files.

```bash
npx @iconia/react pull                         # all collections from config
npx @iconia/react pull --collection my-icons   # one collection only
```

---

### `iconia sync`

Incremental update: compares server fingerprints with the local `.iconia-lock.json` and only regenerates collections that have changes (new icons, updated icons, deleted icons).

```bash
npx @iconia/react sync                         # all collections
npx @iconia/react sync --collection my-icons
```

Output shows a diff per collection:

```
  my-icons: +3 added  (arrow-right, chevron-down, x)
  team-brand: ~1 updated  (logo)
  old-set: up to date
```

---

### `iconia upload <path>`

Upload a single SVG file or an entire folder of SVGs to a collection on iconia.io. Sends icons in batches (configurable via `uploadBatchSize`). Automatically retries on rate limiting.

```bash
npx @iconia/react upload ./icons/arrow.svg --collection my-icons
npx @iconia/react upload ./icons/ --collection my-icons
npx @iconia/react upload ./icons/ --collection my-icons --tags ui,navigation
npx @iconia/react upload ./solid/ --collection my-icons --variant solid
```

Options:

- `-c, --collection <slug>` — target collection **(required)**
- `--variant <slug>` — assign all uploaded icons to a named variant (e.g. `solid`, `outline`)
- `--tags <tags>` — comma-separated tags applied to all uploaded icons

---

## Using icons in your project

After `pull` or `sync`, import icons directly from the collection:

```tsx
import { ArrowRight, Home, Settings } from "@iconia/react/my-icons";

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

### Variants

Collections can contain multiple variants of the same icon set (e.g. solid, outline, filled). Each variant is available as a separate sub-path:

```tsx
import { ArrowRight } from "@iconia/react/my-icons/solid";
import { ArrowRight as ArrowRightOutline } from "@iconia/react/my-icons/outline";
```

Icons without a variant are imported directly from the collection path:

```tsx
import { ArrowRight } from "@iconia/react/my-icons";
```

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
