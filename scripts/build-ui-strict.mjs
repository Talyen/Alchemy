import { spawnSync } from 'node:child_process'

const result = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    UI_GUARDRAILS_STRICT: 'true',
  },
})

if (typeof result.status === 'number' && result.status !== 0) {
  process.exit(result.status)
}

if (result.error) {
  console.error(result.error)
  process.exit(1)
}
