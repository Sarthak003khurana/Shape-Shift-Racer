/**
 * EEA / UK Cookie Consent Manager & Google Consent Mode v2 Integration.
 * Persists user consent in localStorage and gates advertising cookies so ads stay
 * strictly off for EEA/UK visitors until explicit opt-in consent is granted.
 * Integrates Google Consent Mode v2 signals ('ad_storage', 'analytics_storage', etc.).
 */

import { CONSENT_STORAGE_KEY } from '../config';

export type ConsentStatus = 'unset' | 'accepted' | 'rejected';

export interface ConsentRecord {
  status: ConsentStatus;
  adsAllowed: boolean;
  regionEeaUk: boolean;
  updatedAt: string;
  version: number;
}

const CONSENT_VERSION = 1;

// Global Window interface extensions for dataLayer & gtag
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Initializes Google Consent Mode v2 defaults to 'denied' as early as possible.
 */
export function initGoogleConsentModeDefaults(): void {
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () {
      window.dataLayer?.push(arguments);
    };
  }

  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    personalization_storage: 'denied',
    security_storage: 'granted',
    wait_for_update: 500,
  });
}

/**
 * Updates Google Consent Mode v2 signals upon user consent or rejection.
 */
export function updateGoogleConsentMode(granted: boolean): void {
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () {
      window.dataLayer?.push(arguments);
    };
  }

  const val = granted ? 'granted' : 'denied';
  window.gtag('consent', 'update', {
    ad_storage: val,
    ad_user_data: val,
    ad_personalization: val,
    analytics_storage: val,
    personalization_storage: val,
  });
}

// IANA timezones covering EEA (EU27 + Iceland, Liechtenstein, Norway) and UK
const EEA_UK_TIMEZONES = new Set<string>([
  'Europe/Amsterdam',
  'Europe/Athens',
  'Europe/Belfast',
  'Europe/Berlin',
  'Europe/Bratislava',
  'Europe/Brussels',
  'Europe/Bucharest',
  'Europe/Budapest',
  'Europe/Busingen',
  'Europe/Copenhagen',
  'Europe/Dublin',
  'Europe/Gibraltar',
  'Europe/Guernsey',
  'Europe/Helsinki',
  'Europe/Isle_of_Man',
  'Europe/Jersey',
  'Europe/Lisbon',
  'Europe/Ljubljana',
  'Europe/London',
  'Europe/Luxembourg',
  'Europe/Madrid',
  'Europe/Malta',
  'Europe/Mariehamn',
  'Europe/Nicosia',
  'Europe/Oslo',
  'Europe/Paris',
  'Europe/Prague',
  'Europe/Riga',
  'Europe/Rome',
  'Europe/Sofia',
  'Europe/Stockholm',
  'Europe/Tallinn',
  'Europe/Vaduz',
  'Europe/Vienna',
  'Europe/Vilnius',
  'Europe/Warsaw',
  'Europe/Zagreb',
  'Atlantic/Azores',
  'Atlantic/Canary',
  'Atlantic/Faroe',
  'Atlantic/Madeira',
  'Atlantic/Reykjavik',
  'Arctic/Longyearbyen',
  'Asia/Nicosia',
]);

const EEA_UK_REGION_CODES = new Set<string>([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU',
  'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'GB', 'UK',
]);

/**
 * Best-effort client-side heuristic to detect EEA / UK visitors without external GeoIP calls.
 */
export function detectEeaUkRegion(
  timeZoneOverride?: string,
  languagesOverride?: readonly string[]
): boolean {
  try {
    const tz =
      timeZoneOverride !== undefined
        ? timeZoneOverride
        : typeof Intl !== 'undefined' && Intl.DateTimeFormat
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || ''
        : '';

    if (tz && EEA_UK_TIMEZONES.has(tz)) {
      return true;
    }

    const langs =
      languagesOverride !== undefined
        ? languagesOverride
        : typeof navigator !== 'undefined' && Array.isArray(navigator.languages)
        ? navigator.languages
        : typeof navigator !== 'undefined' && navigator.language
        ? [navigator.language]
        : [];

    for (const lang of langs) {
      const parts = lang.split(/[-_]/);
      if (parts.length >= 2) {
        const region = parts[1].toUpperCase();
        if (EEA_UK_REGION_CODES.has(region)) {
          return true;
        }
      }
    }
  } catch {
    // Default conservatively if detection throws
  }

  return false;
}

