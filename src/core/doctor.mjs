import { inspectManualRegions } from './manual-regions.mjs';

const HTML_PATTERN = /<!--[\s\S]*?-->|<\/?[a-z][a-z0-9-]*(?:\s[^<>]*?)?\s*\/?>/i;
const RELATIVE_LINK_PATTERN = /!?\[[^\]]*\]\((?!https?:|mailto:|#)([^)\s]+)(?:\s+"[^"]*")?\)/g;

function stripRenderedCode(content) {
  const kept = [];
  let fence = null;
  for (const line of String(content).replace(/\r\n?/g, '\n').split('\n')) {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!fence && match) {
      fence = { character: match[1][0], length: match[1].length };
      kept.push('');
      continue;
    }
    if (fence) {
      if (match
        && match[1][0] === fence.character
        && match[1].length >= fence.length
        && match[2].trim() === '') {
        fence = null;
      }
      kept.push('');
      continue;
    }
    if (/^(?: {4}|\t)/.test(line)) {
      kept.push('');
      continue;
    }
    kept.push(line.replace(/(`+)(.*?)\1/g, ''));
  }
  return kept.join('\n');
}

export function inspectReadme(content, context) {
  const errors = [];
  const warnings = [];
  const renderedContent = stripRenderedCode(content);

  if (/{{\s*[^{}]+\s*}}/.test(renderedContent)) {
    errors.push('Generated output still contains unresolved template tokens');
  }
  errors.push(...inspectManualRegions(content));

  if (context.provider.id === 'bitbucket' && HTML_PATTERN.test(renderedContent)) {
    errors.push('Bitbucket output contains raw HTML, which Bitbucket Cloud does not render in README files');
  } else if (context.modePortable && HTML_PATTERN.test(renderedContent)) {
    warnings.push('Portable output contains raw HTML and may render differently across forges');
  }

  const externalImages = [
    ...renderedContent.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)/g),
    ...renderedContent.matchAll(/<img\b[^>]*\bsrc="(https?:\/\/[^"]+)"/gi),
  ];
  if (externalImages.length > 0) {
    warnings.push(`${externalImages.length} external image(s) can affect privacy or availability`);
  }

  const relativeLinks = [
    ...[...renderedContent.matchAll(RELATIVE_LINK_PATTERN)].map((match) => match[1]),
    ...[...renderedContent.matchAll(/\b(?:href|src)="(?!https?:|mailto:|#|data:)([^"]+)"/gi)].map((match) => match[1]),
  ];
  return { errors, warnings, relativeLinks: [...new Set(relativeLinks)] };
}
