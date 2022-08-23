import { DurationLike, Interval } from 'luxon'
import { IteratorRepository } from './IteratorRepository'
import { Créneau } from './Créneau'
import { Scrapper } from './scrapper'
import { IterableCache } from './Cacher'

export class CachingScrapper<C extends object> implements Scrapper<C> {
	private cache: IterableCache
	readonly trouverLesCentres: () => AsyncIterable<C>
	readonly trouverLesCréneaux: (centre: C, range: Interval) => AsyncIterable<Créneau>
	constructor (name: string, private repo: IteratorRepository, private source: Scrapper<C>, private policies: Policies) {
		this.cache = new IterableCache(repo)
		this.trouverLesCentres = this.cache.wrap(`${name}-centres`, policies.centres, () => source.trouverLesCentres())
		this.trouverLesCréneaux = source.trouverLesCréneaux.bind(source)
	}
}

export interface Policies {
	centres: DurationLike
}
