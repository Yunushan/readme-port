# Getting started

ReadmePort supports three workflows. All of them produce plain Markdown that remains editable after generation.

## 1. Copy rendered Markdown

Choose a plain `.md` file under `examples/generated/`, copy it to the required location in your repository, update its example links and asset paths, remove content you do not need, and edit it normally. Files under `templates/` are generator sources and contain `#if` and `#each` blocks; they are not intended for direct placeholder replacement.

## 2. Use the CLI

Node.js 22 or newer is required. Install the CLI from GitHub; it has no runtime dependencies:

```bash
npm install --global github:Yunushan/readme-port
cd /path/to/your-target-repository
readme-port init --kind project
readme-port build --force
```

Always run `init` and `build` inside the **target repository**, not inside a ReadmePort source checkout.

Edit `readme-port.config.json`, then rebuild:

```bash
readme-port build
```

Generate provider-specific copies in one pass:

```bash
readme-port build --provider all --output dist
```

The files appear under `dist/portable`, `dist/github`, `dist/gitlab`, `dist/gitea`, `dist/forgejo`, and `dist/bitbucket`. They are staging files: copy the selected README to its destination repository root or profile path. Relative assets and links are not duplicated into `dist/`.

## 3. Use Studio

Start the built-in static server:

```bash
readme-port serve
```

Open `http://127.0.0.1:4173/web/`. Studio runs in the browser, saves drafts locally, and does not request a forge token. It does not automatically load the working directory's config: use **Import config**. Save actions create browser downloads; use the CLI when files should be written directly into the repository.

## Protecting an existing README

ReadmePort refuses to overwrite a file it did not generate. Review your target, then use `--force` once if the replacement is intentional. Later builds recognize the generated marker and preserve named manual regions. Unbalanced or mismatched manual markers stop generation before content can be lost.

## Next steps

- [Customize content and themes](CUSTOMIZATION.md)
- [Choose a platform and placement](PLATFORMS.md)
- [Author a template](TEMPLATE_AUTHORING.md)
