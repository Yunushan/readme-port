# Contributing to ReadmePort

Thank you for improving ReadmePort. Small, focused changes with a clear example are easiest to review.

## Before you start

1. Search existing issues before opening a new one.
2. For large template or behavior changes, open a proposal first.
3. Never add secrets, personal tokens, copied profile artwork, or assets without a clear license.

## Local workflow

```bash
git clone https://github.com/Yunushan/readme-port.git
cd readme-port
npm test
npm run check
```

The CLI has no runtime dependencies, so `npm install` is not required for normal development on Node.js 22 or newer.

## Template contributions

- Start with portable Markdown.
- Put optional host-specific enhancements behind `{{#if modeEnhanced}}`.
- Keep headings descriptive and the first screen concise.
- Provide useful alt text for every image.
- Do not make dynamic badges, visitor counters, or tracking images mandatory.
- Add or update a generated example and a test fixture.
- Document any bundled third-party asset in `THIRD_PARTY_NOTICES.md`.

See [Template authoring](docs/TEMPLATE_AUTHORING.md) for the supported syntax.

## Pull requests

- Explain the reader problem being solved.
- Include before/after Markdown for visual changes.
- Run `npm run ci` and include the result.
- Keep generated output and source templates in the same change.

By contributing, you agree that your contribution is licensed under the repository's MIT License.
