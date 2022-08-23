import { Interval } from 'luxon'
import { Créneau } from './Créneau'
import { Issue } from './Issue'
import { uflatmap } from './iterators'
import { Scrapper } from './scrapper'

export function Scrap<C extends object> (workers = 1, scrapper: Scrapper<C>): (range: Interval) => AsyncIterable<Créneau | Issue> {
	return function (range: Interval): AsyncIterable<Créneau | Issue> {
		return uflatmap(workers, scrapper.trouverLesCentres(), (c: C) => scrapper.trouverLesCréneaux(c, range))
	}
}
