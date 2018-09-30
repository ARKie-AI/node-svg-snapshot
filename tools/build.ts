// tslint:disable no-console
import * as sh from 'shelljs'
import * as fs from 'fs'
import * as path from 'path'
import * as util from 'util'
import * as readdir from 'readdir-enhanced'
import javascriptStringify = require('javascript-stringify')

const fsReadfile = util.promisify(fs.readFile)
const fsWritefile = util.promisify(fs.writeFile)

if (require.main === module) {
  run(main)
}

export async function main() {
  await compare()
}

export async function compare() {
  const tmp = path.resolve(process.cwd(), `tmp`)

  sh.rm('-rf', tmp)
  sh.cp('-r', 'src', tmp)
  try {
    const files = await readdir.async(tmp, { deep: true, filter: (stats) => stats.isFile() })

    await transform(tmp, files)

    sh.rm('-rf', 'lib')
    exec(`tsc --pretty -p ${tmp}/tsconfig.json`)
  } finally {
    sh.rm('-rf', tmp)
  }
}

export async function transform(root: string, files: string[]) {
  const variables = getVariables()

  await Promise.all(files.map(async (file) => {
    // skip non js/ts files
    if (!file.match(/\.(j|t)sx?$/)) return

    // skip .d.ts files
    if (file.match(/\.d\.ts$/)) return

    const filepath = path.join(root, file)
    const buffer = await fsReadfile(filepath)
    const source = buffer.toString()
    let code = source

    // replace global variables
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g')
      const replacement = javascriptStringify(value, undefined, 2)
      code = code.replace(regex, replacement)
    }

    if (source === code) return

    await fsWritefile(filepath, code)
  }))
}

export function getVariables() {
  const packageJson = require(path.resolve(process.cwd(), 'package.json'))
  const commit = (sh.exec(`git rev-parse --short HEAD`, { silent: true }).stdout as string).trim()

  return {
    __VERSION__: packageJson.version as string,
    __COMMIT__: commit as string,
  }
}

export function exec(command: string) {
  const { code, stderr, stdout } = sh.exec(command)
  if (code !== 0) throw stderr
  return stdout
}

export async function run(fn: Function) {
  try {
    await fn()
    process.exit(0)
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}
