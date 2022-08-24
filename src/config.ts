import Envie from 'envie'
import Joi from 'joi'
import dotenv from 'dotenv'
/* eslint-disable no-process-env */

dotenv.config()
const overrides = dotenv.parse(process.argv.slice(2).join('\n'))

const CONFIG = Envie({
	CONCURRENCY: Joi.number()
		.min(1)
		.max(1000)
		.default(100)
		.description('Le nombre de centres scrappés en parallèle'),

	DOCTOLIB_API_KEY: Joi.string()
		.required()
		.description("La clé d'API qui permet d'utiliser les quotas ViteMaDose auprès de Doctolib")
}, { ...process.env, ...overrides })

export function needsHelp (argv = process.argv): boolean {
	return argv.some((arg) => arg === '-h' || arg === '--help' || arg === 'help')
}

export default CONFIG
