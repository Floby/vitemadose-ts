import { DateTime } from 'luxon'
import { Lieu } from './Lieu'

export interface Créneau {
	horaire: DateTime,
	réservationUrl: string,
	dose: 1|2|3|4,
	vaccin: Vaccin,
	lieu: Lieu
}

type Vaccin = 'AstraZeneca' | 'Pfizer-BioNTech' | 'Moderna' | 'Janssen'
