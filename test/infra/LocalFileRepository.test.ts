import { collect, toAsyncIt } from '../../src/domain/iterators'
import { ConcreteLocalFileRepository, LocalFileRepository } from '../../src/infra/LocalFileRepository'
import { expect } from 'chai'
import Path = require('path')
import Del = require('del')

describe('LocalFileRepository', () => {
	type Meta = Record<string, string>
	type Item = { id: string, name: string }

	let directory: string
	beforeEach(async () => {
		directory = Path.join(__dirname, randomName())
	})
	let repo: ConcreteLocalFileRepository<Item, Meta>
	beforeEach(() => { repo = new LocalFileRepository(directory).prefix<Item, Meta>('test') })
	afterEach(() => Del(directory))
	context('when no data is present', () => {
		describe('.meta(key)', () => {
			it('resolves null', async () => {
				// Given
				const key = 'aaa'
				// When
				const actual = await repo.meta(key)
				// Then
				expect(actual).to.equal(null)
			})
		})
		describe('.read(key)', () => {
			it('throws', async () => {
				// Given
				const key = 'aaa'
				// When
				try {
					for await (const _ of repo.read(key)) {
						continue
					}
				} catch (e) {
					// Then
					expect(e).to.be.instanceOf(Error)
					expect(e.message).to.include('no content')
					return null
				}
				throw Error('No error was caught')
			})
		})

		describe('.write(key, meta, source)', () => {
			it('resolves undefined', async () => {
				// Given
				const key = 'aaa'
				const meta = { hello: 'goodbye' }
				const source = toAsyncIt([
					{ id: 'a', name: 'A ' },
					{ id: 'b', name: 'B ' },
					{ id: 'c', name: 'C ' }
				])
				// When
				const actual = await repo.write(key, meta, source)
				// Then
				expect(actual).to.equal(undefined)
			})
		})

		describe('when writing a key', () => {
			const key = 'aaa'
			const meta = { hello: 'world' }
			const source = [
				{ id: 'a', name: 'A ' },
				{ id: 'b', name: 'B ' },
				{ id: 'c', name: 'C ' }
			]
			beforeEach(() => repo.write(key, meta, toAsyncIt(source)))

			describe('.meta(key)', () => {
				it('resolves the meta data', async () => {
					// When
					const actual = await repo.meta(key)
					// Then
					expect(actual).to.deep.equal(meta)
				})
			})
			describe('.read(key)', () => {
				it('yields the items', async () => {
					// When
					const actual = await collect(repo.read(key))
					// Then
					expect(actual).to.deep.equal(source)
				})
			})
		})
	})
})

function randomName (size = 6): string {
	const start = 'A'.charCodeAt(0)
	const end = 'Z'.charCodeAt(0) + 1
	const chars: number[] = []
	for (let i = 0; i < size; ++i) {
		chars.push(Math.floor(Math.random() * (end - start)) + start)
	}
	return chars.map((c) => String.fromCharCode(c)).join('')
}
