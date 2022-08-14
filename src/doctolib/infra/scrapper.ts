/* eslint-disable no-console */
import Axios, { AxiosInstance } from 'axios'
import QS from 'querystring'

interface Centre {
}

interface DoctolibCentre extends Centre {
	url: string
	id: string
	practice?: string
}

type Créneau = any

interface CréneauxScrapper<C extends Centre> {
	trouverLesCréneaux(centre: C): AsyncGenerator<Créneau>
}

export default class DoctolibCréneauxScrapper implements CréneauxScrapper<DoctolibCentre> {
	private client: AxiosInstance
	constructor () {
		this.client = Axios.create({
			baseURL: 'https://partners.doctolib.fr',
			headers: {
				'User-Agent': '<censored>',
				Accept: 'application/json'
			}
		})
	}

	public async * trouverLesCréneaux (centre: DoctolibCentre): AsyncGenerator<Créneau> {
		try {
			const { data } = await this.client.get(`/booking/${centre.id}.json`)
			const json = data.data
			const motives = data.data.visit_motives
				.filter((m) => m.name.toLowerCase().includes('vaccin'))
				.reduce((motives, m) => ({ ...motives, [m.id]: m }), {})
			const agendas = data.data.agendas
				.filter((a) => a.visit_motive_ids.some((id) => (id in motives)))
				.reduce((agendas, a) => ({ ...agendas, [a.id]: a }), {})
			const practices = Object.values(agendas).map((a: any) => a.practice_id).filter(Boolean)

			const lieu = this.lieuFromCentre(centre)
			const vaccin = 'pfizer'
			for await (const slot of this.timetable({ motives, agendas, practices, json })) {
				const motive = motives[slot.steps[0].visit_motive_id].name
				yield {
					vaccin,
					motive,
					lieu,
					datetime: slot.start_date
				}
			}
		} catch (error) {
			console.error(error)
			throw error
		}
	}

	private async * timetable ({ motives, agendas, practices, json }): AsyncGenerator<any> {
		const slotsQuery = QS.stringify({
			start_date: '2022-08-16',
			visit_motive_ids: Object.keys(motives).join('-'),
			agenda_ids: Object.keys(agendas).join('-'),
			practice_ids: practices.map(p => p.id).join('-'),
			insurance_sector: 'public',
			destroy_temporary: 'true',
			limit: 7
		})
		const slotsUrl = `/availabilities.json?${slotsQuery}`
		const { data } = await this.client.get(slotsUrl)
		const availabilities = data.availabilities
		console.log('availabilities', availabilities)
		for (const { slots } of availabilities) {
			for (const slot of slots) {
				yield slot
			}
		}
	}

	private lieuFromCentre (centre: DoctolibCentre) {
		return centre
	}
}
