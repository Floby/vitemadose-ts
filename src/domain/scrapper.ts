import { Interval } from 'luxon'
import { Créneau } from './Créneau'
import { Issue } from './Issue'

export interface Scrapper<C extends object> {
	trouverLesCentres(): AsyncIterable<C>
	trouverLesCréneaux(centre: C, range: Interval): AsyncIterable<Créneau | Issue>
}
