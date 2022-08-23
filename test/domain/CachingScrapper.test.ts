import { expect } from 'chai'
import { ActualIteratorRepository, IteratorRepository } from '../../src/domain/IteratorRepository'
import { collect, toAsyncIt } from '../../src/domain/iterators'
import { Scrapper } from '../../src/domain/scrapper'
import { Créneau } from '../../src/domain/Créneau'
import { CachingScrapper } from '../../src/domain/CachingScrapper'
import ms from 'ms'
import sinon = require('sinon')

type Centre = { id: number }
describe('CachingScrapper(name, repository, scrapper)', () => {
	let repo: InMemoryRepository
	let source: StubScrapper
	let scrapper: Scrapper<Centre>
	const centresSource: Centre[] = [
		{ id: 1 },
		{ id: 2 },
		{ id: 3 }
	]
	beforeEach(() => {
		repo = new InMemoryRepository()
		source = new StubScrapper(centresSource)
		scrapper = new CachingScrapper('test', repo, source, {
			centres: { minutes: 1 }
		})
	})
	describe('.trouverLesCentres()', () => {
		context('when cache is empty', () => {
			it('fetches centers from source', async () => {
				// When
				const actual = await collect(scrapper.trouverLesCentres())
				// Then
				expect(actual).to.deep.equal(centresSource)
			})
		})
		context('when called twice', () => {
			let clock
			beforeEach(() => {
				clock = sinon.useFakeTimers()
			})
			afterEach(() => clock.restore())
			it('yields result from the first run', async () => {
				// Given
				await collect(scrapper.trouverLesCentres())
				const nouveauxCentres: Centre[] = [
					{ id: 5 }
				]
				source.centres = nouveauxCentres
				await clock.tickAsync(ms('30 seconds'))
				// When
				const actual = await collect(scrapper.trouverLesCentres())
				// Then
				expect(actual).to.deep.equal(centresSource)
			})
		})
		context('when called after expiry policy', () => {
			let clock
			beforeEach(() => {
				clock = sinon.useFakeTimers()
			})
			afterEach(() => clock.restore())
			it('calls the source again', async () => {
				// Given
				const first = await collect(scrapper.trouverLesCentres())
				expect(first).to.deep.equal(centresSource)
				const nouveauxCentres: Centre[] = [
					{ id: 5 }
				]
				source.centres = nouveauxCentres
				await clock.tickAsync(ms('2 minutes'))
				// When
				const actual = await collect(scrapper.trouverLesCentres())
				// Then
				expect(actual).to.deep.equal(nouveauxCentres)
			})
		})
	})
})

class InMemoryRepository implements IteratorRepository {
	prefix<T extends object, M extends object> (_: string) {
		return new ArrayRepository<T, M>()
	}
}
class ArrayRepository<T extends object, M extends object> implements ActualIteratorRepository<T, M> {
	private buffer: { [key: string]: { meta: M, items: T[] }} = {}
	async meta (key: string) {
		return this.buffer[key]?.meta || null
	}

	async * read (key: string) {
		const entry = this.buffer[key]
		if (entry) {
			return yield * entry.items
		} else {
			throw Error(`no content for key ${key}`)
		}
	}

	async write (key: string, meta: M, source: AsyncIterable<T>) {
		const items = await collect(source)
		this.buffer[key] = { meta, items }
	}
}

class StubScrapper implements Scrapper<Centre> {
	constructor (public centres: Centre[], public créneaux: {[key: number]: Créneau[] } = {}) {
	}

	trouverLesCentres () {
		return toAsyncIt(this.centres)
	}

	trouverLesCréneaux (centre: Centre) {
		return toAsyncIt(this.créneaux[centre.id] || [])
	}
}
