import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as api from './index.js';

// M1-T07: locks the public surface of @minesweeper/engine.
//
// What it guards: every name exported from `index.ts`, with its kind and signature, and the shape of every
// type (so `Command`, `GameEvent`, `GameView` and the rest cannot change without a visible diff in review).
// The text is produced by the TypeScript compiler API from the real source and compared with the committed
// file `__snapshots__/api-surface.txt`. Comments and member order do not matter; names, kinds and types do.
//
// Reading the file: `typescript` is a root devDependency and is used here, in a test, only. The engine
// itself still imports nothing project-internal and no Node API (CLAUDE.md, rule 7). The test finds the
// source through `expect.getState().testPath`, because the engine has no Node types and no DOM lib, so
// `import.meta` and `process` are not available to it.
//
// Accepting an intended change: `pnpm exec vitest run --project engine -u`, then read the diff of the
// snapshot file. In CI a missing or different snapshot fails the run; it is never written there.

const SNAPSHOT_FILE = './__snapshots__/api-surface.txt';

// Names that exist inside the engine on purpose but are not public API. If one of them reaches `index.ts`,
// this list gives a clear failure before the snapshot diff does. `m0SampleAdd` is the removed M0 scaffolding.
const NOT_PUBLIC = [
  'm0SampleAdd',
  'GameEventEmitter',
  'buildGameView',
  'CELL_HIDDEN',
  'CELL_REVEALED',
  'CELL_FLAGGED',
  'revealCell',
  'RevealResult',
  'chordCells',
  'ChordResult',
  'openingZone',
  'MAX_REPLAY_COMMANDS',
] as const;

const FORMAT =
  ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

/** One exported name, as the compiler sees it. */
interface ExportedName {
  readonly name: string;
  /** `value` exists at runtime (class, function, constant); `type` is erased. */
  readonly kind: 'value' | 'type';
  readonly lines: readonly string[];
  readonly internal: boolean;
}

/** Directory of this test file, which is `packages/engine/src`, with forward slashes on every OS. */
function sourceDirectory(): string {
  const testPath = expect.getState().testPath;
  if (testPath === undefined) throw new Error('Vitest did not provide the path of this test file');
  const normalized = testPath.replaceAll('\\', '/');
  return normalized.slice(0, normalized.lastIndexOf('/'));
}

/** A compiler program over `index.ts`, with the engine's own tsconfig options but nothing emitted. */
function createEngineProgram(sourceDir: string): ts.Program {
  const packageDir = sourceDir.slice(0, sourceDir.lastIndexOf('/'));
  const config = ts.readConfigFile(`${packageDir}/tsconfig.json`, ts.sys.readFile);
  if (config.error !== undefined) throw new Error('Cannot read packages/engine/tsconfig.json');
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, packageDir);
  return ts.createProgram({
    rootNames: [`${sourceDir}/index.ts`],
    options: {
      ...parsed.options,
      composite: false,
      incremental: false,
      declaration: false,
      declarationMap: false,
      sourceMap: false,
      noEmit: true,
    },
  });
}

/** Renders one member of a class or interface; private members are not part of the API. */
function describeMember(checker: ts.TypeChecker, member: ts.Symbol, prefix: string): string[] {
  const declaration = member.valueDeclaration ?? member.declarations?.[0];
  if (declaration === undefined) throw new Error(`Member ${member.name} has no declaration`);
  const nameNode = ts.getNameOfDeclaration(declaration);
  const flags = ts.getCombinedModifierFlags(declaration);
  if (flags & ts.ModifierFlags.Private || (nameNode && ts.isPrivateIdentifier(nameNode))) return [];

  const type = checker.getTypeOfSymbolAtLocation(member, declaration);
  const modifiers =
    (flags & ts.ModifierFlags.Protected ? 'protected ' : '') +
    (prefix.length > 0 ? `${prefix} ` : '');
  if (member.flags & ts.SymbolFlags.Method) {
    return checker
      .getSignaturesOfType(type, ts.SignatureKind.Call)
      .map(
        (signature) =>
          `${modifiers}${member.name}${checker.signatureToString(signature, declaration, FORMAT)}`,
      );
  }
  const readonly =
    flags & ts.ModifierFlags.Readonly ||
    (member.flags & ts.SymbolFlags.GetAccessor && !(member.flags & ts.SymbolFlags.SetAccessor))
      ? 'readonly '
      : '';
  const optional = member.flags & ts.SymbolFlags.Optional ? '?' : '';
  return [
    `${modifiers}${readonly}${member.name}${optional}: ${checker.typeToString(type, declaration, FORMAT)}`,
  ];
}

/**
 * Members that `owner` declares itself, sorted by name so that reordering them is not a change of the API.
 * Inherited members (such as `message` and `stack` from `Error`) are left out: they depend on the TypeScript
 * lib in use, and `extends` in the heading already records the inheritance.
 */
function describeMembers(
  checker: ts.TypeChecker,
  owner: ts.Symbol,
  type: ts.Type,
  prefix = '',
): string[] {
  const ownerDeclarations = new Set<ts.Node>(owner.declarations ?? []);
  return checker
    .getPropertiesOfType(type)
    .filter((member) => member.name !== 'prototype')
    .filter((member) => member.declarations?.some((d) => ownerDeclarations.has(d.parent)))
    .flatMap((member) => describeMember(checker, member, prefix))
    .sort()
    .map((line) => `  ${line}`);
}

