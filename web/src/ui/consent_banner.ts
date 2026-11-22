/**
 * EEA / UK Cookie Consent Banner & Preferences Modal UI.
 * Displays symmetric, equal-prominence "Accept All Cookies" and "Reject Non-Essential" controls,
 * with persistent "Cookie Settings" modal trigger in the footer.
 */

import { ConsentManager } from '../compliance/consent';

export class ConsentBannerUI {
  private readonly consent: ConsentManager;
  private bannerEl: HTMLElement | null = null;
  private modalEl: HTMLElement | null = null;

  constructor(consent: ConsentManager) {
    this.consent = consent;
  }

  public mount(): void {
    if (typeof document === 'undefined') return;
    this.createStyles();
    this.createBanner();
    this.createModal();
    this.bindFooterTriggers();

    if (this.consent.needsBanner()) {
      this.show();
    }
  }

  private createStyles(): void {
    if (document.getElementById('ssr-consent-styles')) return;

    const style = document.createElement('style');
    style.id = 'ssr-consent-styles';
    style.textContent = `
      .ssr-consent-banner {
        position: fixed;
        left: 16px;
        right: 16px;
        bottom: 16px;
        max-width: 920px;
        margin: 0 auto;
        background: rgba(14, 10, 28, 0.98);
        border: 2px solid #00e6ff;
        border-radius: 12px;
        padding: 20px 24px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.85), 0 0 30px rgba(0, 230, 255, 0.3);
        color: #e0d8f0;
        z-index: 10000;
        display: none;
        flex-direction: column;
        gap: 14px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-sizing: border-box;
      }

      .ssr-consent-banner.visible {
        display: flex;
        animation: ssrSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes ssrSlideIn {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .ssr-consent-title {
        font-size: 16px;
        font-weight: 700;
        color: #00e6ff;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .ssr-consent-text {
        font-size: 13.5px;
        line-height: 1.6;
        color: #c8c0d8;
      }

      .ssr-consent-text a {
        color: #00e6ff;
        text-decoration: underline;
      }

      .ssr-consent-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: flex-end;
        align-items: center;
      }

      .ssr-consent-status {
        font-size: 12px;
        color: #9ba5be;
        margin-right: auto;
      }

      .ssr-consent-btn {
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 13.5px;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.1s, box-shadow 0.15s, background 0.15s;
        text-align: center;
        border: 2px solid transparent;
        white-space: nowrap;
      }

      .ssr-consent-btn:hover {
        transform: translateY(-1px);
      }

      /* Equal prominence for Reject and Accept */
      .ssr-consent-btn-reject {
        background: rgba(30, 20, 50, 0.95);
        border: 2px solid #ff0080;
        color: #ff3399;
        box-shadow: 0 0 14px rgba(255, 0, 128, 0.25);
      }

      .ssr-consent-btn-reject:hover {
        background: rgba(255, 0, 128, 0.18);
        color: #ff66b2;
        box-shadow: 0 0 20px rgba(255, 0, 128, 0.45);
      }

      .ssr-consent-btn-accept {
        background: rgba(10, 30, 48, 0.95);
        border: 2px solid #00e6ff;
        color: #00e6ff;
        box-shadow: 0 0 14px rgba(0, 230, 255, 0.3);
      }

      .ssr-consent-btn-accept:hover {
        background: #00e6ff;
        color: #08040f;
        box-shadow: 0 0 22px rgba(0, 230, 255, 0.6);
      }

      .ssr-consent-btn-customize {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: #b0a4cc;
        font-size: 12.5px;
        padding: 8px 14px;
      }

      .ssr-consent-btn-customize:hover {
        color: #ffffff;
        border-color: #00e6ff;
      }

      /* Preferences Modal (uniquely namespaced so it never collides with PrivacyModalUI) */
      .ssr-consent-modal-backdrop {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(8, 4, 18, 0.85);
        backdrop-filter: blur(8px);
        z-index: 100001 !important;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 16px;
        box-sizing: border-box;
      }

      .ssr-consent-modal-backdrop.visible {
        display: flex !important;
        animation: ssrFade 0.2s ease-out;
      }

      @keyframes ssrFade {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .ssr-consent-modal-box {
        background: #120c26;
        border: 2px solid #00e6ff;
        border-radius: 12px;
        width: 100%;
        max-width: 580px;
        padding: 24px;
        color: #e0d8f0;
        box-shadow: 0 0 40px rgba(0, 230, 255, 0.35);
        max-height: 85vh;
        overflow-y: auto;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      .ssr-consent-modal-title-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 12px;
      }

      .ssr-consent-modal-title-bar h3 {
        margin: 0;
        font-size: 20px;
        color: #00e6ff;
      }

      .ssr-consent-modal-status {
        font-size: 12.5px;
        color: #9beeff;
        background: rgba(0, 230, 255, 0.1);
        border: 1px solid rgba(0, 230, 255, 0.3);
        border-radius: 6px;
        padding: 8px 12px;
        margin-bottom: 10px;
      }

      .ssr-consent-modal-close-btn {
        background: none;
        border: none;
        color: #9ba5be;
        font-size: 26px;
        cursor: pointer;
        line-height: 1;
      }

      .ssr-consent-modal-close-btn:hover {
        color: #ff0080;
      }

      .ssr-cookie-category {
        padding: 14px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .ssr-category-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }

      .ssr-category-title {
        font-weight: 700;
        font-size: 15px;
        color: #ffffff;
      }

      .ssr-badge-required {
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 10px;
        background: rgba(0, 255, 140, 0.15);
        color: #00ff8c;
        border: 1px solid #00ff8c;
      }

      .ssr-category-desc {
        font-size: 13px;
        color: #b0a4cc;
        line-height: 1.5;
        margin: 0;
      }
    `;
    document.head.appendChild(style);
  }

