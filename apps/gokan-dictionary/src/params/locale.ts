import type { ParamMatcher } from '@sveltejs/kit';
import { isLocaleSegment } from '$lib/locale';

/** A served locale's segment (/dictionary/zh-hans/...); never "en", whose pages have none. */
export const match: ParamMatcher = param => isLocaleSegment(param);
