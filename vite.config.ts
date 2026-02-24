import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import terser from '@rollup/plugin-terser'
import ts from 'typescript'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

const terserPlugin = terser({
  compress: {
    drop_debugger: true,
  },
  mangle: true,
  format: {
    comments: false,
  },
})

function genGlobalDts() {
  const dtsPath = resolve(__dirname, 'dist/index.d.ts')
  const configPath = ts.findConfigFile(__dirname, ts.sys.fileExists, 'tsconfig.json')!
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
  const { options } = ts.parseJsonConfigFileContent(configFile.config, ts.sys, __dirname)

  const program = ts.createProgram([dtsPath], { ...options, noEmit: true })
  const checker = program.getTypeChecker()
  const sf = program.getSourceFile(dtsPath)
  if (!sf) return

  const mod = checker.getSymbolAtLocation(sf)
  if (!mod) return

  const entries: { name: string; tpDecl: string; tpUsage: string }[] = []

  for (const sym of checker.getExportsOfModule(mod)) {
    const isAlias = (sym.flags & ts.SymbolFlags.Alias) !== 0
    const resolved = isAlias ? checker.getAliasedSymbol(sym) : sym
    const decls = resolved.getDeclarations()
    if (!decls?.length) continue

    const decl = decls[0]
    const isIface = ts.isInterfaceDeclaration(decl)
    const isType = ts.isTypeAliasDeclaration(decl)
    const isEnum = ts.isEnumDeclaration(decl)
    const isClass = ts.isClassDeclaration(decl)

    if (!isIface && !isType && !isEnum && !(isClass && isAlias)) continue

    const name = sym.getName()
    const tp =
      (isIface || isType || isClass) &&
      'typeParameters' in decl &&
      (decl as ts.InterfaceDeclaration).typeParameters?.length
        ? (decl as ts.InterfaceDeclaration).typeParameters!
        : undefined

    let tpDecl = ''
    let tpUsage = ''
    if (tp) {
      const declFile = decl.getSourceFile()
      const params = tp.map((p) => {
        const n = p.name.text
        const c = p.constraint ? ` extends ${p.constraint.getText(declFile)}` : ''
        const d = p.default ? ` = ${p.default.getText(declFile)}` : ''
        return { n, full: `${n}${c}${d}` }
      })
      tpDecl = `<${params.map((p) => p.full).join(', ')}>`
      tpUsage = `<${params.map((p) => p.n).join(', ')}>`
    }

    entries.push({ name, tpDecl, tpUsage })
  }

  entries.sort((a, b) => a.name.localeCompare(b.name))

  const output = [
    'declare global {',
    ...entries.map(
      (e) => `  type ${e.name}${e.tpDecl} = import('${pkg.name}').${e.name}${e.tpUsage}`,
    ),
    '}',
    '',
    'export {}',
    '',
  ].join('\n')

  writeFileSync(resolve(__dirname, 'dist/global.d.ts'), output)
  console.log(`global.d.ts: ${entries.length} types generated`)
}

export default defineConfig({
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    dts({
      rollupTypes: true,
      tsconfigPath: './tsconfig.json',
      afterBuild: genGlobalDts,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: 'index',
    },
    rollupOptions: {
      external: Object.keys(pkg.dependencies || {}),
      output: {
        globals: {},
        plugins: [terserPlugin],
      },
    },
    sourcemap: true,
    minify: false,
  },
})
