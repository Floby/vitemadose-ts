import { expect } from 'chai'
import nock from 'nock'
import DoctolibCréneauxScrapper from '../../../src/doctolib/infra/scrapper'

describe('DoctolibCréneauxScrapper', () => {
	let doctolib
	beforeEach(() => {
		// doctolib = nock('https://www.doctolib.fr')
	})
	describe('.trouverLesCréneaux(centre)', () => {
		context("quand l'url retourne une 404", () => {
			it.skip('retourn une async iterator vide', async () => {
				// Given
				const centre = {
					url: 'https://www.doctolib.fr/centre-de-vaccinations-internationales/ville1/centre1?pid=practice-165752&enable_cookies_consent=1',
					id: 'centre1'
				}
				const scrapper = new DoctolibCréneauxScrapper()
				doctolib.get('/centre-de-vaccinations-internationales/ville1/centre1?pid=practice-165752&enable_cookies_consent=1').reply(404, 'not found')
				// When
				const actual = await collect(scrapper.trouverLesCréneaux(centre))
				// Then
				expect(actual).to.deep.equal([])
				doctolib.done()
			})
		})
		context("quand l'url retourne une 200", () => {
			it('retoure un async iterator avec des créneaux', async () => {
				// Given
				const centre = {
					url: 'https://www.doctolib.fr/vaccination-covid-19/granville/centre-de-depistage-covid19-tests-antigeniques-granville?pid=practice-154470',
					id: 'centre-de-depistage-covid19-tests-antigeniques-granville',
					practiceId: '154470'
				}
				const scrapper = new DoctolibCréneauxScrapper()
				// doctolib.get('/vaccination-covid-19/boussac/centre-de-vaccination-msp-de-boussac?pid=practice-164636').reply(404, 'not found')
				// When
				const actual = await collect(scrapper.trouverLesCréneaux(centre))
				// Then
				expect(actual).to.have.property('length').equal(27)
			})
		})
	})
})

async function collect<T> (iterator: AsyncGenerator<T>): Promise<Array<T>> {
	const buffer: T[] = []
	for await (const item of iterator) {
		buffer.push(item)
	}
	return buffer
}
