import type { ParamMatcher } from '@sveltejs/kit';
import { isSearchIndexPart } from '$lib/searchIndex';

/** One of the search index's two files: core or full (SEARCH_INDEX_PARTS). */
export const match: ParamMatcher = param => isSearchIndexPart(param);
