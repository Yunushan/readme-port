export const TEMPLATE_REGISTRY = Object.freeze([
  {
    id: 'project/flagship',
    kind: 'project',
    name: 'Flagship',
    description: 'Polished product landing page with badges, navigation, features, setup, usage, and roadmap.',
    path: 'templates/project/flagship.md.tmpl',
  },
  {
    id: 'project/minimal',
    kind: 'project',
    name: 'Minimal Project',
    description: 'Compact project documentation with the essentials and no visual noise.',
    path: 'templates/project/minimal.md.tmpl',
  },
  {
    id: 'project/docs-hub',
    kind: 'project',
    name: 'Documentation Hub',
    description: 'Documentation-first layout for infrastructure, APIs, platforms, and internal tools.',
    path: 'templates/project/docs-hub.md.tmpl',
  },
  {
    id: 'profile/professional',
    kind: 'profile',
    name: 'Professional',
    description: 'Recruiter-friendly profile with a crisp introduction, skills, work, and contact links.',
    path: 'templates/profile/professional.md.tmpl',
  },
  {
    id: 'profile/terminal',
    kind: 'profile',
    name: 'Terminal',
    description: 'A playful terminal-inspired profile that stays readable in portable mode.',
    path: 'templates/profile/terminal.md.tmpl',
  },
  {
    id: 'profile/minimal',
    kind: 'profile',
    name: 'Minimal Profile',
    description: 'A low-maintenance personal profile focused on signal over decoration.',
    path: 'templates/profile/minimal.md.tmpl',
  },
  {
    id: 'organization/community',
    kind: 'organization',
    name: 'Community Organization',
    description: 'Mission, projects, community links, contribution paths, and governance.',
    path: 'templates/organization/community.md.tmpl',
  },
]);

export const THEME_REGISTRY = Object.freeze([
  { id: 'midnight', name: 'Midnight', path: 'themes/midnight.json' },
  { id: 'nord', name: 'Nord', path: 'themes/nord.json' },
  { id: 'terminal', name: 'Terminal', path: 'themes/terminal.json' },
  { id: 'corporate', name: 'Corporate', path: 'themes/corporate.json' },
]);

export function getTemplate(templateId) {
  const template = TEMPLATE_REGISTRY.find((item) => item.id === templateId);
  if (!template) {
    throw new Error(`Unknown template "${templateId}"`);
  }
  return template;
}

export function getTheme(themeId) {
  const theme = THEME_REGISTRY.find((item) => item.id === themeId);
  if (!theme) {
    throw new Error(`Unknown theme "${themeId}"`);
  }
  return theme;
}
