import { createStarterConfig } from '../src/core/config.mjs';
import { getProviderDefinition } from '../src/core/providers.mjs';
import { TEMPLATE_REGISTRY, THEME_REGISTRY, getTemplate, getTheme } from '../src/core/registry.mjs';
import { renderReadme } from '../src/core/render.mjs';
import { validateConfig } from '../src/core/validate.mjs';

const elements = Object.fromEntries([
  'kindField', 'templateField', 'providerField', 'modeField', 'themeField',
  'titleField', 'taglineField', 'ownerField', 'repositoryField',
  'compatibilityNotice', 'configEditor', 'generateButton', 'copyButton',
  'importButton', 'exportConfigButton', 'saveReadmeButton', 'fileInput',
  'resetButton', 'messages', 'previewPane', 'sourcePane', 'previewTab',
  'sourceTab', 'toast',
].map((id) => [id, document.getElementById(id)]));

let config;
let output = '';
let toastTimer;
const STORAGE_KEY = 'readme-port-config-v2';

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  toastTimer = setTimeout(() => elements.toast.classList.remove('visible'), 2200);
}

function showMessages(messages, kind = 'error') {
  const list = messages.filter(Boolean);
  elements.messages.textContent = list.join(' · ');
  elements.messages.classList.toggle('visible', list.length > 0);
  elements.messages.classList.toggle('warning', kind === 'warning');
}

function populateThemes() {
  elements.themeField.replaceChildren(...THEME_REGISTRY.map((theme) => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    return option;
  }));
}

function populateTemplates(kind, selected) {
  const templates = TEMPLATE_REGISTRY.filter((template) => template.kind === kind);
  if (templates.length === 0) throw new Error(`No templates are available for type "${kind}"`);
  elements.templateField.replaceChildren(...templates.map((template) => {
    const option = document.createElement('option');
    option.value = template.id;
    option.textContent = template.name;
    option.title = template.description;
    return option;
  }));
  elements.templateField.value = templates.some((template) => template.id === selected)
    ? selected
    : templates[0].id;
}

function syncFormFromConfig() {
  populateTemplates(config.kind, config.template);
  elements.kindField.value = config.kind;
  elements.templateField.value = config.template;
  elements.providerField.value = config.provider?.id || 'portable';
  elements.modeField.value = config.provider?.mode || 'portable';
  elements.themeField.value = config.theme || 'midnight';
  elements.titleField.value = config.branding?.title || '';
  elements.taglineField.value = config.branding?.tagline || '';
  elements.ownerField.value = config.repository?.owner || config.owner?.username || '';
  elements.repositoryField.value = config.repository?.name || '';
  elements.configEditor.value = JSON.stringify(config, null, 2);
  updateCompatibilityNotice();
}

function syncConfigFromForm() {
  const selectedProvider = elements.providerField.value;
  const previousProvider = config.provider?.id || 'portable';
  const locationChanged = selectedProvider !== previousProvider && selectedProvider !== 'portable';
  const baseUrl = locationChanged
    ? getProviderDefinition(selectedProvider).defaultBaseUrl
    : config.provider?.baseUrl;
  config.kind = elements.kindField.value;
  config.template = elements.templateField.value;
  config.provider = {
    ...(config.provider || {}),
    id: selectedProvider,
    mode: elements.modeField.value,
    baseUrl,
  };
  config.theme = elements.themeField.value;
  config.branding = {
    ...(config.branding || {}),
    title: elements.titleField.value.trim(),
    tagline: elements.taglineField.value.trim(),
  };
  config.repository = {
    ...(config.repository || {}),
    ...(locationChanged ? { url: '' } : {}),
    owner: elements.ownerField.value.trim(),
    name: elements.repositoryField.value.trim(),
  };
  config.owner = {
    ...(config.owner || {}),
    username: elements.ownerField.value.trim(),
    name: config.kind === 'profile' ? elements.titleField.value.trim() : (config.owner?.name || elements.ownerField.value.trim()),
  };
  elements.configEditor.value = JSON.stringify(config, null, 2);
  localStorage.setItem(STORAGE_KEY, elements.configEditor.value);
}

