/**
 * Feature-Flagged AdSense Manager.
 * Keeps all ad slots strictly hidden and disabled (0px height, zero placeholder boxes,
 * zero external network calls, zero CLS) until BOTH:
 *   1. SHOW_ADS and ADS_ENABLED feature flags are switched on with a valid AdSense Publisher ID
 *   2. Visitor consent permits advertising cookies (EEA/UK opt-in enforced)
 *
 * Slots are strictly constrained to Menu ('START') and Game Over ('GAMEOVER') screens,
 * and are immediately hidden during active gameplay ('PLAYING') and pause ('PAUSED').
 */

import {
  SHOW_ADS,
  ADS_ENABLED,
  ADSENSE_CLIENT_ID,
  AD_SLOTS,
  AdSlotConfig,
  ADSENSE_TEST_MODE,
} from '../config';
import { ConsentManager } from './consent';

export interface AdManagerOptions {
  adsEnabled?: boolean;
  clientId?: string;
  slots?: Record<string, AdSlotConfig>;
  testMode?: boolean;
}

const VALID_ADSENSE_CLIENT_RE = /^ca-pub-\d{10,}$/;

export class AdManager {
  private readonly adsEnabled: boolean;
  private readonly clientId: string;
  private readonly slots: Record<string, AdSlotConfig>;
  private readonly consent: ConsentManager;
  private readonly testMode: boolean;
  private currentGameState: string = 'START';
  private scriptInjected: boolean = false;
  private unsubscribeConsent: (() => void) | null = null;
  private boundGameStateListener: ((e: Event) => void) | null = null;

  constructor(consent: ConsentManager, options: AdManagerOptions = {}) {
    this.consent = consent;
    // Defaults to false (ADS_ENABLED && SHOW_ADS); explicit options.adsEnabled allowed for tests
    this.adsEnabled =
      options.adsEnabled !== undefined ? options.adsEnabled : ADS_ENABLED && SHOW_ADS;
    this.clientId = options.clientId !== undefined ? options.clientId : ADSENSE_CLIENT_ID;
    this.slots = options.slots !== undefined ? options.slots : AD_SLOTS;
    this.testMode =
      options.testMode !== undefined ? options.testMode : ADSENSE_TEST_MODE;
  }

  public hasValidPublisherId(): boolean {
    return VALID_ADSENSE_CLIENT_RE.test(this.clientId.trim());
  }

  /**
   * Master gate: returns true ONLY when ads are enabled, a real AdSense
   * publisher ID is configured, AND visitor consent permits ads.
   */
  public canLoadAds(): boolean {
    if (!this.adsEnabled) return false;
    if (!this.hasValidPublisherId()) return false;
    if (!this.consent.isAdsAllowed()) return false;
    return true;
  }

  public init(): void {
    if (typeof document === 'undefined') return;

    this.injectAdStyles();
    this.syncDomSlots();

    this.unsubscribeConsent = this.consent.subscribe(() => {
      this.syncDomSlots();
    });

    this.boundGameStateListener = (e: Event) => {
      const customEvt = e as CustomEvent<{ state: string }>;
      if (customEvt.detail && customEvt.detail.state) {
        this.onGameStateChange(customEvt.detail.state);
      }
    };
    window.addEventListener('ssr-gamestate-change', this.boundGameStateListener);
  }

  public destroy(): void {
    if (this.unsubscribeConsent) {
      this.unsubscribeConsent();
      this.unsubscribeConsent = null;
    }
    if (this.boundGameStateListener && typeof window !== 'undefined') {
      window.removeEventListener('ssr-gamestate-change', this.boundGameStateListener);
      this.boundGameStateListener = null;
    }
  }

  /**
   * Called whenever the game state machine changes (e.g. START, PLAYING, PAUSED, GAMEOVER)
   */
  public onGameStateChange(state: string): void {
    this.currentGameState = state;
    this.syncDomSlots();
  }

