import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDirectory = fileURLToPath(new URL('../', import.meta.url))
const runtimeAssets = [
  'server/config/cfr-authorization-reference.mjs',
]

for (const relativePath of runtimeAssets) {
  const sourcePath = path.join(rootDirectory, relativePath)
  const outputPath = path.join(rootDirectory, 'build', relativePath)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await copyFile(sourcePath, outputPath)
}
