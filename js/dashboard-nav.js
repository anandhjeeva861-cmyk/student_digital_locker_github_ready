let currentView = "";

function viewFromLocation() {
  try {
    return decodeURIComponent(window.location.hash.slice(1)).trim();
  } catch (_error) {
    return "";
  }
}

function viewSection(name) {
  return [...document.querySelectorAll("[data-view]")]
    .find((section) => section.dataset.view === name);
}

function showDashboardView(name, { updateHistory = false } = {}) {
  const section = viewSection(name);
  if (!section) return false;

  document.querySelectorAll("[data-view]").forEach((view) => {
    view.hidden = view !== section;
  });

  const activeNavView = section.dataset.navView || name;
  document.querySelectorAll(".sidebar .nav-link[data-open-view]").forEach((link) => {
    const active = link.dataset.openView === activeNavView;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  if (updateHistory && currentView !== name) {
    window.history.pushState(null, "", `#${encodeURIComponent(name)}`);
  }

  const changed = currentView !== name;
  currentView = name;
  if (changed) {
    document.dispatchEvent(new CustomEvent("dashboard:view-change", {
      detail: { view: name }
    }));
  }
  return true;
}

function setMenuOpen(open) {
  const shell = document.querySelector(".app-shell");
  const button = document.querySelector("[data-menu-toggle]");
  if (!shell) return;
  shell.classList.toggle("menu-open", open);
  document.body.classList.toggle("menu-open", open);
  button?.setAttribute("aria-expanded", String(open));
}

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;

  const menuButton = event.target.closest("[data-menu-toggle]");
  if (menuButton) {
    event.preventDefault();
    setMenuOpen(!document.querySelector(".app-shell")?.classList.contains("menu-open"));
    return;
  }

  if (event.target.closest("[data-menu-close]")) {
    event.preventDefault();
    setMenuOpen(false);
    return;
  }

  const link = event.target.closest("[data-open-view]");
  if (!link) return;
  event.preventDefault();
  showDashboardView(link.dataset.openView, { updateHistory: true });
  if (link.closest(".sidebar")) setMenuOpen(false);
});

document.addEventListener("dashboard:navigate", (event) => {
  showDashboardView(event.detail?.view, { updateHistory: true });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenuOpen(false);
});

window.addEventListener("popstate", () => {
  showDashboardView(viewFromLocation() || "dashboard");
  setMenuOpen(false);
});

document.addEventListener("DOMContentLoaded", () => {
  const requestedView = viewFromLocation();
  const requestedSection = viewSection(requestedView);
  const initialView = requestedSection && !requestedSection.hasAttribute("data-transient-view")
    ? requestedView
    : "dashboard";
  window.history.replaceState(null, "", `#${encodeURIComponent(initialView)}`);
  queueMicrotask(() => showDashboardView(initialView));
});
