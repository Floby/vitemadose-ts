import { DateTime, DurationLike } from 'luxon'
import { AsyncBuffer } from './iterators'
import { IteratorRepository } from './IteratorRepository'

interface CachéMeta {
  expiresAt: string
}
export function Caché (repository: IteratorRepository): IterableCache {
	return new IterableCache(repository)
}

export class IterableCache {
	constructor (private repo: IteratorRepository) {}

	wrap<T extends object> (key: string, policy: DurationLike, provider: Provider<T>): (...args: Parameters<typeof provider>) => AsyncIterable<T> {
		const repo = this.repo.prefix<T, CachéMeta>(key)
		return async function * get (...args: Parameters<typeof provider>): AsyncIterable<T> {
			const now = DateTime.now()
			const meta = await repo.meta('current')
			if (meta && DateTime.fromISO(meta.expiresAt) > now) {
				return yield * repo.read('current')
			}
			const source = provider(...args)
			const toWrite = new AsyncBuffer<T>(10)
			const expiresAt = now.plus(policy)
			const writing = repo.write('current', { expiresAt: expiresAt.toISO() }, toWrite.read())
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
}

type Provider<T> = (...args: any[]) => AsyncIterable<T>
