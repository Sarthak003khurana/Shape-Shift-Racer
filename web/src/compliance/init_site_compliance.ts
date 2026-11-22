/**
 * Site-wide compliance bootstrapper (used by main game page and static info pages).
 * Initializes EEA/UK Cookie Consent banner and feature-flagged AdManager.
 */

import { ConsentManager } from './consent';
import { AdManager } from './ads';
import { ConsentBannerUI } from '../ui/consent_banner';

export interface SiteComplianceHandles {
  consent: ConsentManager;
  ads: AdManager;
  banner: ConsentBannerUI;
}

export function initSiteCompliance(): SiteComplianceHandles {
  const consent = new ConsentManager();
  const ads = new AdManager(consent);
  const banner = new ConsentBannerUI(consent);

  ads.init();
  banner.mount();

  return { consent, ads, banner };
}
