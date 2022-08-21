import Path = require('path')
import makeDir = require('make-dir')
import Del = require('del')
import FS from 'fs/promises'
import { Meta, Repository } from '../domain/Repository'
import split2 from 'split2'

export class LocalFileRepository<I extends object, M extends Meta> implements Repository<I, M> {
	constructor (private directory: string) {}

	async write (key: string, meta: M, source: AsyncIterable<I>): Promise<void> {
		const paths = this.paths(key)
		await makeDir(Path.join(paths.dir))
		await FS.writeFile(paths.meta, JSON.stringify(meta, null, '  '), 'utf8')
		const file = await FS.open(paths.items, 'w')
		const stream = file.createWriteStream()
		for await (const item of source) {
			stream.write(JSON.stringify(item) + '\n')
		}
		stream.end()
	}

	async meta (key: string): Promise<M|null> {
		const paths = this.paths(key)
		try {
			const metaJson = await FS.readFile(paths.meta, 'utf8')
			return JSON.parse(metaJson)
		} catch (e) {
			return null
		}
	}

	async * read (key): AsyncIterable<I> {
		const paths = this.paths(key)
		try {
			const file = await FS.open(paths.items, 'r')
			const stream = file.createReadStream()
			for await (const line of stream.pipe(split2())) {
				const item = JSON.parse(line)
				yield item
			}
		} catch (e) {
			throw Error('no content to read')
		}
	}

	private paths (key: string) {
		const dir = Path.join(this.directory, key)
		const meta = Path.join(dir, 'meta.json')
		const items = Path.join(dir, 'items.jsonl')
		return { dir, meta, items }
	}
}
