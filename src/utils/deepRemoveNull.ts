import { SanitizedObject } from "./evalFromExpression";

export function deepRemoveNull<T>(obj: T, obj2: Partial<T>): Partial<T> {
	if (typeof obj !== "object" || obj === null) {
		return obj;
	}

	// Initialize the result as a copy to avoid modifying the original
	const result = Array.isArray(obj) ? [] : ({} as Partial<T>);

	for (const key in obj) {
		if (obj.hasOwnProperty(key)) {
			// Check if obj2 is an object and has the key; if obj2 or its key is undefined, treat it as having a non-null value
			const keyExistsInObj2 =
				typeof obj2 === "object" && obj2 !== null && key in obj2;
			const shouldBeRemoved = keyExistsInObj2 && obj2[key] === null;

			if (!shouldBeRemoved) {
				if (typeof obj[key] === "object" && obj[key] !== null) {
					// Recursively call deepRemoveNull, passing the corresponding nested object from obj2 or undefined if it doesn't exist
					// @ts-ignore
					result[key] = deepRemoveNull(
						obj[key],
						// @ts-ignore
						keyExistsInObj2 ? obj2[key] : undefined
					);
				} else {
					// Copy the value from obj
					// @ts-ignore
					result[key] = obj[key];
				}
			}
		}
	}

	return result as T;
}
