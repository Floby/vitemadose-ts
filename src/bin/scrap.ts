import { DateTime, Interval } from 'luxon'
import { DoctolibCentre, DoctolibScrapper } from '../doctolib/infra/scrapper'
import humanizeDuration from 'humanize-duration'
import { uflatmap } from '../domain/iterators'
import { Issue } from '../domain/Issue'
import Chalk from 'chalk'
import yargs from 'yargs'
import { Créneau } from '../domain/Créneau'
import { LocalFileRepository } from '../infra/LocalFileRepository'
import { Cacher } from '../domain/Cacher'
import { Unpack } from '../domain/types'

const CONCURRENCY = 100

main()
async function main () {
	const from = DateTime.now().startOf('day')
	const range = Interval.fromDateTimes(from, from.plus({ days: 15 }))
	const scrapper = new DoctolibScrapper()

	const repo = new LocalFileRepository<DoctolibCentre, any>('./tmp/scrap')
	const cache = Cacher(repo, () => scrapper.trouverLesCentres())
	const centres = cache(range.start.toISODate())

	let count = 0
	let issue = 0
	const start = Date.now()
	const dates: Record<string, number> = {}
	const weird: Créneau[] = []
	for await (const slot of uflatmap(CONCURRENCY, centres, (centre) => scrapper.trouverLesCréneaux(centre, range))) {
		if (slot instanceof Issue) {
			console.error(Chalk.red('Encountered issue'), Chalk.red.bold(slot.message), slot.meta.error)
			// console.dir(slot.meta.centre)
			// console.dir(slot.meta.json, { depth: null })
			// console.log(slot.meta.e)
			// return process.exit(1)
			++issue
		} else {
			++count
			const date = slot.horaire.toISODate()
			if (date === null) {
				weird.push(slot)
			}
			if (!dates[date]) { dates[date] = 0 }
			dates[date] += 1
		}
	}
	const duration = humanizeDuration(Date.now() - start)
	await new Promise((resolve) => setTimeout(resolve, 1000))
	console.log('Found %d slots in the next %d days and encountered %d issues in %s', count, range.toDuration().as('days'), issue, duration)
	for (const date of Object.keys(dates).sort()) {
		console.log(date, dates[date])
	}
	console.log('weird', weird)
}

async function * take<T> (count: number, source: AsyncIterable<T>): AsyncIterable<T> {
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
