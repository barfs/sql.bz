# Deploying sql.bz

## How it works

`npm run build` writes the whole site to `build/`. It is plain HTML, CSS and JS. Only this folder gets hosted. `node_modules` never leaves your machine (or the CI runner).

The CSV tables are baked into the build. After editing a CSV, rebuild and redeploy.

| Host         | Cost                         | Deploy effort                            | HTTPS on custom domain                  |
| ------------ | ---------------------------- | ---------------------------------------- | --------------------------------------- |
| GitHub Pages | Free                         | Push to `main`, fully automatic          | Yes                                     |
| Fastmail     | Included in plan (not Basic) | Upload `build/`, or automate with rclone | Yes, if Fastmail hosts the domain's DNS |

Both work. Pick GitHub Pages for zero-touch deploys. Pick Fastmail if `sql.bz` already lives there and you want everything in one place. You can also combine them: GitHub builds, Fastmail hosts (see [Option C](#option-c-github-builds-fastmail-hosts)).

## Adding a table

Drop a CSV into `src/lib/tables/`. The filename becomes the table name, so `albums.csv` is queried as `SELECT * FROM albums`.

A music library could start like this:

```csv
id,artist,album,year,genre,format,label,catalog,rating,added,notes
1,Radiohead,OK Computer,1997,alt-rock,vinyl,Parlophone,0075596,5,2026-10-17,"First pressing, gatefold"
```

- **Header row:** Required. Column names are matched case-insensitively.
- **Commas in a value:** Wrap the value in double quotes. Escape a quote as `""`.
- **Empty cells:** Treated as NULL (`WHERE notes IS NULL`).
- **Leading zeros:** Kept as text, so catalog numbers like `0075596` survive.
- **Dates:** Use `YYYY-MM-DD` so `ORDER BY` and `>` / `<` work.
- **Excel:** Saving as "CSV UTF-8" is fine. The byte order mark is stripped.

The table shown on load is set by `DEFAULT_TABLE` in [src/lib/data/store.svelte.ts](src/lib/data/store.svelte.ts).

## Build and check locally

```sh
npm ci
npm run build
npm run preview   # open the printed URL
```

## Option A: GitHub Pages

1. Push the repo to GitHub. Your local branch is `master`. Either rename it (`git branch -m master main`) or change `main` to `master` in the workflow below.
2. In the repo, open **Settings > Pages** and set **Source** to **GitHub Actions**.
3. Create `.github/workflows/pages.yml`:

   ```yaml
   name: Deploy to GitHub Pages

   on:
     push:
       branches: [main]
     workflow_dispatch:

   permissions:
     contents: read
     pages: write
     id-token: write

   concurrency:
     group: pages
     cancel-in-progress: false

   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 22
             cache: npm
         - run: npm ci
         - run: npm run build
           env:
             # Leave empty for a custom domain. Use '/<repo-name>' for <user>.github.io/<repo-name>
             BASE_PATH: ''
         - uses: actions/upload-pages-artifact@v3
           with:
             path: build

     deploy:
       needs: build
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - id: deployment
           uses: actions/deploy-pages@v4
   ```

4. Commit and push. The **Actions** tab shows the run. Every later push to `main` redeploys.

### Custom domain on GitHub Pages

1. Verify `sql.bz` under your GitHub account's **Settings > Pages > Verified domains** first. This stops anyone else from claiming it.
2. In the repo's **Settings > Pages**, enter `sql.bz` as the custom domain.
3. At your DNS provider, add:

   | Type  | Name  | Value                   |
   | ----- | ----- | ----------------------- |
   | A     | `@`   | `185.199.108.153`       |
   | A     | `@`   | `185.199.109.153`       |
   | A     | `@`   | `185.199.110.153`       |
   | A     | `@`   | `185.199.111.153`       |
   | CNAME | `www` | `<your-user>.github.io` |

4. When the DNS check passes, tick **Enforce HTTPS**.
5. Keep `BASE_PATH` empty, since the site sits at the domain root.

No `CNAME` file is needed in the repo. That is only for branch-based deploys.

### Without a custom domain

The site lives at `https://<user>.github.io/<repo-name>/`. Set `BASE_PATH: '/<repo-name>'` in the workflow, or the page loads but the app fails to start.

## Option B: Fastmail

Fastmail serves a folder from Fastmail Files as a static site. Requirements:

- A plan above Basic (Basic has no custom domains and no app passwords).
- An account administrator does the setup.
- For HTTPS on `sql.bz`, Fastmail must host the domain's DNS. With DNS elsewhere, point a `www` CNAME at `web.fastmail.com`, and the apex too if your provider supports ALIAS/ANAME. You get no Let's Encrypt certificate in that case.

### First deploy (manual)

1. Run `npm run build`.
2. In Fastmail, open **Files**, click **New folder**, name it `sql.bz`.
3. Upload the **contents** of `build/` into it, not the `build` folder itself. `index.html` must sit at the top of `sql.bz`.
4. In the Files sidebar, open **Websites > Create website**:
   - **URL:** pick `sql.bz`
   - **Publish as:** Website
   - **Publish folder:** `sql.bz`
   - Enable HTTPS (Let's Encrypt)
5. Save. DNS changes can take up to 72 hours. A domain already on Fastmail is usually instant.

To update manually, empty the folder and upload the new `build/` contents. Each build emits new hashed filenames, so old files pile up if you only add.

### Updating with rclone (recommended)

rclone mirrors `build/` to Fastmail over WebDAV, deleting stale files for you.

1. Install: `winget install Rclone.Rclone`
2. In Fastmail, go to **Settings > Privacy & Security > Manage app passwords and access**. Create a password with the **Files (WebDAV)** scope.
3. Configure a remote once:

   ```sh
   rclone config create fastmail webdav url=https://myfiles.fastmail.com vendor=fastmail user=you@yourdomain pass=<app-password> --obscure
   ```

   `user` is your full Fastmail address.

4. Deploy:

   ```sh
   npm run build
   rclone sync build fastmail:sql.bz --dry-run   # preview what changes
   rclone sync build fastmail:sql.bz --progress
   ```

`rclone sync` makes the destination match `build/` exactly. Point it only at the dedicated site folder.

## Option C: GitHub builds, Fastmail hosts

Code on GitHub, site on Fastmail, no local build. Add two repo secrets under **Settings > Secrets and variables > Actions**: `FASTMAIL_USER` (your Fastmail login) and `FASTMAIL_APP_PASSWORD` (the WebDAV app password). Then create `.github/workflows/fastmail.yml`:

```yaml
name: Deploy to Fastmail

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: curl -fsSL https://rclone.org/install.sh | sudo bash
      - run: >
          rclone sync build :webdav:sql.bz
          --webdav-url=https://myfiles.fastmail.com
          --webdav-vendor=fastmail
          --webdav-user="$FASTMAIL_USER"
          --webdav-pass="$(rclone obscure "$FASTMAIL_APP_PASSWORD")"
        env:
          FASTMAIL_USER: ${{ secrets.FASTMAIL_USER }}
          FASTMAIL_APP_PASSWORD: ${{ secrets.FASTMAIL_APP_PASSWORD }}
```

The Fastmail website setup from Option B, step 4, is still needed once.

## Troubleshooting

- **Page flashes, then shows a 404 or stops responding:** `BASE_PATH` doesn't match the URL the site is served from. Root of a domain means empty. A subfolder means `/<folder>`.
- **Building with a base path on Windows:** Git Bash rewrites `/sql.bz` into a Windows path. Use PowerShell: `$env:BASE_PATH='/sql.bz'; npm run build`.
- **Styles or scripts 404:** You uploaded the `build` folder instead of its contents.
- **rclone can't find `sql.bz`:** Run `rclone lsd fastmail:` to see what the remote sees. If it's empty, reconfigure with `url=https://webdav.fastmail.com` and browse down to your `files` folder.
- **Why `app/` and not `_app/`:** SvelteKit's default `_app` folder is skipped by Jekyll-based hosts. [svelte.config.js](svelte.config.js) renames it so no host treats it as hidden.
