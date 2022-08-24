/* eslint-disable no-console */
import { DateTime, Interval } from 'luxon'
import { DoctolibScrapper } from '../doctolib/infra/scrapper'
import humanizeDuration from 'humanize-duration'
import { Issue } from '../domain/Issue'
import Chalk from 'chalk'
import { Créneau } from '../domain/Créneau'
import { LocalFileRepository } from '../infra/LocalFileRepository'
import { CachingScrapper } from '../domain/CachingScrapper'
import { Scrap } from '../domain/Scrap'
import Debug from 'debug'
import CONFIG, { needsHelp } from '../config'

main()
async function main () {
	if (needsHelp()) {
		console.log(CONFIG.helpString())
		process.exit()
	}
	const from = DateTime.now().startOf('day')
	const range = Interval.fromDateTimes(from, from.plus({ days: 15 }))
	const repo = new LocalFileRepository('./tmp/scrap')
	const créneaux = Scrap(CONFIG.get('CONCURRENCY'), new CachingScrapper('doctolib', repo, new DoctolibScrapper(), { centres: { hours: 6 } }))

	let count = 0
	let issue = 0
	const group = 500
	const start = Date.now()
	const dates: Record<string, number> = {}
	const weird: Créneau[] = []
	for await (const créneau of créneaux(range)) {
		if (créneau instanceof Issue) {
			Debug('scrap')(Chalk.red('Encountered issue'), Chalk.red.bold(créneau.message), créneau.meta.error)
			++issue
			process.stdout.write(Chalk.red('x'))
		} else {
			++count
			const date = créneau.horaire.toISODate()
			if (date === null) {
				weird.push(créneau)
			}
			if (!dates[date]) { dates[date] = 0 }
			dates[date] += 1
			if (count % group === 0) { process.stdout.write('.') }
		}
		if ((count / group + issue) % 80 === 0) { process.stdout.write('\n') }
	}
	process.stdout.write('\n')
	const duration = humanizeDuration(Date.now() - start)
	await new Promise((resolve) => setTimeout(resolve, 1000))
	console.log('Found %d slots in the next %d days and encountered %d issues in %s', count, Math.floor(range.toDuration().as('days')), issue, duration)
	for (const date of Object.keys(dates).sort()) {
		console.log(date, dates[date])
	}
	console.log('weird', weird)
}
