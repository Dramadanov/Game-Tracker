// Desktop smoke test: drives the real Tauri app (WebKitGTK on Linux) through tauri-driver
// to prove the SQLite plugin, migrations and persistence work outside the browser build.
//
// Prerequisites (Linux): webkit2gtk-driver, xvfb, `cargo install tauri-driver`, and a build:
//   npx tauri build --debug --no-bundle
// Run:
//   xvfb-run -a node tests/desktop/smoke.mjs
//
// Uses raw W3C WebDriver calls (no extra npm dependencies).
import { spawn } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const APP = resolve('src-tauri/target/debug/game-tracker')
const DATA_DIR = join(homedir(), '.config', 'io.github.dramadanov.gametracker')
const DRIVER = 'http://127.0.0.1:4444'
const TITLE = `Smoke Test Game ${process.pid}`

if (!existsSync(APP)) {
  console.error(`App binary not found at ${APP}. Build it first: npx tauri build --debug --no-bundle`)
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function wd(method, path, body) {
  const init = { method, headers: { 'content-type': 'application/json' } }
  if (body !== undefined) init.body = JSON.stringify(body)
  const res = await fetch(DRIVER + path, init)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json.value ?? json)}`)
  return json.value
}

const ELEMENT = 'element-6066-11e4-a6c6-4665636f6e74'

async function newSession() {
  const value = await wd('POST', '/session', {
    capabilities: { alwaysMatch: { 'tauri:options': { application: APP } } },
  })
  return value.sessionId
}

async function waitFor(session, css, timeout = 20000) {
  const end = Date.now() + timeout
  let lastError
  while (Date.now() < end) {
    try {
      const el = await wd('POST', `/session/${session}/element`, { using: 'css selector', value: css })
      // W3C key, with a fallback for drivers that use another key name.
      return el[ELEMENT] ?? Object.values(el)[0]
    } catch (error) {
      lastError = error
      await sleep(250)
    }
  }
  throw new Error(`Timed out waiting for ${css}: ${lastError?.message}`)
}

async function run(session, script, args = []) {
  return wd('POST', `/session/${session}/execute/sync`, { script, args })
}

async function click(session, css) {
  const id = await waitFor(session, css)
  await wd('POST', `/session/${session}/element/${id}/click`, {})
}

async function type(session, css, text) {
  const id = await waitFor(session, css)
  await wd('POST', `/session/${session}/element/${id}/value`, { text })
}

async function bodyText(session) {
  return run(session, 'return document.body.innerText')
}

function check(condition, message) {
  if (!condition) throw new Error(`FAILED: ${message}`)
  console.log(`  ✓ ${message}`)
}

// Fresh data folder so the test is repeatable.
rmSync(DATA_DIR, { recursive: true, force: true })

const driver = spawn('tauri-driver', [], { stdio: ['ignore', 'inherit', 'inherit'] })
let session
try {
  await sleep(1500)

  console.log('Launch 1: add a game')
  session = await newSession()
  await waitFor(session, '.app')
  check((await bodyText(session)).includes('Start your watchlist'), 'empty library on first launch')
  await click(session, '[data-testid=toolbar-add-game]')
  await waitFor(session, '#editor-title')
  await type(session, '#editor-title', TITLE)
  await click(session, '[data-testid=editor-save]')
  await sleep(800)
  check((await bodyText(session)).includes(TITLE), 'new game shows in the library')
  await wd('DELETE', `/session/${session}`)
  session = undefined

  check(existsSync(join(DATA_DIR, 'gametracker.db')), `database file created in ${DATA_DIR}`)

  console.log('Launch 2: data survived a restart')
  session = await newSession()
  await waitFor(session, '.app')
  await sleep(500)
  check((await bodyText(session)).includes(TITLE), 'game is still there after restart')
  await wd('DELETE', `/session/${session}`)
  session = undefined

  console.log('Desktop smoke test passed.')
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  if (session) await wd('DELETE', `/session/${session}`).catch(() => {})
  driver.kill()
}
