import { expect } from 'chai'
import { DateTime } from 'luxon'
import nock from 'nock'
import { DoctolibScrapper } from '../../../src/doctolib/infra/scrapper'

describe.skip('DoctolibScrapper', () => {
	let doctolib
	beforeEach(() => {
		// doctolib = nock('https://www.doctolib.fr')
	})
	describe('.trouverLesCréneaux(centre)', () => {
		const range = {
			from: DateTime.now().toISO().substr(0, 10),
			to: DateTime.now().plus({ week: 1 }).toISO().substr(0, 10)
		}
		context("quand l'url retourne une 404", () => {
			it.skip('retourn une async iterator vide', async () => {
				// Given
				const centre = {
					url: 'https://www.doctolib.fr/centre-de-vaccinations-internationales/ville1/centre1?pid=practice-165752&enable_cookies_consent=1',
					id: 'centre1'
				}
				const scrapper = new DoctolibScrapper()
				doctolib.get('/centre-de-vaccinations-internationales/ville1/centre1?pid=practice-165752&enable_cookies_consent=1').reply(404, 'not found')
				// When
				const actual = await collect(scrapper.trouverLesCréneaux(centre, range))
				// Then
				expect(actual).to.deep.equal([])
				doctolib.done()
			})
		})
		context("quand l'url retourne une 200", () => {
			it('retoure un async iterator avec des créneaux', async function () {
				// Given
				const centre = {
					url: 'https://www.doctolib.fr/vaccination-covid-19/granville/centre-de-depistage-covid19-tests-antigeniques-granville?pid=practice-154470',
					id: 'centre-de-depistage-covid19-tests-antigeniques-granville',
					practiceId: '154470'
				}
				const scrapper = new DoctolibScrapper()
				// doctolib.get('/vaccination-covid-19/boussac/centre-de-vaccination-msp-de-boussac?pid=practice-164636').reply(404, 'not found')
				// When
				const actual = await collect(scrapper.trouverLesCréneaux(centre, range))
				// Then
				expect(actual).to.have.property('length').equal(27)
			})
		})
	})
	describe('.trouverLesCentres()', () => {
		context("quand l'url retourne une 200", () => {
			it('retourne un async iterator avec les centres', async function () {
				// Given
				this.timeout(Infinity)
				const scrapper = new DoctolibScrapper()
				// When
				const start = Date.now()
				const actual = await collect(scrapper.trouverLesCentres())
				const end = Date.now()
				console.log('Fetched centres in %d ms', end - start)
				// Then
				expect(actual).to.have.property('length').equal(73)
				expect(actual).to.deep.equal([])
			})
		})
	})
})

async function collect<T> (iterator: AsyncIterable<T>): Promise<Array<T>> {
	const buffer: T[] = []
	for await (const item of iterator) {
		buffer.push(item)
	}
	return buffer
}
