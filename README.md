# sql.bz

A personal catalog styled as a Windows 98 SQL Server manager. Built with SvelteKit (Svelte 5) and [98.css](https://jdan.github.io/98.css/), served as a static site.

Every CSV in [src/lib/tables/](src/lib/tables/) becomes a read-only table you can query with a small SQL dialect (`SELECT`, `WHERE`, `GROUP BY`, `ORDER BY`, `LIMIT`, `COUNT`). See the header of [src/lib/sql/parser.ts](src/lib/sql/parser.ts) for the full syntax.

## Develop

```sh
npm install
npm run dev
```

## Build

```sh
npm run build    # outputs the site to build/
npm run preview  # serves build/ locally
```

Deployment to GitHub Pages or Fastmail is covered in [DEPLOY.md](DEPLOY.md).
