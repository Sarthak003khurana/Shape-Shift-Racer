/**
 * Lightweight entry point for static informational & legal pages
 * (privacy.html, terms.html, credits.html, contact.html).
 * Boots Cookie Preferences & AdManager without loading the Canvas game engine.
 */

import { initSiteCompliance } from './compliance/init_site_compliance';

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initSiteCompliance());
  } else {
    initSiteCompliance();
  }
}
