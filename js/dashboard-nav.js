function showDashboardView(name) {
  if (!name) return;
  document.querySelectorAll("[data-view]").forEach((view) => {
    view.hidden = view.dataset.view !== name;
  });
  document.dispatchEvent(new CustomEvent("dashboard:view-change", {
    detail: { view: name }
  }));
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-open-view]");
  if (!link) return;
  event.preventDefault();
  showDashboardView(link.dataset.openView);
});