function updateCompatibilityNotice() {
  const provider = elements.providerField.value;
  const kind = elements.kindField.value;
  const mode = elements.modeField.value;
  let message = 'Portable Markdown avoids raw HTML and forge-specific widgets.';
  let warning = false;
  if (provider === 'github' && kind === 'profile') message = 'GitHub profile: publish README.md in a public repository named exactly like your username.';
  if (provider === 'gitlab' && kind === 'profile') message = 'GitLab profile: use a public, case-sensitive username/username project.';
  if (provider === 'gitea' && kind === 'profile') message = 'Gitea profile: publish a root README.md in a public repository named .profile.';
  if (provider === 'forgejo' && kind === 'profile') message = 'Forgejo profile: publish a root README.md in a public, non-fork repository named .profile.';
  if (provider === 'bitbucket' && kind === 'profile') {
    message = 'Bitbucket Cloud has no documented native profile README. This output works as a repository README.';
    warning = true;
  } else if (mode === 'enhanced' && ['portable', 'gitea', 'forgejo', 'bitbucket'].includes(provider)) {
    message += ' ReadmePort will safely fall back to portable mode for this target.';
    warning = true;
  }
  elements.compatibilityNotice.textContent = message;
  elements.compatibilityNotice.classList.toggle('warning', warning);
}

async function fetchText(relativePath) {
  const response = await fetch(new URL(`../${relativePath}`, window.location.href));
  if (!response.ok) throw new Error(`Could not load ${relativePath}`);
  return response.text();
}

