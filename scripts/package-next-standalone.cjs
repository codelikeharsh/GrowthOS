const { cpSync, existsSync, mkdirSync, rmSync } = require('node:fs')
const { join } = require('node:path')

const webRoot = join(__dirname, '..', 'apps', 'web')
const buildRoot = join(webRoot, '.next')
const standaloneRoot = join(buildRoot, 'standalone', 'apps', 'web')
const staticSource = join(buildRoot, 'static')
const staticTarget = join(standaloneRoot, '.next', 'static')
const publicSource = join(webRoot, 'public')
const publicTarget = join(standaloneRoot, 'public')

if (!existsSync(join(standaloneRoot, 'server.js'))) {
  throw new Error('Next.js standalone server output is missing')
}
if (!existsSync(staticSource)) {
  throw new Error('Next.js static output is missing')
}

rmSync(staticTarget, { force: true, recursive: true })
mkdirSync(join(standaloneRoot, '.next'), { recursive: true })
cpSync(staticSource, staticTarget, { recursive: true })

rmSync(publicTarget, { force: true, recursive: true })
if (existsSync(publicSource)) cpSync(publicSource, publicTarget, { recursive: true })
