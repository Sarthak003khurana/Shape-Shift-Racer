/**
 * Viral Share & Challenge System
 * Enables 100% organic, faceless, zero-cost player-to-player distribution:
 * - 1-tap "Copy Challenge" with stats pre-formatted for chat apps
 * - 1-tap WhatsApp direct share
 * - 1-tap Twitter / X share
 * - Native mobile Web Share API integration (Messages, Telegram, Discord, etc.)
 */

export interface GameOverStats {
  score: number;
  distance: number;
  maxStreak: number;
  coins: number;
}

export class ViralShareUI {
  private container: HTMLElement | null = null;
  private overlayEl: HTMLElement | null = null;
  private latestStats: GameOverStats = { score: 0, distance: 0, maxStreak: 0, coins: 0 };
  private boundStateListener: ((e: Event) => void) | null = null;
  private boundStatsListener: ((e: Event) => void) | null = null;
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  public mount(container: HTMLElement): void {
    if (typeof document === 'undefined') return;
    this.container = container;
    this.createStyles();
    this.createOverlay();
    this.bindEvents();
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.boundStateListener) {
        window.removeEventListener('ssr-gamestate-change', this.boundStateListener);
        this.boundStateListener = null;
      }
      if (this.boundStatsListener) {
        window.removeEventListener('ssr-gameover-stats', this.boundStatsListener);
        this.boundStatsListener = null;
      }
    }
    if (this.overlayEl && this.overlayEl.parentElement) {
      this.overlayEl.parentElement.removeChild(this.overlayEl);
      this.overlayEl = null;
    }
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }
  }

  private createStyles(): void {
    if (document.getElementById('ssr-share-styles')) return;

    const style = document.createElement('style');
    style.id = 'ssr-share-styles';
    style.textContent = `
      .ssr-share-overlay {
        position: absolute;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 50;
        width: 92%;
        max-width: 660px;
        display: none;
        flex-direction: column;
        align-items: center;
        pointer-events: auto;
        animation: ssrShareFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .ssr-share-overlay.visible {
        display: flex;
      }

      @keyframes ssrShareFadeIn {
        from { opacity: 0; transform: translate(-50%, 15px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }

      .ssr-share-card {
        width: 100%;
        background: linear-gradient(135deg, rgba(22, 14, 42, 0.96), rgba(12, 8, 26, 0.98));
        border: 2px solid #00e6ff;
        border-radius: 12px;
        padding: 12px 18px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 230, 255, 0.35);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        box-sizing: border-box;
      }

      .ssr-share-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
      }

      .ssr-share-title {
        font-family: Impact, sans-serif;
        font-size: 17px;
        letter-spacing: 0.8px;
        color: #ffe600;
        text-transform: uppercase;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .ssr-share-stat-badge {
        font-size: 11.5px;
        color: #00e6ff;
        background: rgba(0, 230, 255, 0.12);
        border: 1px solid rgba(0, 230, 255, 0.4);
        border-radius: 14px;
        padding: 2px 10px;
        font-family: monospace;
      }

      .ssr-share-btn-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        width: 100%;
        justify-content: center;
      }

      .ssr-share-btn {
        flex: 1 1 140px;
        max-width: 200px;
        padding: 9px 12px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: transform 0.1s, box-shadow 0.1s, background-color 0.15s;
        border: none;
        user-select: none;
        -webkit-user-select: none;
        text-decoration: none;
        box-sizing: border-box;
      }

      .ssr-share-btn:active {
        transform: scale(0.96);
      }

      .ssr-btn-copy {
        background: linear-gradient(135deg, #00e6ff, #0088ff);
        color: #050510;
        box-shadow: 0 0 12px rgba(0, 230, 255, 0.3);
      }

      .ssr-btn-whatsapp {
        background: linear-gradient(135deg, #25d366, #128c7e);
        color: #ffffff;
        box-shadow: 0 0 12px rgba(37, 211, 102, 0.3);
      }

      .ssr-btn-twitter {
        background: linear-gradient(135deg, #1d9bf0, #0c7abf);
        color: #ffffff;
        box-shadow: 0 0 12px rgba(29, 155, 240, 0.3);
      }

      .ssr-btn-native {
        background: linear-gradient(135deg, #ff0080, #7928ca);
        color: #ffffff;
        box-shadow: 0 0 12px rgba(255, 0, 128, 0.3);
      }

      .ssr-share-toast {
        font-size: 12px;
        color: #64ff8c;
        background: rgba(100, 255, 140, 0.15);
        border: 1px solid rgba(100, 255, 140, 0.5);
        padding: 4px 12px;
        border-radius: 12px;
        animation: ssrShareToastIn 0.2s ease-out;
        display: none;
      }

      .ssr-share-toast.visible {
        display: block;
      }

      @keyframes ssrShareToastIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }

      @media (max-width: 600px) {
        .ssr-share-overlay {
          bottom: 12px;
          width: 95%;
        }
        .ssr-share-card {
          padding: 8px 12px;
          gap: 6px;
        }
        .ssr-share-title {
          font-size: 14px;
        }
        .ssr-share-btn {
          font-size: 11.5px;
          padding: 7px 8px;
          flex: 1 1 100px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  private createOverlay(): void {
    if (!this.container) return;

    this.overlayEl = document.createElement('div');
    this.overlayEl.id = 'ssr-share-overlay';
    this.overlayEl.className = 'ssr-share-overlay';
    this.overlayEl.innerHTML = `
      <div class="ssr-share-card">
        <div class="ssr-share-header">
          <span class="ssr-share-title">⚡ CHALLENGE A FRIEND</span>
          <span class="ssr-share-stat-badge" id="ssr-share-stat-badge">0 pts</span>
        </div>
        <div class="ssr-share-btn-row">
          <button type="button" id="ssr-btn-copy-score" class="ssr-share-btn ssr-btn-copy" aria-label="Copy Score Challenge">
            📋 Copy Challenge
          </button>
          <button type="button" id="ssr-btn-whatsapp" class="ssr-share-btn ssr-btn-whatsapp" aria-label="Share via WhatsApp">
            💬 WhatsApp
          </button>
          <button type="button" id="ssr-btn-twitter" class="ssr-share-btn ssr-btn-twitter" aria-label="Share via X">
            𝕏 Share
          </button>
          <button type="button" id="ssr-btn-native-share" class="ssr-share-btn ssr-btn-native" style="display: none;" aria-label="Share Challenge Sheet">
            🚀 More Apps
          </button>
        </div>
        <div id="ssr-share-toast" class="ssr-share-toast">✓ Challenge link copied to clipboard!</div>
      </div>
    `;

    this.container.appendChild(this.overlayEl);

    // Bind button listeners
    const btnCopy = this.overlayEl.querySelector('#ssr-btn-copy-score');
    const btnWhatsApp = this.overlayEl.querySelector('#ssr-btn-whatsapp');
    const btnTwitter = this.overlayEl.querySelector('#ssr-btn-twitter');
    const btnNative = this.overlayEl.querySelector('#ssr-btn-native-share') as HTMLButtonElement | null;

    if (btnCopy) {
      btnCopy.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyChallengeToClipboard();
      });
    }

    if (btnWhatsApp) {
      btnWhatsApp.addEventListener('click', (e) => {
        e.stopPropagation();
        this.shareWhatsApp();
      });
    }

    if (btnTwitter) {
      btnTwitter.addEventListener('click', (e) => {
        e.stopPropagation();
        this.shareTwitter();
      });
    }

    if (btnNative && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      btnNative.style.display = 'flex';
      btnNative.addEventListener('click', (e) => {
        e.stopPropagation();
        this.shareNative();
      });
    }
  }

  private bindEvents(): void {
    if (typeof window === 'undefined') return;

    this.boundStatsListener = (e: Event) => {
      const customEvt = e as CustomEvent<GameOverStats>;
      if (customEvt.detail) {
        this.latestStats = { ...customEvt.detail };
        this.updateStatsDisplay();
      }
    };
    window.addEventListener('ssr-gameover-stats', this.boundStatsListener);

    this.boundStateListener = (e: Event) => {
      const customEvt = e as CustomEvent<{ state: string }>;
      if (customEvt.detail && customEvt.detail.state) {
        if (customEvt.detail.state === 'GAMEOVER') {
          this.show();
        } else {
          this.hide();
        }
      }
    };
    window.addEventListener('ssr-gamestate-change', this.boundStateListener);
  }

  public show(): void {
    if (!this.overlayEl) return;
    this.updateStatsDisplay();
    this.overlayEl.classList.add('visible');
  }

  public hide(): void {
    if (!this.overlayEl) return;
    this.overlayEl.classList.remove('visible');
    const toast = this.overlayEl.querySelector('#ssr-share-toast');
    if (toast) {
      toast.classList.remove('visible');
    }
  }

  private updateStatsDisplay(): void {
    if (!this.overlayEl) return;
    const badge = this.overlayEl.querySelector('#ssr-share-stat-badge');
    if (badge) {
      badge.textContent = `${this.latestStats.score} pts • ${this.latestStats.distance}m • ${this.latestStats.maxStreak}x`;
    }
  }

  public getShareText(): string {
    const { score, distance, maxStreak } = this.latestStats;
    return `🏎️ Shape-Shift Racer: I just scored ${score} pts (${distance}m, ${maxStreak}x streak)! Can you beat me? Play free: https://racer.sarthak.sbs`;
  }

  public async copyChallengeToClipboard(): Promise<void> {
    const text = this.getShareText();
    let copied = false;

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        // Fallback
      }
    }

    if (!copied && typeof document !== 'undefined') {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        // Safe ignore
      }
    }

    this.showToast(copied ? '✓ Challenge copied to clipboard!' : 'Failed to copy');
  }

  public shareWhatsApp(): void {
    const text = encodeURIComponent(this.getShareText());
    const url = `https://api.whatsapp.com/send?text=${text}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  public shareTwitter(): void {
    const text = encodeURIComponent(this.getShareText());
    const url = `https://twitter.com/intent/tweet?text=${text}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  public async shareNative(): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Shape-Shift Racer Challenge',
          text: this.getShareText(),
          url: 'https://racer.sarthak.sbs',
        });
      } catch {
        // Ignore user cancel
      }
    }
  }

  private showToast(msg: string): void {
    if (!this.overlayEl) return;
    const toast = this.overlayEl.querySelector('#ssr-share-toast');
    if (!toast) return;

    toast.textContent = msg;
    toast.classList.add('visible');

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2800);
  }
}
