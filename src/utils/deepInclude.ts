/**
 * deep compare two objects, return true if obj2 is a subset of obj1. null value will be treated as different
 */
// https://www.typescriptlang.org/play?#code/GYVwdgxgLglg9mABDSAbEATApgZwPIBGAVltABRzECMAXIgIZgCeANIpUQEx2NMCUdAnDiosjRAG8AUAEgYwRGShMADljgKOVRAEIAvHsQAiDqShHEAH0vtqiA4bAhUqPpNkyATlighPSLXsDWy4AblkAX1l5RWU1DRDOXWCTYjMLa0Sgx2dXdxkvHz8kYHpUHCxwmSiZYDhPRQgEHChEAGssJmQA4k43aQKYsh0UCHRsfDTyLQBtDqYAXTYOTjnOhb5+j0Lff0RS8sqPGprvXaQoTxAjqKkmsBbEHBVUGCgATXoAW1QAITgMF1DEosAAPKB0FqeFAAczcegAfPl7o8VPRPFAcPZEFAwVAAHTPV5QMgAegAegBaakAElJXz4VRRIiw+NQcBhZEQaIxODYPMxbKwYBhUAAFnxogouTpceDCVB0ZiAOpvMVkIzUylGNx8M7FHF4xBSsgCnBCkXi7KIbR8CTGgr6vb27ZMb6oRB0cDYYAoLAYNjbISAz2G8HHSJSxRmi2isWIAA8iAAzJKZB4XU6kAMCm6fnQzTMqAsGFiobCWEGAUwC0qcDNOCWAPxN4wWSsFCLhCOOorO13u2u8otLKuAoeCnCvCBYMh9fFEOAoDVanUd6pSLtSbd3ZqtOVQbSGAAGUi1UgPdG0Z+pUmDXW359xLRvlKkx+7KP3eKShiM96MbcvzDKBk2xU8nzxK9X0fW9nygV9T13B5v3BAAWcDtwAdywTwsJgy8bWNc972NAjcAQ88PyA5oWTZDkuSJN5Ph+f5ARBcFbUQNgmI+d02KYDioD6binheZj+OrITUx48S+NYqSDzQzYgA
export function deepInclude(obj1: any, obj2: any) {
	if (obj1 === null && obj2 === null) {
		return false;
	}
	if (typeof obj1 !== "object" || obj1 === null) {
		return obj1 === obj2;
	}
	if (typeof obj2 !== "object" || obj2 === null) {
		return false;
	}
	for (const key in obj2) {
		if (!deepInclude(obj1[key], obj2[key])) {
			return false;
		}
	}
	return true;
}
