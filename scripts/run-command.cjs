const { spawn } = require('node:child_process')

const [command, ...args] = process.argv.slice(2)

if (!command) throw new Error('A command is required')

const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exitCode = code ?? 1
})
