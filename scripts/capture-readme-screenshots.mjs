import { mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { chromium, devices } from '@playwright/test'

const baseUrl = 'http://127.0.0.1:4273'
const outputDir = 'public/screenshots'
const previewCommand = 'node_modules/.bin/vite'
const previewArgs = ['preview', '--host', '127.0.0.1', '--port', '4273']

const waitForServer = async (url, timeoutMs = 30_000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    } catch {
      // Keep polling until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for preview server at ${url}`)
}

const run = async () => {
  await mkdir(outputDir, { recursive: true })

  const preview = spawn(previewCommand, previewArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })

  preview.stdout.on('data', (chunk) => process.stdout.write(chunk))
  preview.stderr.on('data', (chunk) => process.stderr.write(chunk))

  try {
    await waitForServer(baseUrl)

    const browser = await chromium.launch()
    const context = await browser.newContext({
      ...devices['iPhone 13'],
    })
    const page = await context.newPage()

    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    await page.evaluate(() => window.localStorage.clear())
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /start new session/i }).waitFor()
    await page.screenshot({
      path: `${outputDir}/session-start.png`,
      fullPage: true,
    })

    await page.getByRole('button', { name: /start new session/i }).click()
    await page.getByRole('button', { name: /options/i }).waitFor()
    await page.screenshot({
      path: `${outputDir}/session-active.png`,
      fullPage: true,
    })

    await page.getByRole('button', { name: /options/i }).click()
    await page.getByRole('button', { name: /back to exercise/i }).waitFor()
    await page.screenshot({
      path: `${outputDir}/session-options.png`,
      fullPage: true,
    })

    await browser.close()
  } finally {
    preview.kill('SIGTERM')
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
