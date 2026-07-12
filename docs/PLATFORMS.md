# Platform compatibility

ReadmePort uses conservative Markdown as its portable source of truth, then applies provider-aware URLs, placement guidance, and optional enhancements.

## Profile and organization placement

| Platform | User profile README | Organization or group README | Recommended mode |
| --- | --- | --- | --- |
| GitHub | Root `README.md` in a public repository named exactly `{username}` | `profile/README.md` in a public organization repository named `.github` | Enhanced or portable |
| GitLab | Root README in a public `{username}/{username}` project; names are case-sensitive | Root README in the group project named `gitlab-profile` | Enhanced or portable |
| Gitea | Root `README.md` in a public repository named `.profile` | Root `README.md` in the organization repository named `.profile` | Portable by default |
| Forgejo | Root `README.md` in a public, non-fork repository named `.profile` | Root `README.md` in the organization repository named `.profile` | Portable by default |
| Bitbucket Cloud | No documented native profile README | No documented native organization profile README | Portable repository README |

Official documentation:

- [GitHub profile README](https://docs.github.com/en/account-and-profile/how-tos/profile-customization/managing-your-profile-readme)
- [GitHub organization profile](https://docs.github.com/en/organizations/collaborating-with-groups-in-organizations/customizing-your-organizations-profile)
- [GitLab profile README](https://docs.gitlab.com/user/profile/#add-details-to-your-profile-with-a-readme)
- [GitLab group README](https://docs.gitlab.com/user/group/manage/#add-a-group-readme)
- [Gitea profile README](https://docs.gitea.com/usage/repository/profile-readme)
- [Forgejo profile customization](https://forgejo.org/docs/latest/user/profile/)
- [Bitbucket README support](https://support.atlassian.com/bitbucket-cloud/docs/readme-content/)

## Portable mode

Portable mode uses ATX headings, paragraphs, emphasis, lists, links, images, fenced code, and pipe tables. It avoids raw HTML layout, platform alerts, theme-sensitive `<picture>` elements, Mermaid, math, and provider-specific widgets.

This matters most on Bitbucket Cloud, which rejects arbitrary HTML in README content. Self-hosted Gitea and Forgejo instances can also differ by version and sanitizer configuration.

Generated and manual-region markers use Markdown reference definitions rather than HTML comments, so they stay invisible in Bitbucket's documented Markdown renderer.

## Enhanced mode

GitHub and GitLab enhanced output can use centered raw-HTML headers and image-based badges. If enhanced mode is requested for an unsupported target, ReadmePort falls back to portable mode and reports a warning.

## Publish a profile

ReadmePort generates the Markdown but does not create repositories or push commits.

1. Generate the target, for example `readme-port build --provider forgejo --mode portable --output README.md`.
2. Create the exact public repository described in the table above.
3. Copy `README.md` to the exact root or `profile/` path shown above.
4. Copy every repository-relative asset, such as `assets/banner.svg`, preserving its relative path from the README.
5. Commit and push through your normal Git workflow.

For an ordinary project README, put the file at the project repository root on every provider. For a self-hosted Gitea or Forgejo target, set `provider.baseUrl` before generation.

## Bitbucket Cloud support links

Bitbucket Cloud has no documented native profile README. It does support ordinary repository README files, but Atlassian is removing Bitbucket Cloud Issues and Wikis on **August 20, 2026**. Set `links.support` to Jira, GitHub Issues, or another external tracker instead of relying on `/issues/new`. See Atlassian's [sunset announcement](https://community.atlassian.com/forums/Bitbucket-articles/Announcing-sunset-of-Bitbucket-Issues-and-Wikis/ba-p/3193882).

## CI and community metadata

The repository includes native examples for:

- GitHub Actions and issue forms under `.github/`
- GitLab CI and description templates under `.gitlab/`
- Gitea Actions and Markdown issue templates under `.gitea/`
- Forgejo Actions and Markdown issue templates under `.forgejo/`
- Bitbucket Pipelines in `bitbucket-pipelines.yml`

Provider-native templates remain separate because YAML issue-form schemas and pull-request defaults are not interchangeable.

These files are examples, not zero-configuration infrastructure. Gitea and Forgejo Actions must be enabled and need a runner with matching labels; Gitea's default action source configuration determines where unqualified actions are fetched. Self-hosted GitLab needs a registered runner, and Bitbucket Pipelines must be enabled for the repository.
