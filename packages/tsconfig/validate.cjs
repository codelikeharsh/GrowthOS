'use strict'

const { readFileSync } = require('node:fs')

for (const file of ['base.json', 'node.json', 'nextjs.json']) {
  JSON.parse(readFileSync(file, 'utf8'))
}