  private injectAdStyles(): void {
    if (document.getElementById('ssr-ad-styles')) return;

    const style = document.createElement('style');
    style.id = 'ssr-ad-styles';
    style.textContent = `
      /* When ads are disabled or flag is false, ad containers must be 100% invisible with 0 CLS */
      .ssr-ad-slot:not(.ssr-ad-active),
      .ssr-ad-slot[hidden],
      .ssr-ad-slot[data-ads-disabled="true"] {
        display: none !important;
        height: 0 !important;
        min-height: 0 !important;
        max-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        overflow: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Active Ad Container styling with pre-reserved aspect-ratio and min-height to guarantee CLS = 0 */
      .ssr-ad-slot.ssr-ad-active {
        display: flex !important;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        max-width: 728px;
        min-height: 90px !important;
        max-height: none !important;
        aspect-ratio: 728 / 90;
        margin: 12px auto;
        background: rgba(14, 10, 26, 0.6);
        border: 1px solid rgba(0, 230, 255, 0.2);
        border-radius: 6px;
        overflow: hidden;
      }

      .ssr-ad-slot.ssr-ad-active.ssr-ad-rectangle {
        max-width: 300px;
        min-height: 250px !important;
        aspect-ratio: 300 / 250;
      }

      /* In-game Overlay Ad Containers (Start screen & GameOver screen) */
      #ssr-ad-slot-menu.ssr-ad-active {
        position: absolute;
        bottom: 12px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
        max-width: min(728px, 92vw);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
      }

      #ssr-ad-slot-gameover.ssr-ad-active {
        position: absolute;
        bottom: 12px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
        max-width: min(300px, 90vw);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
      }

      /* Interactive Test Ad Creative Simulation */
      .ssr-ad-test-banner {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        padding: 8px 16px;
        background: linear-gradient(135deg, rgba(28, 18, 54, 0.95), rgba(12, 8, 26, 0.95));
        border: 1px solid rgba(0, 230, 255, 0.4);
        box-sizing: border-box;
        font-family: Arial, sans-serif;
        color: #fff;
        user-select: none;
        position: relative;
        overflow: hidden;
      }

      .ssr-ad-test-banner::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, #ff0080, #00e6ff, #ffe600);
      }

      .ssr-ad-test-tag {
        position: absolute;
        top: 3px;
        right: 8px;
        font-size: 9px;
        color: rgba(255, 255, 255, 0.7);
        background: rgba(0, 0, 0, 0.6);
        padding: 1px 6px;
        border-radius: 3px;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 4px;
        pointer-events: none;
      }

      .ssr-ad-test-tag span.badge {
        color: #ffe600;
        font-weight: bold;
      }

      .ssr-ad-test-left {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        min-width: 0;
      }

      .ssr-ad-test-icon {
        font-size: 28px;
        line-height: 1;
        background: rgba(0, 230, 255, 0.15);
        border: 1px solid rgba(0, 230, 255, 0.4);
        border-radius: 8px;
        padding: 4px 8px;
        flex-shrink: 0;
      }

      .ssr-ad-test-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        overflow: hidden;
      }

      .ssr-ad-test-title {
        font-size: 13px;
        font-weight: bold;
        color: #00e6ff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        letter-spacing: 0.5px;
      }

      .ssr-ad-test-desc {
        font-size: 11px;
        color: #d1c7e8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ssr-ad-test-meta {
        font-size: 9px;
        color: #928ba8;
        font-family: monospace;
      }

      .ssr-ad-test-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 5px;
        flex-shrink: 0;
        margin-left: 14px;
      }

      .ssr-ad-test-rating {
        font-size: 11px;
        color: #ffe600;
        letter-spacing: 1px;
      }

      .ssr-ad-test-btn {
        background: linear-gradient(135deg, #ff0080, #7928ca);
        color: #ffffff;
        font-weight: bold;
        font-size: 11px;
        padding: 5px 14px;
        border-radius: 20px;
        border: 1px solid rgba(255, 0, 128, 0.6);
        box-shadow: 0 0 10px rgba(255, 0, 128, 0.4);
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 0.8px;
      }

      /* Rectangle format (300x250) */
      .ssr-ad-test-banner.rectangle {
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        text-align: center;
        padding: 18px 14px 12px;
      }

      .ssr-ad-test-banner.rectangle .ssr-ad-test-left {
        flex-direction: column;
        justify-content: center;
        gap: 8px;
        text-align: center;
      }

      .ssr-ad-test-banner.rectangle .ssr-ad-test-icon {
        font-size: 38px;
        padding: 8px 14px;
      }

      .ssr-ad-test-banner.rectangle .ssr-ad-test-text {
        align-items: center;
      }

      .ssr-ad-test-banner.rectangle .ssr-ad-test-title {
        font-size: 15px;
        white-space: normal;
      }

      .ssr-ad-test-banner.rectangle .ssr-ad-test-desc {
        white-space: normal;
        font-size: 12px;
        line-height: 1.3;
      }

      .ssr-ad-test-banner.rectangle .ssr-ad-test-right {
        align-items: center;
        margin-left: 0;
        width: 100%;
      }

      .ssr-ad-test-banner.rectangle .ssr-ad-test-btn {
        width: 80%;
        padding: 7px 0;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Synchronizes DOM ad containers with feature-flag, consent state, and screen.
   * Never displays empty "ad here" boxes when ads are disabled or unconsented.
   */
  public syncDomSlots(): void {
    if (typeof document === 'undefined') return;

    const allowed = this.canLoadAds();
    if (!allowed) {
      this.hideAllSlots();
      return;
    }

    // Determine which slot is eligible based on currentGameState
    // Menu ad: only on 'START'
    // GameOver ad: only on 'GAMEOVER'
    // Gameplay ('PLAYING' or 'PAUSED'): ALL in-game ads are hidden!
    for (const [key, slot] of Object.entries(this.slots)) {
      const el = document.getElementById(slot.id);
      if (!el) continue;

      let shouldShow = false;
      if (key === 'menu' && this.currentGameState === 'START') {
        shouldShow = true;
      } else if (key === 'gameOver' && this.currentGameState === 'GAMEOVER') {
        shouldShow = true;
      } else if (key === 'belowGame' || key === 'editorialMid') {
        // Editorial content ads below canvas are eligible when ads are enabled
        shouldShow = true;
      }

      const effectiveSlotId =
        slot.slotId && slot.slotId.trim() !== ''
          ? slot.slotId.trim()
          : this.testMode
          ? '1234567890'
          : '';

      if (!shouldShow || !effectiveSlotId) {
        this.hideSlotElement(el);
      } else {
        this.showSlotElement(el, { ...slot, slotId: effectiveSlotId });
      }
    }
  }

  private showSlotElement(el: HTMLElement, slot: AdSlotConfig): void {
    el.hidden = false;
    el.removeAttribute('aria-hidden');
    el.removeAttribute('data-ads-disabled');
    el.style.display = '';
    el.classList.add('ssr-ad-active');
    if (slot.format === 'rectangle') {
      el.classList.add('ssr-ad-rectangle');
    }

    if (this.testMode && !el.querySelector('.ssr-ad-test-banner')) {
      const banner = document.createElement('div');
      const isRect = slot.format === 'rectangle';
      banner.className = `ssr-ad-test-banner ${isRect ? 'rectangle' : 'horizontal'}`;

      const icon = isRect ? '🏎️' : '⚡';
      const title = isRect ? 'NEON OVERDRIVE: CYBER RACER' : 'NEON TURBO: SYNTHWAVE ACCESSORIES';
      const desc = isRect
        ? 'Join 500,000+ drivers in the ultimate retro arcade simulator. Instant play!'
        : 'Upgrade your racing reflexes with official synthwave accessories. Free worldwide shipping!';
      const btnText = isRect ? 'PLAY FREE' : 'GET 20% OFF';

      banner.innerHTML = `
        <div class="ssr-ad-test-tag">
          <span class="badge">Ad</span> Google AdSense Test Unit &bull; &#9432;
        </div>
        <div class="ssr-ad-test-left">
          <div class="ssr-ad-test-icon">${icon}</div>
          <div class="ssr-ad-test-text">
            <span class="ssr-ad-test-title">${title}</span>
            <span class="ssr-ad-test-desc">${desc}</span>
            <span class="ssr-ad-test-meta">ID: ${this.clientId} | Slot: ${slot.slotId}</span>
          </div>
        </div>
        <div class="ssr-ad-test-right">
          <span class="ssr-ad-test-rating">&#9733;&#9733;&#9733;&#9733;&#9733; 4.9</span>
          <button type="button" class="ssr-ad-test-btn" onclick="alert('Google AdSense Test Click: This is a test simulation. Real commercial ads load after your domain is approved by Google AdSense.')">${btnText}</button>
        </div>
      `;
      el.appendChild(banner);
    }

    if (!el.querySelector('ins.adsbygoogle')) {
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', this.clientId);
      ins.setAttribute('data-ad-slot', slot.slotId);
      ins.setAttribute('data-ad-format', slot.format);
      ins.setAttribute('data-full-width-responsive', 'true');
      if (this.testMode) {
        ins.setAttribute('data-adtest', 'on');
      }
      el.appendChild(ins);
      this.injectAdSenseScriptOnce();
    }
  }

  private hideSlotElement(el: HTMLElement): void {
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-ads-disabled', 'true');
    el.classList.remove('ssr-ad-active', 'ssr-ad-rectangle');
    el.style.display = 'none';
    el.innerHTML = '';
  }

  public hideAllSlots(): void {
    if (typeof document === 'undefined') return;
    for (const slot of Object.values(this.slots)) {
      const el = document.getElementById(slot.id);
      if (el) {
        this.hideSlotElement(el);
      }
    }
  }

  private injectAdSenseScriptOnce(): void {
    if (this.scriptInjected || typeof document === 'undefined') return;
    this.scriptInjected = true;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
      this.clientId
    )}`;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);

    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      const activeIns = document.querySelectorAll('.ssr-ad-slot.ssr-ad-active ins.adsbygoogle');
      activeIns.forEach(() => {
        w.adsbygoogle?.push({});
      });
    } catch {
      // Safe ignore
    }
  }
}