  private createBanner(): void {
    if (document.getElementById('ssr-consent-banner')) return;

    this.bannerEl = document.createElement('aside');
    this.bannerEl.id = 'ssr-consent-banner';
    this.bannerEl.className = 'ssr-consent-banner';
    this.bannerEl.setAttribute('role', 'dialog');
    this.bannerEl.setAttribute('aria-label', 'Cookie and Privacy Preferences');

    this.bannerEl.innerHTML = `
      <div class="ssr-consent-title">
        <span>🍪</span> Cookie &amp; Privacy Preferences (EEA / UK Notice)
      </div>
      <div class="ssr-consent-text">
        <strong>Shape-Shift Racer by Sarthak</strong> stores essential game progress, top-5 scores, and calibration data locally on your device in browser <code>localStorage</code>.
        Your webcam video stream is processed <strong>100% locally in WebAssembly RAM</strong> and is never recorded or transmitted to any server.
        Optional advertising cookies (Google AdSense) remain <strong>strictly disabled</strong> until you grant consent and ads are enabled.
        Learn more in our <a href="./privacy.html">Privacy Policy</a>.
      </div>
      <div class="ssr-consent-actions">
        <span id="ssr-consent-status-text" class="ssr-consent-status"></span>
        <button id="ssr-consent-customize" class="ssr-consent-btn ssr-consent-btn-customize" type="button">
          Customize
        </button>
        <button id="ssr-consent-reject" class="ssr-consent-btn ssr-consent-btn-reject" type="button">
          Reject Non-Essential
        </button>
        <button id="ssr-consent-accept" class="ssr-consent-btn ssr-consent-btn-accept" type="button">
          Accept All Cookies
        </button>
      </div>
    `;

    document.body.appendChild(this.bannerEl);

    const btnReject = this.bannerEl.querySelector('#ssr-consent-reject');
    const btnAccept = this.bannerEl.querySelector('#ssr-consent-accept');
    const btnCustomize = this.bannerEl.querySelector('#ssr-consent-customize');

    btnReject?.addEventListener('click', () => {
      this.consent.rejectNonEssential();
      this.hide();
    });

    btnAccept?.addEventListener('click', () => {
      this.consent.acceptAll();
      this.hide();
    });

    btnCustomize?.addEventListener('click', () => {
      this.openModal();
    });
  }

