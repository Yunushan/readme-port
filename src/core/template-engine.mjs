export class TemplateSyntaxError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TemplateSyntaxError';
  }
}

export class MissingTemplateValueError extends Error {
  constructor(paths) {
    super(`Missing template values: ${paths.join(', ')}`);
    this.name = 'MissingTemplateValueError';
    this.paths = paths;
  }
}

function parseTemplate(source) {
  const root = { type: 'root', children: [] };
  const stack = [{ node: root, branch: 'children' }];
  const tokenPattern = /{{\s*([^{}]+?)\s*}}/g;
  let cursor = 0;
  let match;

  const append = (node) => {
    const current = stack.at(-1);
    current.node[current.branch].push(node);
  };

  while ((match = tokenPattern.exec(source)) !== null) {
    if (match.index > cursor) {
      append({ type: 'text', value: source.slice(cursor, match.index) });
    }

    const token = match[1].trim();
    cursor = tokenPattern.lastIndex;

    if (token.startsWith('!')) {
      continue;
    }

    if (token === 'else') {
      const current = stack.at(-1);
      if (!current || !['if', 'unless', 'each'].includes(current.node.type)) {
        throw new TemplateSyntaxError('{{else}} must be inside an if, unless, or each block');
      }
      current.branch = 'elseChildren';
      continue;
    }

    if (token.startsWith('#')) {
      const [command, ...pathParts] = token.slice(1).trim().split(/\s+/);
      if (!['if', 'unless', 'each'].includes(command)) {
        throw new TemplateSyntaxError(`Unknown block helper: ${command}`);
      }
      const path = pathParts.join(' ').trim();
      if (!path) {
        throw new TemplateSyntaxError(`Block helper ${command} requires a value path`);
      }
      const node = { type: command, path, children: [], elseChildren: [] };
      append(node);
      stack.push({ node, branch: 'children' });
      continue;
    }

    if (token.startsWith('/')) {
      const command = token.slice(1).trim();
      if (stack.length === 1) {
        throw new TemplateSyntaxError(`Unexpected closing block: ${command}`);
      }
      const current = stack.pop();
      if (current.node.type !== command) {
        throw new TemplateSyntaxError(
          `Closing block ${command} does not match ${current.node.type}`,
        );
      }
      continue;
    }

    append({ type: 'variable', path: token });
  }

  if (cursor < source.length) {
    append({ type: 'text', value: source.slice(cursor) });
  }

  if (stack.length !== 1) {
    throw new TemplateSyntaxError(`Unclosed ${stack.at(-1).node.type} block`);
  }

  return root.children;
}

function own(object, key) {
  return object !== null
    && typeof object === 'object'
    && Object.prototype.hasOwnProperty.call(object, key);
}

function readPath(value, segments) {
  let current = value;
  for (const segment of segments) {
    if (!own(current, segment)) {
      return { found: false, value: undefined };
    }
    current = current[segment];
  }
  return { found: true, value: current };
}

function resolvePath(path, root, scope) {
  let expression = path.trim();
  if (expression === 'this' || expression === '.') {
    return { found: true, value: scope.value };
  }
  if (expression === '@index') {
    return { found: scope.index !== undefined, value: scope.index };
  }
  if (expression === '@number') {
    return { found: scope.index !== undefined, value: (scope.index ?? 0) + 1 };
  }
  if (expression === '@first') {
    return { found: scope.index !== undefined, value: scope.index === 0 };
  }
  if (expression === '@last') {
    return {
      found: scope.index !== undefined,
      value: scope.index !== undefined && scope.index === scope.length - 1,
    };
  }

  if (expression.startsWith('@root.')) {
    return readPath(root, expression.slice(6).split('.'));
  }

  let targetScope = scope;
  while (expression.startsWith('../')) {
    targetScope = targetScope.parent ?? targetScope;
    expression = expression.slice(3);
  }

  if (expression.startsWith('this.')) {
    return readPath(targetScope.value, expression.slice(5).split('.'));
  }

  const segments = expression.split('.');
  let candidateScope = targetScope;
  while (candidateScope) {
    const candidate = readPath(candidateScope.value, segments);
    if (candidate.found) {
      return candidate;
    }
    candidateScope = candidateScope.parent;
  }
  return readPath(root, segments);
}

function isTruthy(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return Boolean(value);
}

function stringify(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function renderNodes(nodes, root, scope, missing) {
  let output = '';
  for (const node of nodes) {
    if (node.type === 'text') {
      output += node.value;
      continue;
    }

    if (node.type === 'variable') {
      const resolved = resolvePath(node.path, root, scope);
      if (!resolved.found || resolved.value === undefined || resolved.value === null) {
        missing.add(node.path);
      } else {
        output += stringify(resolved.value);
      }
      continue;
    }

    const resolved = resolvePath(node.path, root, scope);
    if (!resolved.found) {
      missing.add(node.path);
    }
    if (node.type === 'each') {
      const collection = resolved.found && Array.isArray(resolved.value) ? resolved.value : [];
      if (collection.length === 0) {
        output += renderNodes(node.elseChildren, root, scope, missing);
      } else {
        collection.forEach((value, index) => {
          output += renderNodes(node.children, root, {
            value,
            index,
            length: collection.length,
            parent: scope,
          }, missing);
        });
      }
      continue;
    }

    const truthy = resolved.found && isTruthy(resolved.value);
    const usePrimary = node.type === 'if' ? truthy : !truthy;
    output += renderNodes(
      usePrimary ? node.children : node.elseChildren,
      root,
      scope,
      missing,
    );
  }
  return output;
}

function normalizeBlankLines(value) {
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  const output = [];
  let fence = null;
  let blankRun = 0;
  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fence) {
        fence = { character: marker[0], length: marker.length };
      } else if (marker[0] === fence.character && marker.length >= fence.length) {
        fence = null;
      }
    }
    if (!fence && line.trim() === '') {
      blankRun += 1;
      if (blankRun > 1) continue;
    } else {
      blankRun = 0;
    }
    output.push(line.replace(/[ \t]+$/g, ''));
  }
  return output.join('\n').trim();
}

export function renderTemplate(source, context, options = {}) {
  if (typeof source !== 'string') {
    throw new TypeError('Template source must be a string');
  }
  const nodes = parseTemplate(source);
  const missing = new Set();
  const output = renderNodes(nodes, context, {
    value: context,
    parent: null,
    index: undefined,
    length: undefined,
  }, missing);

  if (options.strict && missing.size > 0) {
    throw new MissingTemplateValueError([...missing].sort());
  }

  return `${normalizeBlankLines(output)}\n`;
}
