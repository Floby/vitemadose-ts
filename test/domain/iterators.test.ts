import { expect } from 'chai'
import { uflatmap } from '../../src/domain/iterators'

describe('uflatmap(workers, source, mapper)', () => {
	context('when source is empty', () => {
		it('returns an empty iterable', async () => {
			// Given
			const source = aiter([])
			const mapper = (a) => a
			// When
			const actual = await collect(uflatmap(1, source, mapper))
			// Then
			expect(actual).to.deep.equal([])
		})
	})
	context('when source has one element', () => {
		it('returns an iterable with the mapper contents', async () => {
			// Given
			const source = aiter([1])
			async function * mapper (i: number) {
				yield i * 1
				yield i * 2
				yield i * 3
			}
			// When
			const actual = await collect(uflatmap(1, source, mapper))
			// Then
			expect(actual).to.deep.equal([1, 2, 3])
		})
	})
	context('when source has 2 elements', () => {
		it('returns an iterable with the mapper contents for each element', async () => {
			// Given
			const source = aiter([1, 3])
			async function * mapper (i: number) {
				yield i * 1
				yield i * 2
			}
			// When
			const actual = await collect(uflatmap(1, source, mapper))
			// Then
			expect(actual).to.deep.equal([1, 2, 3, 6])
		})
	})
	context('when mapper takes different times for each mapping', () => {
		it('returns an iterable with the mapper contents for each element in arriving order', async () => {
			// Given
			const source = aiter([10, 8])
			async function * mapper (i: number) {
				await delay(i * 10)
				yield i * 1
				await delay(i * 10)
				yield i * 2
			}
			// When
			const actual = await collect(uflatmap(2, source, mapper))
			// Then
			expect(actual).to.deep.equal([8, 10, 16, 20])
		})
		it('does not suffer HOL blocking', async () => {
			// Given
			const source = aiter([20, 1, 2])
			async function * mapper (i: number) {
				await delay(i)
				yield i
				await delay(i)
				yield i
			}
			// When
			const actual = await collect(uflatmap(2, source, mapper))
			// Then
			expect(actual).to.deep.equal([1, 1, 2, 2, 20, 20])
		})
	})
})

async function collect<T> (iterator: AsyncIterable<T>): Promise<Array<T>> {
	const buffer: T[] = []
	for await (const item of iterator) {
		buffer.push(item)
	}
	return buffer
}

async function * aiter<T> (source: T[]): AsyncIterable<T> {
	for (const i of source) {
		yield i
	}
}

async function delay (ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
