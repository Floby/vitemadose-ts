export async function * lookahead (head = 1, source, mapper) {
	const buffer = []
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

export async function * uflatmap<S, M> (workers = 1, source: AsyncIterable<S>, mapper: (s) => AsyncIterable<M>): AsyncIterable<M> {
	const wip = new Set<Buffer<M>>()
	let done = false

	startMapping()
	while (!done) {
		await delay(2)
		yield * consumeWip()
	}
	while (wip.size > 0) {
		await delay(2)
		yield * consumeWip()
	}

	async function * consumeWip () {
		for (const w of wip) {
			const items = w.flush()
			for (const i of items) yield i
			if (w.isDone()) {
				wip.delete(w)
			}
		}
	}

	async function startMapping () {
		for await (const s of source) {
			while (wip.size >= workers) {
				await delay(5)
			}
			const buffer = new Buffer<M>(10)
			mapInto(s, buffer)
			wip.add(buffer)
		}
		done = true
	}

	async function mapInto (source, buffer) {
		for await (const m of mapper(source)) {
			await buffer.write(m)
		}
		buffer.done()
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

class Buffer<T> {
	private _done = false
	private buffer: T[] = []
	private size: number
	constructor (size = 10) {
		this.size = size
	}

	async write (v: T): Promise<void> {
		while (this.buffer.length >= this.size) {
			await delay(5)
		}
		this.buffer.push(v)
	}

	done () {
		this._done = true
	}

	isDone () {
		return this._done
	}

	flush () {
		const toflush = [...this.buffer]
		this.buffer = []
		return toflush
	}

	async * read () {
		while (!this._done) {
			while (this.buffer.length) {
				yield this.buffer.shift()
			}
			while (this.buffer.length === 0) {
				await delay(5)
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
