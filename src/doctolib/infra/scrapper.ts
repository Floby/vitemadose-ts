/* eslint-disable no-console */
import Axios, { AxiosInstance, AxiosResponse } from 'axios'
import QS from 'querystring'
import YAML from 'yaml'
import Http from 'http'
import Https from 'https'
import FS from 'fs'
import Path from 'path'
import { DateTime, Interval } from 'luxon'
import { Créneau } from '../../domain/Créneau'
import { Lieu } from '../../domain/Lieu'
import { Départements, Département } from '../../domain/Département'
import { lookahead, step, toAsyncIt, uflatmap } from '../../domain/iterators'
import { match as routeMatch } from 'path-to-regexp'
import { Issue } from '../../domain/Issue'
import { Scrapper } from '../../domain/scrapper'
import Debug from 'debug'
import CONFIG from '../../config'

const DOCTOLIB_CONFIG = YAML.parse(FS.readFileSync(Path.join(__dirname, 'config.yaml'), 'utf8'))
const COOLDOWN = 1

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

export interface DoctolibCentre extends Centre {
	url: string
	id: string
	gid?: string
	practice?: string
}

export class DoctolibScrapper implements Scrapper<DoctolibCentre> {
	private client: AxiosInstance
	private debug: ReturnType<typeof Debug>
	constructor (private config = DOCTOLIB_CONFIG) {
		this.debug = Debug('scrapper:doctolib')
		this.client = Axios.create({
			httpAgent: new Http.Agent({ keepAlive: true, maxSockets: 100 }),
			httpsAgent: new Https.Agent({ keepAlive: true, maxSockets: 100 }),
			baseURL: 'https://partners.doctolib.fr',
			headers: {
				'User-Agent': CONFIG.get('DOCTOLIB_API_KEY'),
				Accept: 'application/json'
			}
		})
	}

	public async * trouverLesCréneaux (centre: DoctolibCentre, range: Interval): AsyncGenerator<Créneau | Issue> {
		try {
			const { data } = await this.get(`/booking/${centre.id}.json`)
			const json = data.data

			if (!json.visit_motives) {
				return
			}
			const motives = this.motives(data.data.visit_motives)
			if (isEmpty(motives)) { return }

			const agendas = this.agendas(data.data.agendas, motives)
			const practices = this.practices(agendas)
			if (!practices.length) {
				return yield new Issue('No practice found for motives', { centre, json })
			}

			const lieu = this.lieuFromCentre(centre)
			const ranges = range.splitBy({ day: 15 })
			for await (const slot of uflatmap(2, ranges, (range) => this.timetable({ range, motives, agendas, practices, json }))) {
				if (slot instanceof Issue) { yield slot; continue }
				const nslot = this.normalizeSlot(slot, motives)
				yield {
					vaccin: nslot.motive.vaccin,
					dose: nslot.motive.dose,
					horaire: DateTime.fromISO(nslot.start_date),
					réservationUrl: 'https://doctolib.fr', // TODO actual URL
					lieu
				}
			}
		} catch (error) {
			console.error(error)
			throw error
		}
	}

	private agendas (agendas: Agenda[], motives: Indexed<Motive>) {
		return MapAsId(agendas.filter((a) => a.visit_motive_ids.some((id) => (id in motives))))
	}

	private practices (agendas: Indexed<Agenda>) {
		return Object.values(agendas).map((a) => a.practice_id).filter(Boolean)
	}

	private normalizeSlot (slot, motives) {
		const motive = slot.steps ? motives[slot.steps[0].visit_motive_id] : [...Object.values(motives)][0]
		if (typeof slot === 'string') {
			return { start_date: slot, motive }
		} else {
			return { start_date: slot.start_date, motive }
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
				start_date: range.start.toISODate(),
				visit_motive_ids: Object.keys(motives).join('-'),
				agenda_ids: Object.keys(agendas).join('-'),
				practice_ids: practices.join('-'),
				insurance_sector: 'public',
				destroy_temporary: 'true',
				limit: Math.floor(range.toDuration().as('days'))
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

	private lieuFromCentre (centre: DoctolibCentre): Lieu {
		return centre as unknown as Lieu
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
			.catch((_) => {
				console.error('ERROR while fetching doctors for', département)
				return { data: {} }
			})

		for await (const response of lookahead(3, toAsyncIt(step(1)), getPage)) {
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
		const match = DoctolibScrapper.MATCH_LINK(link)
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
			this.debug('GET ', url, ' --> ', Date.now() - start, 'ms')
			await delay(COOLDOWN)
			return response
		} catch (e) {
			this.debug('GET ', url, ' --> ', Date.now() - start, 'ms')
			throw e
		}
	}
}

function MapAsId<T extends { id: string }> (items: T[]): Indexed<T> {
	return items.reduce((map, item) => ({ ...map, [item.id]: item }), {})
}

function isEmpty<T extends object> (o: T): boolean {
	return Object.keys(o).length === 0
}

function delay (ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

interface Agenda {
	id: string
	visit_motive_ids: Array<number|string>
	practice_id: number|string|null
}

type Indexed<T extends { id: string }> = Record<string, T>
