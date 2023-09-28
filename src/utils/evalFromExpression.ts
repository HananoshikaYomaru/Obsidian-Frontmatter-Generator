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

const recursivePrmitiveSchema: z.ZodType<any> = z.lazy(() =>
	z.record(
		z.union([
			primativeSchema,
			recursivePrmitiveSchema,
			z.array(
				primativeSchema
					.or(recursivePrmitiveSchema)
					.or(z.array(primativeSchema))
			),
		])
	)
);

type Schema = z.infer<typeof recursivePrmitiveSchema>;

export type SanitizedObject = { [key: string]: Schema };

export function evalFromExpression(
	expression: string,
	context: {
		[x: string]: any;
	}
):
	| {
			success: false;
			error: {
				cause?: Error;
				message: string;
			};
	  }
	| { success: true; object: SanitizedObject } {
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
		// for each value in object, make sure it pass the schema, if not, assign error message to the key in sanitizedObject
		const sanitizedObject: SanitizedObject =
			recursivePrmitiveSchema.parse(object);

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

export type EvalResult = ReturnType<typeof evalFromExpression>;
