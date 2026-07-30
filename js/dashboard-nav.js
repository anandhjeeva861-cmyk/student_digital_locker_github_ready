function showDashboardView(name) {
  if (!name) return;
  document.querySelectorAll("[data-view]").forEach((view) => {
    view.hidden = view.dataset.view !== name;
  });
  document.dispatchEvent(new CustomEvent("dashboard:view-change", {
    detail: { view: name }
  }));
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
  showDashboardView(link.dataset.openView);
  if (link.closest(".sidebar")) setMenuOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenuOpen(false);
});
