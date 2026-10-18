import { resultDatabaseRecommendations } from './resultDiscovery.js';
const complete = new Set(['success', 'empty']);
const failed = new Set(['error', 'timeout', 'rate_limited', 'cancelled', 'unavailable', 'partial']);
const statusLabels = { success: 'Search completed', empty: 'Search completed · no eligible records', error: 'Provider error', timeout: 'Timed out', rate_limited: 'Rate limited', cancelled: 'Cancelled', unavailable: 'Unavailable', partial: 'Incomplete', disabled: 'Not configured / disabled', unsupported: 'Unsupported search', not_requested: 'Not searched', unknown: 'Execution not recorded' };
export function searchCoverage(discovery, plan = {}) {
  const searched = [], unavailable = [], notSearched = [];
  for (const [laneId, lane] of Object.entries(discovery?.lanes || {})) {
    const attempts = Array.isArray(lane.attempts) && lane.attempts.length ? lane.attempts : [{ provider: lane.provider || (laneId === 'library' ? 'Library discovery' : laneId), status: lane.outcome || lane.status || 'unknown', resultCount: lane.resultCount }];
    for (const attempt of attempts) {
      const status = lane.requested === false ? 'not_requested' : attempt.status || 'unknown';
      const row = { provider: attempt.provider || lane.provider || laneId, status, label: statusLabels[status] || 'Execution not recorded', query: typeof attempt.query === 'string' ? attempt.query : '', count: Number.isInteger(attempt.resultCount) && attempt.resultCount >= 0 ? attempt.resultCount : null };
      const target = complete.has(status) ? searched : failed.has(status) ? unavailable : notSearched;
      // Repeated queries remain separate; their counts are never added together.
      if (!target.some(item => item.provider === row.provider && item.query === row.query && item.status === row.status)) target.push(row);
    }
  }
  const recommendations = resultDatabaseRecommendations(plan);
  const providers = new Set(searched.map(item => item.provider.toLowerCase()));
  const recommended = recommendations.filter(item => !providers.has(String(item.name || '').toLowerCase()) && !providers.has(String(item.id || '').toLowerCase()));
  return { searched, unavailable, notSearched, recommended, completedAt: Number.isFinite(Date.parse(discovery?.completedAt)) ? discovery.completedAt : '', unknown: !discovery?.lanes };
}