async function generate() {
  showMessages([]);
  try {
    const candidate = JSON.parse(elements.configEditor.value);
    const validation = validateConfig(candidate);
    if (validation.errors.length > 0) {
      throw new Error(`Invalid configuration: ${validation.errors.join(' · ')}`);
    }
    config = candidate;
    syncFormFromConfig();
    const template = getTemplate(config.template);
    const theme = getTheme(config.theme || 'midnight');
    const [templateSource, themeSource] = await Promise.all([
      fetchText(template.path),
      fetchText(theme.path),
    ]);
    const themeValue = JSON.parse(themeSource);
    const result = renderReadme({
      templateSource,
      config,
      theme: themeValue,
      previousContent: output,
      strict: true,
    });
    output = result.content;
    elements.sourcePane.value = output;
    renderPreview(output);
    document.documentElement.style.setProperty('--purple', themeValue.accent);
    document.documentElement.style.setProperty('--cyan', themeValue.secondary);
    showMessages(result.warnings, 'warning');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (error) {
    showMessages([error.message]);
    return false;
  }
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeHref(value) {
  const decoded = value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replace(/&(?:tab|newline);/gi, '')
    .replace(/&#(?:x0*(?:9|a|d)|0*(?:9|10|13));?/gi, '')
    .trim();
  if (/[\u0000-\u001f\u007f]/.test(decoded)) return '#';
  if (!decoded || decoded.startsWith('//')) return '#';
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(decoded);
  if (hasScheme && !/^(?:https?|mailto):/i.test(decoded)) return '#';
  return /^(?:https?:|mailto:|#|\/|\.\.?\/|[a-zA-Z0-9_.-])/i.test(decoded)
    ? escapeHtml(decoded)
    : '#';
}

function inlineMarkdown(value) {
  let safe = escapeHtml(value);
  safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_whole, label, href) => `<a href="${safeHref(href)}" target="_blank" rel="noreferrer">${label}</a>`);
  return safe;
}

function renderPreview(markdown) {
  const cleaned = markdown
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/^\[readme-port-(?:generated|manual-(?:start|end)-[^\]]+)\]: # \([^\n]*\)$/gm, '')
    .replace(/<img\b[^>]*alt="([^"]*)"[^>]*>/gi, '$1')
    .replace(/<[^>]+>/g, '');
  const lines = cleaned.split('\n');
  const html = [];
  let inCode = false;
  let codeLines = [];
  let listOpen = false;
  let index = 0;

  const closeList = () => {
    if (listOpen) html.push('</ul>');
    listOpen = false;
  };
  const tableCells = (line) => line
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replaceAll('\\|', '|'));

  while (index < lines.length) {
    const line = lines[index];
    if (/^```/.test(line)) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
      }
      inCode = !inCode;
      index += 1;
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      index += 1;
      continue;
    }
    if (line.startsWith('|') && /^\|?\s*:?-+/.test(lines[index + 1] || '')) {
      closeList();
      const rows = [];
      rows.push(tableCells(line));
      index += 2;
      while ((lines[index] || '').startsWith('|')) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      const [header, ...body] = rows;
      html.push('<table><thead><tr>', ...header.map((cell) => `<th>${inlineMarkdown(cell)}</th>`), '</tr></thead><tbody>');
      body.forEach((row) => html.push('<tr>', ...row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`), '</tr>'));
      html.push('</tbody></table>');
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
    } else if (/^-{3,}\s*$/.test(line)) {
      closeList();
      html.push('<hr>');
    } else if (/^[-*]\s+/.test(line)) {
      if (!listOpen) html.push('<ul>');
      listOpen = true;
      html.push(`<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>`);
    } else if (/^>\s?/.test(line)) {
      closeList();
      html.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ''))}</blockquote>`);
    } else if (line.trim()) {
      closeList();
      html.push(`<p>${inlineMarkdown(line)}</p>`);
    } else {
      closeList();
    }
    index += 1;
  }
  if (inCode) html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  closeList();
  elements.previewPane.innerHTML = html.join('');
}

function switchTab(source) {
  const sourceActive = source === 'source';
  elements.previewPane.hidden = sourceActive;
  elements.sourcePane.hidden = !sourceActive;
  elements.previewTab.classList.toggle('active', !sourceActive);
  elements.sourceTab.classList.toggle('active', sourceActive);
  elements.previewTab.setAttribute('aria-selected', String(!sourceActive));
  elements.sourceTab.setAttribute('aria-selected', String(sourceActive));
  elements.previewTab.tabIndex = sourceActive ? -1 : 0;
  elements.sourceTab.tabIndex = sourceActive ? 0 : -1;
}

function saveBlob(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function copyOutput() {
  if (!await generate()) return;
  try {
    await navigator.clipboard.writeText(output);
    showToast('Markdown copied');
  } catch {
    switchTab('source');
    elements.sourcePane.select();
    if (document.execCommand('copy')) showToast('Markdown copied');
    else showMessages(['Clipboard access was denied. Select and copy the Markdown manually.']);
  }
}

async function reset() {
  localStorage.removeItem('readme-port-config-v1');
  localStorage.removeItem(STORAGE_KEY);
  try {
    config = JSON.parse(await fetchText('web/starter.config.json'));
  } catch {
    config = createStarterConfig('project');
  }
  syncFormFromConfig();
  if (await generate()) showToast('Example reset');
}

function bindEvents() {
  ['titleField', 'taglineField', 'ownerField', 'repositoryField']
    .forEach((key) => elements[key].addEventListener('input', syncConfigFromForm));
  ['templateField', 'themeField'].forEach((key) => elements[key].addEventListener('change', syncConfigFromForm));
  ['providerField', 'modeField'].forEach((key) => elements[key].addEventListener('change', () => {
    syncConfigFromForm();
    updateCompatibilityNotice();
  }));
  elements.kindField.addEventListener('change', () => {
    const replacement = createStarterConfig(elements.kindField.value);
    replacement.provider = { ...replacement.provider, ...config.provider };
    replacement.theme = config.theme;
    config = replacement;
    syncFormFromConfig();
  });
  elements.generateButton.addEventListener('click', generate);
  elements.copyButton.addEventListener('click', copyOutput);
  elements.resetButton.addEventListener('click', reset);
  elements.previewTab.addEventListener('click', () => switchTab('preview'));
  elements.sourceTab.addEventListener('click', () => switchTab('source'));
  [elements.previewTab, elements.sourceTab].forEach((tab) => tab.addEventListener('keydown', (event) => {
    const tabs = [elements.previewTab, elements.sourceTab];
    const current = tabs.indexOf(event.currentTarget);
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    switchTab(next === 0 ? 'preview' : 'source');
    tabs[next].focus();
  }));
  elements.importButton.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', async () => {
    const [file] = elements.fileInput.files;
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      elements.configEditor.value = JSON.stringify(imported, null, 2);
      if (await generate()) showToast('Configuration imported');
    } catch (error) {
      showMessages([`Import failed: ${error.message}`]);
    }
    elements.fileInput.value = '';
  });
  elements.exportConfigButton.addEventListener('click', () => {
    saveBlob('readme-port.config.json', `${elements.configEditor.value.trim()}\n`, 'application/json');
  });
  elements.saveReadmeButton.addEventListener('click', async () => {
    if (!await generate()) return;
    saveBlob('README.md', output, 'text/markdown');
  });
}

async function start() {
  populateThemes();
  const stored = localStorage.getItem(STORAGE_KEY);
  try {
    const candidate = stored ? JSON.parse(stored) : JSON.parse(await fetchText('web/starter.config.json'));
    const validation = validateConfig(candidate);
    if (validation.errors.length > 0) throw new Error(validation.errors.join(', '));
    config = candidate;
  } catch {
    config = createStarterConfig('project');
  }
  syncFormFromConfig();
  bindEvents();
  await generate();
}

start();
