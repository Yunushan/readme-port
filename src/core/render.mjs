import { normalizeConfig } from './config.mjs';
import { GENERATED_MARKER, restoreManualRegions } from './manual-regions.mjs';
import { renderTemplate } from './template-engine.mjs';
import { ConfigValidationError, validateConfig } from './validate.mjs';

export function renderReadme({
  templateSource,
  config,
  theme,
  previousContent = '',
  overrides = {},
  strict = true,
}) {
  const validation = validateConfig(config, overrides);
  if (validation.errors.length > 0) {
    throw new ConfigValidationError(validation.errors);
  }

  const context = normalizeConfig(config, theme, overrides);
  const body = renderTemplate(templateSource, context, { strict });
  let content = `${GENERATED_MARKER}\n\n${body}`;
  if (context.options.preserveManualRegions && previousContent) {
    content = restoreManualRegions(content, previousContent);
  }

  return {
    content: content.replace(/\r\n?/g, '\n'),
    context,
    warnings: validation.warnings,
  };
}
