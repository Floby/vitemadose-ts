import { DateTime } from 'luxon'
import humanizeDuration from 'humanize-duration'
import { Issue } from '../domain/Issue'
import Chalk from 'chalk'
import { Créneau } from '../domain/Créneau'
import { DoctolibScrapper } from '../doctolib/infra/scrapper'

main()
async function main () {
	const range = {
		from: DateTime.now().toISODate(),
		to: DateTime.now().plus({ month: 1 }).toISODate()
	}

	const centre = {
		url: process.argv[2],
		id: process.argv[2].split('/').pop()
	}
	const scrapper = new DoctolibScrapper()
	let count = 0
	let issue = 0
	const start = Date.now()
	const dates: Record<string, number> = {}
	const weird: Créneau[] = []
	for await (const slot of scrapper.trouverLesCréneaux(centre, range)) {
		if (slot instanceof Issue) {
			console.error(Chalk.red('Encountered issue'), Chalk.red.bold(slot.message), slot.meta.error)
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
	console.log('Found %d slots and encountered %d issues in %s', count, issue, duration)
	for (const date of Object.keys(dates).sort()) {
		console.log(date, dates[date])
	}
	console.log('weird', weird.slice(0, 3))
}
