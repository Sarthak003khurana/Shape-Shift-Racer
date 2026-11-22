/**
 * Unit Test Suite for Milestone 4 & 5 Compliance, Cookie Consent, Feature-Flagged Ads,
 * Self-Hosted Assets, Base-Path Portability, and Hard-Limit Invariants.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ADS_ENABLED, CONTACT_EMAIL } from '../src/config';
import { ConsentManager, detectEeaUkRegion } from '../src/compliance/consent';
import { AdManager } from '../src/compliance/ads';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Mock window.localStorage in Node environment
const store: Record<string, string> = {};
(globalThis as unknown as { window: Record<string, unknown> }).window =
  (globalThis as unknown as { window?: Record<string, unknown> }).window || {};
((globalThis as unknown as { window: Record<string, unknown> }).window as Record<string, unknown>).localStorage = {
  getItem: (key: string) => (key in store ? store[key] : null),
  setItem: (key: string, val: string) => {
    store[key] = val;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

console.log('Running Compliance, Consent, Feature-Flagged Ads & Packaging Tests...\n');

// 1. Default feature flag & branding checks
{
  assert(ADS_ENABLED === false, 'ADS_ENABLED must default to false before AdSense approval');
  assert(
    CONTACT_EMAIL === 'shapeshifttracer@gmail.com' || CONTACT_EMAIL === '[CONTACT_EMAIL]',
    'CONTACT_EMAIL must be configured email or placeholder'
  );
  console.log('✓ 1. Default ADS_ENABLED=false and CONTACT_EMAIL verified.');
}

// 2. EEA / UK region heuristic detection
{
  assert(detectEeaUkRegion('Europe/London', ['en-GB']) === true, 'London should be detected as EEA/UK');
  assert(detectEeaUkRegion('Europe/Berlin', ['de-DE']) === true, 'Berlin should be detected as EEA/UK');
  assert(detectEeaUkRegion('Europe/Paris', ['fr-FR']) === true, 'Paris should be detected as EEA/UK');
  assert(detectEeaUkRegion('America/New_York', ['en-US']) === false, 'New York should not be EEA/UK');
  assert(detectEeaUkRegion('Asia/Kolkata', ['en-IN']) === false, 'Kolkata should not be EEA/UK');
  console.log('✓ 2. EEA/UK timezone & locale detection verified.');
}

// 3. ConsentManager lifecycle & EEA/UK opt-in enforcement
{
  (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage.clear();

  const eeaConsent = new ConsentManager(true);
  assert(eeaConsent.needsBanner() === true, 'EEA/UK visitor with unset consent must see banner');
  assert(eeaConsent.isAdsAllowed() === false, 'EEA/UK visitor must have ads blocked before consent');

  let listenerCalls = 0;
  const unsub = eeaConsent.subscribe(() => {
    listenerCalls++;
  });

  eeaConsent.acceptAll();
  assert(eeaConsent.needsBanner() === false, 'Banner hidden after accepting');
  assert(eeaConsent.isAdsAllowed() === true, 'EEA/UK ads allowed after explicit accept');
  assert(listenerCalls === 1, 'Consent subscriber notified on accept');

  eeaConsent.rejectNonEssential();
  assert(eeaConsent.isAdsAllowed() === false, 'EEA/UK ads blocked after rejecting');
  assert(listenerCalls === 2, 'Consent subscriber notified on reject');

  // Persistence check
  const reloaded = new ConsentManager(true);
  assert(reloaded.getRecord().status === 'rejected', 'Rejected choice persists across reload');
  assert(reloaded.needsBanner() === false, 'Banner stays hidden when choice is saved');

  unsub();
  console.log('✓ 3. ConsentManager EEA/UK opt-in, revocation, and persistence verified.');
}

// 4. AdManager double-gating (feature flag + valid publisher ID + consent)
{
  (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage.clear();
  const consent = new ConsentManager(true);
  consent.acceptAll();

  // Case A: Feature flag OFF -> NEVER loads ads even with valid ID and accepted consent
  const adsFlagOff = new AdManager(consent, {
    adsEnabled: false,
    clientId: 'ca-pub-1234567890123456',
  });
  assert(adsFlagOff.canLoadAds() === false, 'Ads MUST stay off when adsEnabled=false');

  // Case B: Feature flag ON, empty/placeholder ID -> NEVER loads ads
  const adsNoId = new AdManager(consent, {
    adsEnabled: true,
    clientId: '',
  });
  assert(adsNoId.canLoadAds() === false, 'Ads MUST stay off when publisher ID is missing');

  // Case C: Feature flag ON + valid ID + EEA/UK rejected -> NEVER loads ads
  consent.rejectNonEssential();
  const adsRejected = new AdManager(consent, {
    adsEnabled: true,
    clientId: 'ca-pub-1234567890123456',
  });
  assert(adsRejected.canLoadAds() === false, 'Ads MUST stay off when consent is rejected');

  // Case D: Feature flag ON + valid ID + EEA/UK accepted -> allowed
  consent.acceptAll();
  assert(adsRejected.hasValidPublisherId() === true, 'Valid publisher ID recognized');
  assert(
    adsRejected.canLoadAds() === true,
    'Ads allowed ONLY when flag=true, valid ID, and consented'
  );
  console.log('✓ 4. AdManager strict gating (feature flag + publisher ID + consent) verified.');
}

// 5. Static HTML pages, relative URL portability, Apache 2.0 notice, and zero Face_Pose files
{
  const pages = ['index.html', 'privacy.html', 'terms.html', 'credits.html', 'contact.html'];
  for (const page of pages) {
    const filePath = path.join(webRoot, page);
    assert(fs.existsSync(filePath), `Missing required page: ${page}`);
    const content = fs.readFileSync(filePath, 'utf-8');
    assert(
      content.includes('Shape-Shift Racer by Sarthak'),
      `${page} must contain branding "Shape-Shift Racer by Sarthak"`
    );
    // Ensure no hardcoded root-absolute href="/" or src="/" paths that break sub-path deployments
    assert(
      !/(?:href|src)="\/(?!\/)/.test(content),
      `${page} contains hardcoded root-absolute URL that breaks sub-path hosting`
    );
  }

  for (const contactPage of ['privacy.html', 'terms.html', 'contact.html']) {
    const content = fs.readFileSync(path.join(webRoot, contactPage), 'utf-8');
    assert(
      content.includes('shapeshifttracer@gmail.com') || content.includes('[CONTACT_EMAIL]'),
      `${contactPage} must contain configured contact email`
    );
  }

  const creditsContent = fs.readFileSync(path.join(webRoot, 'credits.html'), 'utf-8');
  assert(creditsContent.includes('Apache License, Version 2.0'), 'credits.html must include Apache 2.0 notice');
  assert(creditsContent.includes('face_landmarker.task'), 'credits.html must credit face_landmarker.task');

  // Verify self-hosted MediaPipe files exist
  assert(fs.existsSync(path.join(webRoot, 'public/mediapipe/LICENSE')), 'MediaPipe LICENSE missing');
  assert(
    fs.existsSync(path.join(webRoot, 'public/mediapipe/models/face_landmarker.task')),
    'face_landmarker.task missing'
  );
  assert(
    fs.existsSync(path.join(webRoot, 'public/mediapipe/wasm/vision_wasm_internal.wasm')),
    'vision_wasm_internal.wasm missing'
  );

  // Verify zero Face_Pose desktop weights exist anywhere inside web/
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...walk(full));
      } else {
        out.push(full);
      }
    }
    return out;
  };
  const allWebFiles = walk(webRoot);
  const forbidden = ['scrfd', 'retinaface', 'face_mesh.onnx', 'mtcnn'];
  for (const f of allWebFiles) {
    const lower = f.toLowerCase();
    for (const bad of forbidden) {
      assert(!lower.includes(bad), `Forbidden Face_Pose artifact found in web/: ${f}`);
    }
  }

  // Verify zero CSS modal backdrop class collisions between PrivacyModalUI and ConsentBannerUI
  const privacyUiSrc = fs.readFileSync(path.join(webRoot, 'src/ui/privacy_modal.ts'), 'utf-8');
  const consentUiSrc = fs.readFileSync(path.join(webRoot, 'src/ui/consent_banner.ts'), 'utf-8');
  assert(
    !privacyUiSrc.includes('.ssr-modal-backdrop') && !consentUiSrc.includes('.ssr-modal-backdrop'),
    'PrivacyModalUI and ConsentBannerUI must use uniquely namespaced backdrop classes'
  );
  assert(
    consentUiSrc.includes('.ssr-consent-modal-backdrop') &&
      privacyUiSrc.includes('.ssr-privacy-modal-backdrop'),
    'Unique modal backdrop classes must exist in both UI components'
  );

  console.log('✓ 5. Multi-page HTML, relative URLs, Apache 2.0 notice, self-hosted MediaPipe, unique modal CSS, and zero Face_Pose assets verified.');
}

console.log('\nAll Compliance & Packaging tests passed successfully!');