  private createModal(): void {
    if (document.getElementById('ssr-consent-modal-backdrop')) return;

    this.modalEl = document.createElement('div');
    this.modalEl.id = 'ssr-consent-modal-backdrop';
    this.modalEl.className = 'ssr-consent-modal-backdrop';
    this.modalEl.setAttribute('role', 'dialog');
    this.modalEl.setAttribute('aria-modal', 'true');
    this.modalEl.setAttribute('aria-labelledby', 'ssr-modal-heading');

    this.modalEl.innerHTML = `
      <div class="ssr-consent-modal-box">
        <div class="ssr-consent-modal-title-bar">
          <h3 id="ssr-modal-heading">Cookie &amp; Privacy Settings</h3>
          <button id="ssr-modal-close" class="ssr-consent-modal-close-btn" aria-label="Close modal">&times;</button>
        </div>

        <div id="ssr-consent-modal-status" class="ssr-consent-modal-status"></div>

        <div class="ssr-cookie-category">
          <div class="ssr-category-header">
            <span class="ssr-category-title">1. Essential Game Storage</span>
            <span class="ssr-badge-required">Always Active</span>
          </div>
          <p class="ssr-category-desc">
            Required for game operation: stores your Top 5 leaderboard scores, facial gesture calibration values, audio mute states, and privacy preferences locally in browser <code>localStorage</code>. No personal identification data is collected.
          </p>
        </div>

        <div class="ssr-cookie-category">
          <div class="ssr-category-header">
            <span class="ssr-category-title">2. On-Device Facial AI Processing</span>
            <span class="ssr-badge-required">100% Local</span>
          </div>
          <p class="ssr-category-desc">
            Camera video frames are processed completely on-device in WebAssembly client memory. Video data is never stored on disk, never uploaded to any server, and never shared with third parties.
          </p>
        </div>

        <div class="ssr-cookie-category">
          <div class="ssr-category-header">
            <span class="ssr-category-title">3. Advertising &amp; Analytics (Google AdSense)</span>
          </div>
          <p class="ssr-category-desc">
            Google AdSense tags (when active after approval) deliver advertisements to support free access. When rejected or disabled, non-essential advertising cookies stay strictly off.
          </p>
        </div>

        <div class="ssr-consent-actions" style="margin-top: 20px;">
          <button id="ssr-modal-reject" class="ssr-consent-btn ssr-consent-btn-reject" type="button">
            Reject Non-Essential
          </button>
          <button id="ssr-modal-accept" class="ssr-consent-btn ssr-consent-btn-accept" type="button">
            Accept All Cookies
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modalEl);

    this.modalEl.querySelector('#ssr-modal-close')?.addEventListener('click', () => {
      this.closeModal();
    });

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.closeModal();
      }
    });

    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' && this.modalEl?.classList.contains('visible')) {
          e.stopPropagation();
          this.closeModal();
        }
      },
      true
    );

    this.modalEl.querySelector('#ssr-modal-reject')?.addEventListener('click', () => {
      this.consent.rejectNonEssential();
      this.syncModalStatus();
      this.closeModal();
      this.hide();
    });

    this.modalEl.querySelector('#ssr-modal-accept')?.addEventListener('click', () => {
      this.consent.acceptAll();
      this.syncModalStatus();
      this.closeModal();
      this.hide();
    });
  }

  private bindFooterTriggers(): void {
    // Listen to click on any element with id="btn-cookie-settings" or class="cookie-settings-btn"
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.id === 'btn-cookie-settings' ||
        target.classList.contains('cookie-settings-btn') ||
        target.closest('#btn-cookie-settings') ||
        target.closest('.cookie-settings-btn')
      ) {
        e.preventDefault();
        this.openModal();
      }
    });
  }

  public show(): void {
    if (!this.bannerEl) return;
    const statusEl = this.bannerEl.querySelector('#ssr-consent-status-text');
    if (statusEl) {
      const rec = this.consent.getRecord();
      if (rec.status === 'accepted') {
        statusEl.textContent = 'Status: All Cookies Accepted';
      } else if (rec.status === 'rejected') {
        statusEl.textContent = 'Status: Essential Only (Ads Off)';
      } else {
        statusEl.textContent = 'Status: Pending Choice';
      }
    }
    this.bannerEl.classList.add('visible');
  }

  public hide(): void {
    if (this.bannerEl) {
      this.bannerEl.classList.remove('visible');
    }
  }

  private syncModalStatus(): void {
    if (!this.modalEl) return;
    const statusEl = this.modalEl.querySelector('#ssr-consent-modal-status');
    if (!statusEl) return;
    const rec = this.consent.getRecord();
    if (rec.status === 'accepted') {
      statusEl.textContent = 'Current choice: All cookies accepted (ads remain off until enabled).';
    } else if (rec.status === 'rejected') {
      statusEl.textContent = 'Current choice: Essential storage only (non-essential cookies & ads off).';
    } else {
      statusEl.textContent = 'Current choice: Not set yet (ads off by default).';
    }
  }

  public openModal(): void {
    this.syncModalStatus();
    this.modalEl?.classList.add('visible');
  }

  public closeModal(): void {
    this.modalEl?.classList.remove('visible');
  }
}
