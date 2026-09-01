document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("themeToggle");
  let theme = "light";
  try {
    theme = localStorage.getItem("lockerTheme") === "dark" ? "dark" : "light";
  } catch (_error) {
    // Storage can be unavailable in privacy-restricted browsing contexts.
  }
  const apply = () => {
    const dark = theme === "dark";
    document.body.classList.toggle("dark-mode", dark);
    if (toggle) toggle.textContent = dark ? "\u2600\uFE0F" : "\uD83C\uDF19";
  };

  apply();
  toggle?.addEventListener("click", () => {
    theme = document.body.classList.contains("dark-mode") ? "light" : "dark";
    try {
      localStorage.setItem("lockerTheme", theme);
    } catch (_error) {
      // The selected theme still applies for the current page.
    }
    apply();
  });
});
