import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MissingTemplateValueError,
  TemplateSyntaxError,
  renderTemplate,
} from '../src/core/template-engine.mjs';

test('renders variables, conditions, loops, indices, and parent values', () => {
  const source = `
# {{title}}
{{#if active}}ready{{else}}waiting{{/if}}
{{#each items}}{{@number}}. {{this.name}} / {{../title}}{{#unless this.done}} pending{{/unless}}\n{{/each}}
`;
  const result = renderTemplate(source, {
    title: 'Demo',
    active: true,
    items: [
      { name: 'One', done: true },
      { name: 'Two', done: false },
    ],
  }, { strict: true });
  assert.match(result, /# Demo/);
  assert.match(result, /ready/);
  assert.match(result, /1\. One \/ Demo/);
  assert.match(result, /2\. Two \/ Demo pending/);
});

test('renders each else branch for an empty collection', () => {
  const result = renderTemplate('{{#each values}}{{this}}{{else}}none{{/each}}', { values: [] }, { strict: true });
  assert.equal(result, 'none\n');
});

test('reports missing variables in strict mode', () => {
  assert.throws(
    () => renderTemplate('{{present}} {{missing.value}}', { present: 'yes' }, { strict: true }),
    (error) => error instanceof MissingTemplateValueError && error.paths.includes('missing.value'),
  );
});

test('allows missing values in non-strict mode', () => {
  assert.equal(renderTemplate('hello {{missing}}', {}, { strict: false }), 'hello\n');
});

test('rejects mismatched blocks', () => {
  assert.throws(
    () => renderTemplate('{{#if value}}x{{/each}}', { value: true }),
    TemplateSyntaxError,
  );
});

test('strict mode reports missing conditional and loop paths', () => {
  assert.throws(
    () => renderTemplate('{{#if misspelled}}x{{/if}}', {}, { strict: true }),
    MissingTemplateValueError,
  );
  assert.throws(
    () => renderTemplate('{{#each misspelled}}{{this}}{{/each}}', {}, { strict: true }),
    MissingTemplateValueError,
  );
});
