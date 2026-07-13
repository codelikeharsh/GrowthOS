'use strict'

const requiredNodeRange = '>=24 <25'
const requiredPnpmRange = '>=11 <12'
const actualNode = process.versions.node
const actualNodeMajor = Number(actualNode.split('.')[0])
const userAgent = process.env.npm_config_user_agent ?? ''
const pnpmMatch = userAgent.match(/pnpm\/(\d+\.\d+\.\d+)/)
const actualPnpm = pnpmMatch?.[1]
const actualPnpmMajor = actualPnpm ? Number(actualPnpm.split('.')[0]) : undefined

if (actualNodeMajor !== 24) {
  console.error(
    `Unsupported Node.js ${actualNode}. zero2one Growth OS requires Node.js ${requiredNodeRange}. ` +
      'Use nvm, fnm, mise, or your version manager before installing dependencies.',
  )
  process.exit(1)
}

if (actualPnpmMajor !== 11) {
  console.error(
    `Unsupported pnpm ${actualPnpm ?? 'unknown'}. zero2one Growth OS requires pnpm ${requiredPnpmRange}. ` +
      'Run: corepack install --global pnpm@11.7.0',
  )
  process.exit(1)
}
