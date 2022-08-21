/* eslint-disable no-console */
import Axios, { AxiosInstance, AxiosResponse } from 'axios'
import QS from 'querystring'
import YAML from 'yaml'
import FS from 'fs'
import Path from 'path'
import { DateTime } from 'luxon'
import { Créneau } from '../../domain/Créneau'
import { Lieu } from '../../domain/Lieu'
import { Départements, Département } from '../../domain/Département'
import { lookahead, step, uflatmap } from '../../domain/iterators'
import { match as routeMatch } from 'path-to-regexp'
import { Issue } from '../../domain/Issue'

const CONFIG = YAML.parse(FS.readFileSync(Path.join(__dirname, 'config.yaml'), 'utf8'))

interface Centre {
	id: string
}
interface Motive {
	id: string
	name: string
	vaccin: Vaccine
	dose: 1|2|3|4
}
type Vaccine = 'AstraZeneca' | 'Pfizer-BioNTech' | 'Moderna' | 'Janssen'

interface DateRange {
  from: string
  to: string
}

interface DoctolibCentre extends Centre {
	url: string
	id: string
	gid?: string
	practice?: string
}

interface CréneauxScrapper<C extends Centre> {
	trouverLesCréneaux(centre: C, range: DateRange): AsyncGenerator<Créneau | Issue>
}

export class DoctolibCréneauxScrapper implements CréneauxScrapper<DoctolibCentre> {
	private client: AxiosInstance
	constructor (private config = CONFIG) {
		this.client = Axios.create({
			baseURL: 'https://partners.doctolib.fr',
			headers: {
				'User-Agent': '<censored>',
				Accept: 'application/json'
			}
		})
	}

	public async * trouverLesCréneaux (centre: DoctolibCentre, range: DateRange): AsyncGenerator<Créneau | Issue> {
		try {
			const { data } = await this.get(`/booking/${centre.id}.json`)
			const json = data.data

			if (!json.visit_motives) {
				return
			}
			const motives = this.motives(data.data.visit_motives)
			if (isEmpty(motives)) { return }

			const agendas = MapAsId(data.data.agendas.filter((a) => a.visit_motive_ids.some((id) => (id in motives))))
			const practices = Object.values(agendas).map((a: any) => a.practice_id).filter(Boolean)
			if (!practices.length) {
				return yield new Issue('No practice found for motives', { centre, json })
			}

			const lieu = this.lieuFromCentre(centre)
			for await (const slot of this.timetable({ range, motives, agendas, practices, json })) {
				if (slot instanceof Issue) { yield slot; continue }
				const motive = slot.steps ? motives[slot.steps[0].visit_motive_id] : [...Object.values(motives)][0]
				yield {
					vaccin: motive.vaccin,
					dose: motive.dose,
					horaire: DateTime.fromISO(slot.start_date),
					réservationUrl: 'https://doctolib.fr',
					lieu
				}
			}
		} catch (error) {
			console.error(error)
			throw error
		}
	}

	private motives (sourceMotives): {[key: string]: Motive} {
		const motives = sourceMotives
			.map((m) => {
				if (!this.config.motives[String(m.ref_visit_motive_id)]) {
					return null
				}
				const source = this.config.motives[String(m.ref_visit_motive_id)]
				return { ...source, id: m.id, name: m.name }
			})
			.filter(m => m !== null)
		return MapAsId(motives)
	}

	private async * timetable ({ range, motives, agendas, practices, json }): AsyncGenerator<Issue | any> {
		let availabilities
		try {
			const { data } = await this.get('/availabilities.json', {
				start_date: range.from,
				visit_motive_ids: Object.keys(motives).join('-'),
				agenda_ids: Object.keys(agendas).join('-'),
				practice_ids: practices.join('-'),
				insurance_sector: 'public',
				destroy_temporary: 'true',
				limit: 7
			})
			availabilities = data.availabilities
		} catch (e) {
			yield new Issue(`Could not get timetable ${practices.join(',')}`, { json, range, motives, agendas, practices, error: e.message, e })
			return
		}

		for (const { slots } of availabilities) {
			for (const slot of slots) {
				yield slot
			}
		}
	}

	async get (url: string, query?): Promise<AxiosResponse> {
		if (query) {
			url += `?${QS.stringify(query)}`
		}
		const start = Date.now()
		let response: AxiosResponse
		try {
			response = await this.client.get(url)
			console.log('GET ', url, ' --> ', Date.now() - start, 'ms')
			return response
		} catch (e) {
			console.log('GET ', url, ' --> ', Date.now() - start, 'ms')
			throw e
		}
	}

	private lieuFromCentre (centre: DoctolibCentre): Lieu {
		return centre as unknown as Lieu
	}
}

export class DoctolibCenterScrapper {
	private client: AxiosInstance
	constructor (private config = CONFIG) {
		this.client = Axios.create({
			baseURL: 'https://partners.doctolib.fr',
			headers: {
				'User-Agent': '<censored>',
				Accept: 'application/json'
			}
		})
	}

	async * trouverLesCentres (): AsyncIterable<DoctolibCentre> {
		const déjàVu = new Set<string>()
		for await (const doctor of uflatmap(20, toAsyncIt(Object.values(Départements)), (d) => this.départementDoctors(d))) {
			if (déjàVu.has(doctor.link)) { continue }
			déjàVu.add(doctor.link)
			const link = this.matchLink(doctor.link)
			if (!link) { continue }
			// const response = await this.get(`https://partners.doctolib.fr/booking/${link.id}.json`)
			// const profile = response.data.data.profile
			// const gid = `d${profile.id}`
			const rdvUrl = `https://www.doctolib.fr/vaccination-covid-19/${link.ville}/${link.id}`
			yield {
				id: link.id,
				url: rdvUrl
				// gid
			}
		}
	}

	private async * départementDoctors (département: Département): AsyncIterable<Record<'link', string>> {
		const getPage = (page: number) => this.get(`/vaccination-covid-19/${this.slugify(département)}.json`, { page })
			.catch((e) => {
				console.error('ERROR while fetching doctors for', département)
				return { data: {} }
			})

		for await (const response of lookahead(2, toAsyncIt(step(1)), getPage)) {
			const doctors = response?.data?.data?.doctors
			if (doctors?.length) {
				yield * doctors
			} else {
				break
			}
		}
	}

	private static MATCH_LINK = routeMatch<Record<'spec'|'ville'|'id', string>>('/:spec/:ville/:id')
	private matchLink (link: string): Record<'spec'|'ville'|'id', string> | undefined {
		const match = DoctolibCenterScrapper.MATCH_LINK(link)
		if (match) {
			return match.params
		}
	}

	private slugify (département: Département): string {
		return département.nom
			.toLowerCase()
			.normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
			.replace(/\s+|\W/g, '-')
	}

	async get (url: string, query?): Promise<AxiosResponse> {
		if (query) {
			url += `?${QS.stringify(query)}`
		}
		const start = Date.now()
		let response: AxiosResponse
		try {
			response = await this.client.get(url)
			console.log('GET ', url, ' --> ', Date.now() - start, 'ms')
			return response
		} catch (e) {
			console.log('GET ', url, ' --> ', Date.now() - start, 'ms')
			throw e
		}
	}
}

function MapAsId<T extends { id: string }> (items: T[]): {[key: string]: T} {
	return items.reduce((map, item) => ({ ...map, [item.id]: item }), {})
}
async function * toAsyncIt<T> (it: Iterable<T>): AsyncIterable<T> {
	for (const i of it) {
		yield i
	}
}

function isEmpty<T extends object> (o: T): boolean {
	return Object.keys(o).length === 0
}
