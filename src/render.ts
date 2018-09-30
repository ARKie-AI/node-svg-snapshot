import * as puppeteer from 'puppeteer'
import * as os from 'os'

export type RenderError =
  | RenderUncaughtError
  | RenderRequestError

export interface RenderUncaughtError {
  type: 'uncaught error'
  message: string
}

export interface RenderRequestError {
  type: 'request error'
  request: puppeteer.Request
}

const LAUNCH_OPTIONS: puppeteer.LaunchOptions = {
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
  ],
  executablePath: process.env.LOCAL_CHROME_EXECUTABLE_PATH || undefined,
  ignoreHTTPSErrors: true,
}

export async function render(svg: string, width: number, height: number) {
  return pool.run(async page => renderWithPage(page, svg, width, height))
}

async function renderWithPage(page: puppeteer.Page, svg: string, width: number, height: number) {
  const errors: RenderError[] = []

  page.on('pageerror', message => {
    errors.push({ type: 'uncaught error', message })
  })

  page.on('requestfailed', request => {
    errors.push({ type: 'request error', request })
  })

  await page.setViewport({ width, height })

  const html = `<html><head></head><body>${svg}</body></html>`

  await page.goto(`data:text/html,${html}`, { waitUntil: 'networkidle0' })

  const buffer = await page.screenshot({ encoding: 'binary' })

  return { buffer, errors }
}

interface Resolvable<T> {
  resolve(result: T | PromiseLike<T>): any
  reject(error: any): any
}

class StaticPool {
  protected available = new Set<puppeteer.Page>()
  protected requests = new Set<Resolvable<puppeteer.Page>>()

  constructor(
    readonly size = os.cpus().length,
  ) {
    times(size, () => this.createPage())
  }

  async run<R>(fn: (page: puppeteer.Page) => R) {
    const page = await this.getPage()
    try {
      return await fn(page)
    } finally {
      this.putBackPage(page)
    }
  }

  protected getPage() {
    const { available } = this
    if (available.size) {
      return shift(available)!
    }
    return new Promise<puppeteer.Page>((resolve, reject) => {
      this.requests.add({ resolve, reject })
    })
  }

  protected putBackPage(page: puppeteer.Page) {
    const { requests } = this
    if (requests.size) {
      const { resolve } = shift(requests)!
      resolve(page)
      return
    }
    this.available.add(page)
  }

  protected async createPage() {
    const browser = await puppeteer.launch(LAUNCH_OPTIONS)
    const page = await browser.newPage()
    this.putBackPage(page)
  }
}

const pool = new StaticPool()

function shift<T>(set: Set<T>) {
  for (const item of set) {
    set.delete(item)
    return item
  }
  return
}

function times<T>(n: number, fn: (i: number) => T): T[] {
  const result: T[] = []
  for (let i = 0; i < n; i++) {
    result.push(fn(i))
  }
  return result
}
