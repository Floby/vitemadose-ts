export async function * lookahead<S, M> (head = 1, source: AsyncIterable<S>, mapper: (s: S) => Promise<M>) {
	const buffer: Array<Promise<M>> = []
	for await (const item of source) {
		if (buffer.length >= head) {
			const mapped = await buffer.shift()
			yield mapped
		}
		buffer.push(mapper(item))
	}
	for (const p of buffer) {
		yield (await p)
	}
}

export function uflatmap<S, M> (workers = 1, source: Iterable<S> | AsyncIterable<S>, mapper: (s) => AsyncIterable<M>): AsyncIterable<M> {
	const wip = new Set<Promise<void>>()
	const buffer = new AsyncBuffer<M>()

	startMapping()
	return buffer.read()

	async function startMapping () {
		for await (const s of source) {
			while (wip.size >= workers) {
				await Promise.race(wip)
			}
			const worker = mapFrom(s).then(() => wip.delete(worker))
			wip.add(worker)
		}
		await Promise.all(wip)
		buffer.done()
	}

	async function mapFrom (source) {
		for await (const m of mapper(source)) {
			await buffer.write(m)
		}
	}
}

export function * asyncRange (max) {
	for (let i = 1; i <= max; ++i) {
		yield i
	}
}

export function * step (from = 1, step = 1) {
	let current = from
	while (true) {
		yield current
		current += step
	}
}

export function delay (ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

export class AsyncBuffer<T> {
	private _done = false
	private buffer: T[] = []
	private size: number
	private pendingWrites: Deferred<void>[] = []
	private pendingRead?: Deferred<void>
	constructor (size = 10) {
		this.size = size
	}

	async write (v: T): Promise<void> {
		if (this.buffer.length < this.size) {
			this.buffer.push(v)
			this.pendingRead.resolve()
		} else {
			const d = new Deferred<void>()
			this.pendingWrites.push(d)
			await d.promise
		}
	}

	done () {
		this._done = true
		if (this.pendingRead) this.pendingRead.resolve()
	}

	isDone () {
		return this._done
	}

	flush () {
		const toflush = [...this.buffer]
		this.buffer = []
		for (const _ of toflush) {
			if (this.pendingWrites.length === 0) { break }
			this.pendingWrites.shift().resolve()
		}
		return toflush
	}

	async * read () {
		while (!this._done) {
			while (this.buffer.length) {
				const v = this.buffer.shift()
				if (this.pendingWrites.length) this.pendingWrites.shift().resolve()
				yield v
			}
			if (!this._done) {
				this.pendingRead = new Deferred()
				await this.pendingRead.promise
			}
		}
	}
}

class Deferred<T> {
	readonly promise: Promise<T>
	private _resolve: (v: T) => void
	private _reject: (v) => void
	private _complete = false
	private _error = false

	constructor () {
		this.promise = new Promise((resolve, reject) => {
			this._resolve = resolve
			this._reject = reject
		})
	}

	public resolve (v: T) {
		this._complete = true
		this._resolve(v)
	}

	public reject (reason) {
		this._complete = true
		this._error = true
		this._reject(reason)
	}

	get complete () { return this._complete }
	get error () { return this._error }
}

export async function * toAsyncIt<T> (it: Iterable<T>): AsyncIterable<T> {
	for (const i of it) {
		yield i
	}
}
export async function collect<T> (iterator: AsyncIterable<T>): Promise<Array<T>> {
	const buffer: T[] = []
	for await (const item of iterator) {
		buffer.push(item)
	}
	return buffer
}

export async function * take<T> (count: number, source: AsyncIterable<T>): AsyncIterable<T> {
	let remaining = count
	for await (const item of source) {
		if (remaining > 0) {
			yield item
			remaining--
		} else {
			break
		}
	}
}
