import Envie from 'envie'
import Joi from 'joi'

const CONFIG = Envie({
	DOCTOLIB_API_KEY: Joi.string()
		.optional()
		.default('')
		.description("La clé d'API qui permet d'utiliser les quotas ViteMaDose auprès de Doctolib")
})

export default CONFIG
