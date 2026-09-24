const CONSENT_STORAGE_KEY = "digital-locker-analytics-consent";
export const consentEvent = "digital-locker-consent";

function readStoredChoice() {
  try {
    return window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function isAnalyticsConsentDecided() {
  return readStoredChoice() !== null;
}

export function isAnalyticsConsentGranted() {
  return readStoredChoice() === "accepted";
}

function decide(accepted) {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, accepted ? "accepted" : "declined");
  } catch {
    // Storage may be unavailable (private browsing); keep the current session decision only.
  }
  window.dispatchEvent(new CustomEvent(consentEvent, { detail: { accepted } }));
}

function buildBanner() {
  const banner = document.createElement("aside");
  banner.className = "consent-banner";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-label", "Privacy consent");
  banner.hidden = true;

  const copy = document.createElement("p");
  const heading = document.createElement("strong");
  heading.textContent = "Privacy";
  copy.append(heading);
  copy.append(": This platform collects only anonymous usage analytics, and only after you accept. Choose below or clear your browser data for this site to change your mind.");

  const accept = document.createElement("button");
  accept.type = "button";
  accept.className = "consent-btn consent-accept";
  accept.textContent = "Accept";
  accept.addEventListener("click", () => {
    banner.hidden = true;
    decide(true);
  });

  const decline = document.createElement("button");
  decline.type = "button";
  decline.className = "consent-btn";
  decline.textContent = "Decline";
  decline.addEventListener("click", () => {
    banner.hidden = true;
    decide(false);
  });

  banner.append(copy, accept, decline);
  document.body.appendChild(banner);
  if (!isAnalyticsConsentDecided()) banner.hidden = false;
}

buildBanner();