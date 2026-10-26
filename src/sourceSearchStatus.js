import { includesLibraryResults, includesOpenAccessResults, getAccessScope } from '../config/accessScope.js';

/** A connection failure cannot tell us whether a provider search ran. */
export function unconfirmedSourceDiscovery(accessScope = 'library') {
  const lane = requested => ({requested,resultCount:0,outcome:requested?'not_confirmed':'not_requested',status:requested?'not_confirmed':'not_requested',attempts:[]});
  return {accessScope:getAccessScope(accessScope).id,lanes:{library:lane(includesLibraryResults(accessScope)),openAccess:lane(includesOpenAccessResults(accessScope))}};
}
