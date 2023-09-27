import { TFile } from "obsidian";
import safeEval from "safe-eval";
import { z } from "zod";

const primativeSchema = z
	.string()
	.or(z.number())
	.or(z.boolean())
	.or(z.bigint())
	.or(z.date())
	.or(z.undefined())
	.or(z.null());
const schema = z.array(primativeSchema).or(primativeSchema);
type Schema = z.infer<typeof schema>;

export function evalFromExpression(
	expression: string,
	context: {
		file: TFile;
	}
):
	| {
			success: false;
			error: {
				cause?: Error;
				message: string;
			};
	  }
	| { success: true; object: { [key: string]: Schema } } {
	try {
		const object = safeEval(expression, context);
		if (typeof object !== "object") {
			return {
				success: false,
				error: {
					cause: new Error("The expression must return an object"),
					message: "The expression must return an object",
				},
			} as const;
		}
		const sanitizedObject: { [key: string]: Schema } = {};
		// for each value in object, make sure it pass the schema, if not, assign error message to the key in sanitizedObject
		for (const [key, value] of Object.entries(object)) {
			sanitizedObject[key] = schema.parse(value);
		}
		return {
			success: true,
			object: sanitizedObject,
		} as const;
	} catch (e) {
		return {
			success: false as const,
			error: {
				cause: e as Error,
				message: e.message as string,
			},
		};
	}
}
