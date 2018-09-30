# ARKIE Node Svg Snapshot

中文 | [English](./docs/en/README.md)

## Installation
```bash
npm i @arkie-ai/svg-snapshot
```
```bash
yarn add @arkie-ai/svg-snapshot
```

## Quick Start

```ts
import { render } from '@arkie-ai/svg-snapshot'

run()

async function run() {
  const { buffer, errors } = await render(svg, width, height)
  errors.forEach(console.error)
  console.log(buffer)
}
```
