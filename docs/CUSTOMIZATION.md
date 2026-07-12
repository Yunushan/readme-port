# Customization

## Configuration first

`readme-port.config.json` is the source of truth. The included JSON Schema gives editors completion and validation for templates, providers, badges, sections, links, projects, skills, and themes.

Useful top-level fields:

| Field | Purpose |
| --- | --- |
| `kind` | `project`, `profile`, or `organization` |
| `template` | Built-in layout ID |
| `provider` | Forge, base URL, and portable/enhanced mode |
| `branding` | Title, tagline, logo, and optional banner |
| `features`, `skills`, `projects` | Repeated content rendered as lists or tables |
| `links` | Documentation, support, security, contribution, and license targets |
| `license` | Display name, SPDX identifier, and local or remote license URL |
| `custom` | User-defined values exposed to ejected templates as `custom.*` |
| `options` | Manual-region preservation and provider notes |

## Manual regions

Generated templates include blocks like this:

```markdown
[readme-port-manual-start-project-notes]: # (readme-port:manual)
Write directly in this area.
[readme-port-manual-end-project-notes]: # (/readme-port:manual)
```

ReadmePort carries the content between matching markers into the next build. IDs must be unique and markers must remain balanced.

## Full template control

Eject the current template:

```bash
readme-port eject
```

The CLI copies the template into `.readme-port/templates/` and adds `customTemplate` to the configuration. You can then change the Markdown layout without modifying ReadmePort itself. Built-in normalized fields remain available, and arbitrary project data can be supplied under `custom`.

## Themes and assets

Themes provide reusable identity values, while Markdown files remain responsible for layout. Use repository-relative SVG or PNG files for dependable rendering:

```json
{
  "theme": "nord",
  "branding": {
    "logo": "assets/logo.svg",
    "banner": "assets/banner.svg"
  }
}
```

Commit the referenced assets with the generated README. Include meaningful alt text through a template or surrounding copy.

Themes change the title glyph and the Studio accent colors. Markdown itself cannot apply arbitrary fonts or colors consistently across forges, so logos and banners remain the portable visual layer.

## Provider-aware command tokens

Quick-start commands can use these explicit tokens:

- `{{repository.url}}`
- `{{repository.cloneUrl}}`
- `{{repository.issuesUrl}}`
- `{{repository.owner}}`
- `{{repository.name}}`

ReadmePort resolves them for the selected target. Explicit URLs elsewhere in the config are treated as intentional and are not silently rewritten. Leave `links.support` empty to use the provider's issue form, except on Bitbucket Cloud, where an external Jira or other tracker is required.

## Badges and dynamic cards

Badges are opt-in. Prefer truthful build, version, support, and license indicators. Avoid fabricated download counts and be aware that externally hosted cards can fail, track readers, or expose repository names to a third party.

## Self-hosted forges

Set the instance root explicitly:

```json
{
  "provider": {
    "id": "forgejo",
    "mode": "portable",
    "baseUrl": "https://git.example.org"
  }
}
```
