import { Plateforme } from './Plateforme'
import { Départements } from './Département'

export interface Lieu {
	departement: keyof typeof Départements
	nom: string
	url: string
	lieu: Lieu.Type
	internal_id: string
	plateforme: Plateforme
	localisation?: Localisation
	metadata?: object
}

export namespace Lieu {
	export type Type = 'pharmacie' | 'centre-vaccination' | 'hopital' | 'généraliste'
}

interface Localisation {
	lat: number
	lng: number
}
