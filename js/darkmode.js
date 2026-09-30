const themeStorageKey = "lockerTheme";

function savedTheme() {
  try {
    const value = localStorage.getItem(themeStorageKey);
    if (value === "dark" || value === "light") return value;
  } catch (_error) {
    // Storage may be unavailable in privacy-restricted browsing contexts.
  }
  return "light";
}

function initialiseThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  let theme = savedTheme();

  const applyTheme = () => {
    const isDark = theme === "dark";
    document.body.classList.toggle("dark-mode", isDark);
    document.documentElement.dataset.theme = theme;
    if (!toggle) return;
    toggle.textContent = isDark ? "☀" : "☾";
    toggle.setAttribute("aria-pressed", String(isDark));
    toggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    toggle.title = isDark ? "Light mode" : "Dark mode";
  };

  applyTheme();
  toggle?.addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch (_error) {
      // The selection still works for the current page when storage is unavailable.
    }
    applyTheme();
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== themeStorageKey || !event.newValue) return;
    theme = event.newValue === "dark" ? "dark" : "light";
    applyTheme();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialiseThemeToggle, { once: true });
else initialiseThemeToggle();
