import { DateTime } from 'luxon'
import { DoctolibCenterScrapper, DoctolibCréneauxScrapper } from '../doctolib/infra/scrapper'
import humanizeDuration from 'humanize-duration'
import { uflatmap } from '../domain/iterators'
import { Issue } from '../domain/Issue'
import Chalk from 'chalk'
import yargs from 'yargs'

const CONCURRENCY = 100

main()
async function main () {
	const range = {
		from: DateTime.now().toISO().substr(0, 10),
		to: DateTime.now().plus({ week: 1 }).toISO().substr(0, 10)
	}
	const créneauxScrapper = new DoctolibCréneauxScrapper()
	const centreScrapper = new DoctolibCenterScrapper()
	const centres = centreScrapper.trouverLesCentres()
	let count = 0
	let issue = 0
	const start = Date.now()
	for await (const slot of uflatmap(CONCURRENCY, centres, (centre) => créneauxScrapper.trouverLesCréneaux(centre, range))) {
		if (slot instanceof Issue) {
			console.error(Chalk.red('Encountered issue'), Chalk.red.bold(slot.message), slot.meta.error)
			//console.dir(slot.meta.centre)
			//console.dir(slot.meta.json, { depth: null })
			//console.log(slot.meta.e)
			//return process.exit(1)
			++issue
		} else {
			++count
		}
	}
	const duration = humanizeDuration(Date.now() - start)
	console.log('Found %d slots and encountered %d issues in %s', count, issue, duration)
}
