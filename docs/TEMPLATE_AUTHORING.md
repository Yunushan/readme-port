# Template authoring

ReadmePort templates are ordinary Markdown plus a deliberately small, non-executable syntax. Templates cannot run JavaScript or shell commands.

## Variables

```markdown
# {{branding.title}}

{{about}}
```

Dot notation reads nested values. Missing variables fail strict builds.

## Conditions

```markdown
{{#if branding.logo}}
![Project logo]({{branding.logo}})
{{else}}
# {{branding.title}}
{{/if}}
```

Use `{{#unless value}}` for the inverse. Empty strings, empty arrays, `false`, `null`, and missing values are false.

## Loops

```markdown
{{#each features}}- **{{this.title}}** — {{this.description}}
{{/each}}
```

Inside a loop, use `this`, `this.field`, `@index`, `@number`, `@first`, and `@last`. Parent values remain available by name or with `../path`.

## Portable and enhanced branches

```markdown
{{#if modeEnhanced}}
<div align="center"><h1>{{branding.titleHtml}}</h1></div>
{{else}}
# {{branding.title}}
{{/if}}
```

Always make the `else` branch complete and readable.

## Manual content

Use stable, unique IDs:

```markdown
[readme-port-manual-start-deployment-notes]: # (readme-port:manual)
Environment-specific notes.
[readme-port-manual-end-deployment-notes]: # (/readme-port:manual)
```

Missing variable, conditional, and loop paths fail strict builds. Optional values are normalized to empty strings or arrays by the built-in context.

## Available context

| Path | Contents |
| --- | --- |
| `branding.*` | Title, tagline, logo, banner, and escaped `*Html` variants |
| `owner.*` | Name, username, bio, location, website, email, and avatar |
| `repository.*` | Provider-aware owner, native profile repository name, URL, clone URL, issues URL, and default branch |
| `provider.*` | Target name, mode, base URL, capabilities, and placement instructions |
| `features`, `stack`, `skills`, `projects` | Normalized arrays safe for lists and tables |
| `badges`, `navigation`, `socials` | Normalized links plus escaped HTML variants |
| `quickStart`, `installation`, `usage`, `configuration`, `roadmap` | Documentation sections |
| `links.*`, `license.*`, `options.*` | Project metadata and generation options |
| `custom.*` | Arbitrary user-supplied values for custom templates |

Use escaped fields such as `branding.titleHtml` and `navigation[].urlHtml` inside enhanced raw-HTML branches. Use the ordinary fields in Markdown branches.

## Adding a built-in template

1. Add the `.md.tmpl` file under the appropriate `templates/` directory.
2. Register it in `src/core/registry.mjs`.
3. Add the ID to `schema/readme-port.schema.json`.
4. Add a representative generated example.
5. Add rendering and compatibility tests.
6. Run `npm run ci`.
