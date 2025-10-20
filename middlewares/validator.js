import Joi from "joi"

export const createStringSchema = Joi.object({
    value: Joi.string()
            .min(3)
            .required()
})