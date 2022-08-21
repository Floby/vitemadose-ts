import { DateTime } from 'luxon'
import { AsyncBuffer } from './iterators'
import { Repository } from './Repository'

interface CacherMeta {
	generatedAt: string
}
export function Cacher<T extends object, P extends (...args: any[]) => AsyncIterable<T>> (repository: Repository<T, CacherMeta>, provider: P): (k: string, ...args: Parameters<typeof provider>) => AsyncIterable<T> {
	return async function * get (key: string, ...args: Parameters<P>): AsyncIterable<T> {
		const meta = await repository.meta(key)
		if (meta) {
			return yield * repository.read(key)
		}
		const source = provider(...args)
		const toWrite = new AsyncBuffer<T>(10)
		const writing = repository.write(key, { generatedAt: DateTime.now().toISO() }, toWrite.read())
		for await (const item of source) {
			try {
				await toWrite.write(item)
			} catch (e) {
				console.error('GOT ERROR', e)
			}
			yield item
		}
		toWrite.done()
		await writing
	}
}
