export const IS_DEV = process.env['CLI_CEB_DEV'] === 'true';
export const IS_PROD = !IS_DEV;
export const IS_FIREFOX = process.env['CLI_CEB_FIREFOX'] === 'true';
export const IS_CI = process.env['CEB_CI'] === 'true';

// Feature flags for agentic blocker architecture
export const ENABLE_AGENTS = process.env['CEB_ENABLE_AGENTS'] !== 'false';
export const USE_REMOTE_AGENT = process.env['CEB_USE_REMOTE_AGENT'] === 'true';
export const ENABLE_APPEALS = process.env['CEB_ENABLE_APPEALS'] !== 'false';
export const FORCE_DETERMINISTIC_ONLY = process.env['CEB_FORCE_DETERMINISTIC_ONLY'] === 'true';

// Budgets and limits
export const LLM_TOKEN_BUDGET_PER_TAB = Number(process.env['CEB_LLM_TOKEN_BUDGET_PER_TAB'] || 4000);
export const LLM_GLOBAL_QPS = Number(process.env['CEB_LLM_GLOBAL_QPS'] || 5);
export const CLASSIFIER_TIMEOUT_MS = Number(process.env['CEB_CLASSIFIER_TIMEOUT_MS'] || 3500);
export const APPEAL_TIMEOUT_MS = Number(process.env['CEB_APPEAL_TIMEOUT_MS'] || 7000);