export type ConsentChangeListener = (record: ConsentRecord) => void;

export class ConsentManager {
  private record: ConsentRecord;
  private listeners: Set<ConsentChangeListener> = new Set();

  constructor(regionEeaUkOverride?: boolean) {
    initGoogleConsentModeDefaults();

    const isEeaUk =
      regionEeaUkOverride !== undefined ? regionEeaUkOverride : detectEeaUkRegion();
    this.record = this.loadRecord(isEeaUk);

    // Sync loaded state with Google Consent Mode v2
    if (this.record.status === 'accepted') {
      updateGoogleConsentMode(true);
    } else if (this.record.status === 'rejected') {
      updateGoogleConsentMode(false);
    }
  }

  private loadRecord(isEeaUk: boolean): ConsentRecord {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (
            parsed &&
            typeof parsed === 'object' &&
            (parsed.status === 'accepted' || parsed.status === 'rejected' || parsed.status === 'unset') &&
            parsed.version === CONSENT_VERSION
          ) {
            return {
              status: parsed.status,
              adsAllowed: Boolean(parsed.adsAllowed),
              regionEeaUk: isEeaUk,
              updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
              version: CONSENT_VERSION,
            };
          }
        }
      }
    } catch {
      // Ignore storage errors (private browsing, quota, etc.)
    }

    return {
      status: 'unset',
      adsAllowed: false,
      regionEeaUk: isEeaUk,
      updatedAt: '',
      version: CONSENT_VERSION,
    };
  }

  private saveRecord(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(this.record));
      }
    } catch {
      // Ignore storage errors
    }
  }

  private notify(): void {
    const snapshot = this.getRecord();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.warn('[ConsentManager] Listener error:', err);
      }
    }
  }

  public getRecord(): ConsentRecord {
    return { ...this.record };
  }

  public isEeaUkVisitor(): boolean {
    return this.record.regionEeaUk;
  }

  /**
   * Returns true if the EEA/UK cookie consent banner should be shown automatically.
   * On localhost/127.0.0.1, also shows by default when unset to allow instant local testing.
   */
  public needsBanner(): boolean {
    const isLocalhost =
      typeof window !== 'undefined' &&
      window.location &&
      Boolean(
        window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.search.includes('eea=1') ||
          window.location.search.includes('consent=1')
      );

    return (this.record.regionEeaUk || isLocalhost) && this.record.status === 'unset';
  }

  /**
   * Returns true if user consent permits advertising scripts.
   * For EEA/UK visitors, explicit opt-in ('accepted') is strictly required.
   * For non-EEA/UK visitors, ads are blocked if the user opted out ('rejected').
   */
  public isAdsAllowed(): boolean {
    if (this.record.status === 'rejected') {
      return false;
    }
    if (this.record.regionEeaUk) {
      return this.record.status === 'accepted' && this.record.adsAllowed;
    }
    return true;
  }

  public acceptAll(): ConsentRecord {
    this.record = {
      ...this.record,
      status: 'accepted',
      adsAllowed: true,
      updatedAt: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    this.saveRecord();
    updateGoogleConsentMode(true);
    this.notify();
    return this.getRecord();
  }

  public rejectNonEssential(): ConsentRecord {
    this.record = {
      ...this.record,
      status: 'rejected',
      adsAllowed: false,
      updatedAt: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    this.saveRecord();
    updateGoogleConsentMode(false);
    this.notify();
    return this.getRecord();
  }

  public resetConsent(): ConsentRecord {
    this.record = {
      ...this.record,
      status: 'unset',
      adsAllowed: false,
      updatedAt: '',
      version: CONSENT_VERSION,
    };
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(CONSENT_STORAGE_KEY);
      }
    } catch {
      // Safe ignore
    }
    initGoogleConsentModeDefaults();
    this.notify();
    return this.getRecord();
  }

  public subscribe(listener: ConsentChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
