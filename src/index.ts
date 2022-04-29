import {Options, transform} from '@swc/core'
import {Plugin} from 'rollup'
import {createFilter, FilterPattern} from '@rollup/pluginutils'
import { dirname, isAbsolute, join, resolve } from 'path'
import { promises as fs } from 'fs'

type SWCPluginOptions<O = Options> = Pick<O, Exclude<keyof O, 'filename'>>

type RollupOptions = {
  rollup?: {
    include: FilterPattern
    exclude: FilterPattern
  }
}

type PluginOptions = SWCPluginOptions & RollupOptions

type RollupPluginSWC = (options?: PluginOptions) => Plugin

const resolveFilename = async (
  basename: string
): Promise<string | null> => {
  for (const extension of ['js', 'jsx', 'ts', 'tsx']) {
    const possibleFilename = `${basename}.${extension}`
    try {
      await fs.access(possibleFilename)
      return possibleFilename
    } catch {}
  }
  return null
}

const swc: RollupPluginSWC = (pluginOptions = {}) => {
  const {rollup, ...options} = pluginOptions

  const filter = createFilter(rollup?.include, rollup?.exclude)

  return {
    name: 'swc',
    async resolveId(source, importer) {
      if (importer === undefined || !(source.startsWith('.') || isAbsolute(source))) {
        return null
      }
      const filename = resolve(dirname(importer), source)
      try {
        return (await fs.stat(filename)).isDirectory()
          ? await resolveFilename(join(filename, 'index'))
          : filename
      } catch {
        return await resolveFilename(filename)
      }
    },
    transform(code, filename) {
      if (!filter(filename)) {
        return null
      }

      (options as SWCPluginOptions & {filename: string}).filename = filename
      return transform(code, options)
    },
  }
}

export default swc