/** ` extends A, B` for a class or interface that has base types, otherwise an empty string. */
function describeBases(checker: ts.TypeChecker, symbol: ts.Symbol): string {
  const declared = checker.getDeclaredTypeOfSymbol(symbol) as ts.InterfaceType;
  const bases = checker.getBaseTypes(declared).map((base) => checker.typeToString(base));
  return bases.length > 0 ? ` extends ${bases.join(', ')}` : '';
}

/** Renders one export of `index.ts`. An export of a kind this renderer does not know fails loudly. */
function describeExport(checker: ts.TypeChecker, exported: ts.Symbol): ExportedName {
  const symbol =
    exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
  const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
  if (declaration === undefined) throw new Error(`Export ${exported.name} has no declaration`);
  const name = exported.name;
  const internal = symbol.getJsDocTags(checker).some((tag) => tag.name === 'internal');

  if (symbol.flags & ts.SymbolFlags.Class) {
    const constructorType = checker.getTypeOfSymbolAtLocation(symbol, declaration);
    const constructors = checker
      .getSignaturesOfType(constructorType, ts.SignatureKind.Construct)
      .map(
        (signature) =>
          `  ${checker.signatureToString(signature, declaration, FORMAT, ts.SignatureKind.Construct)}`,
      );
    const lines = [
      `class ${name}${describeBases(checker, symbol)}`,
      ...constructors,
      ...describeMembers(checker, symbol, constructorType, 'static'),
      ...describeMembers(checker, symbol, checker.getDeclaredTypeOfSymbol(symbol)),
    ];
    return { name, kind: 'value', lines, internal };
  }
  if (symbol.flags & ts.SymbolFlags.Function) {
    const signatures = checker
      .getSignaturesOfType(
        checker.getTypeOfSymbolAtLocation(symbol, declaration),
        ts.SignatureKind.Call,
      )
      .map(
        (signature) =>
          `function ${name}${checker.signatureToString(signature, declaration, FORMAT)}`,
      );
    return { name, kind: 'value', lines: signatures, internal };
  }
  if (symbol.flags & ts.SymbolFlags.Variable) {
    const type = checker.typeToString(
      checker.getTypeOfSymbolAtLocation(symbol, declaration),
      declaration,
      FORMAT,
    );
    return { name, kind: 'value', lines: [`const ${name}: ${type}`], internal };
  }
  if (symbol.flags & ts.SymbolFlags.Interface) {
    const type = checker.getDeclaredTypeOfSymbol(symbol);
    return {
      name,
      kind: 'type',
      lines: [
        `interface ${name}${describeBases(checker, symbol)}`,
        ...describeMembers(checker, symbol, type),
      ],
      internal,
    };
  }
  if (symbol.flags & ts.SymbolFlags.TypeAlias) {
    const type = checker.getDeclaredTypeOfSymbol(symbol);
    const text = checker.typeToString(type, declaration, FORMAT | ts.TypeFormatFlags.InTypeAlias);
    return { name, kind: 'type', lines: [`type ${name} = ${text}`], internal };
  }
  throw new Error(`Export ${name} has a kind that api-surface.test.ts cannot render yet`);
}

let cached: { readonly names: readonly ExportedName[]; readonly text: string } | undefined;

/** Every export of `index.ts`, sorted by name, and the text that goes into the snapshot file. */
function publicSurface(): { readonly names: readonly ExportedName[]; readonly text: string } {
  if (cached !== undefined) return cached;
  const program = createEngineProgram(sourceDirectory());
  const checker = program.getTypeChecker();
  const entry = program.getSourceFile(`${sourceDirectory()}/index.ts`);
  const moduleSymbol = entry === undefined ? undefined : checker.getSymbolAtLocation(entry);
  if (moduleSymbol === undefined) throw new Error('Cannot read src/index.ts as a module');
  const names = checker
    .getExportsOfModule(moduleSymbol)
    .map((exported) => describeExport(checker, exported))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const header = [
    '# Public API of @minesweeper/engine, rendered from src/index.ts by api-surface.test.ts.',
    '# Only the names below are public. To accept an intended change: pnpm exec vitest run --project engine -u',
  ].join('\n');
  const text = `${[header, ...names.map((entryName) => entryName.lines.join('\n'))].join('\n\n')}\n`;
  cached = { names, text };
  return cached;
}

describe('public API surface of @minesweeper/engine', () => {
  it('matches the committed snapshot of names, kinds and type shapes', async () => {
    await expect(publicSurface().text).toMatchFileSnapshot(SNAPSHOT_FILE);
  });

  it('exports at runtime exactly the names that the declarations call values', () => {
    const declared = publicSurface()
      .names.filter((entry) => entry.kind === 'value')
      .map((entry) => entry.name);
    expect(Object.keys(api).sort()).toEqual(declared);
  });

  it('keeps internals and removed scaffolding out of index.ts', () => {
    const exported = new Set(publicSurface().names.map((entry) => entry.name));
    const leaked = NOT_PUBLIC.filter((name) => exported.has(name));
    expect(leaked).toEqual([]);
  });

  it('has no exported name tagged @internal, which would hide it from the API reference', () => {
    // TypeDoc runs with `excludeInternal`, so an `@internal` tag on a public name would silently drop it
    // from the reference. Lint also exempts `@internal` symbols from the `@example` rule (M0-T07).
    const hidden = publicSurface()
      .names.filter((entry) => entry.internal)
      .map((entry) => entry.name);
    expect(hidden).toEqual([]);
  });
});
