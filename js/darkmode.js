document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("themeToggle");
  const apply = () => {
    const dark = localStorage.getItem("lockerTheme") === "dark";
    document.body.classList.toggle("dark-mode", dark);
    if (toggle) toggle.textContent = dark ? "\u2600\uFE0F" : "\uD83C\uDF19";
  };

  apply();
  toggle?.addEventListener("click", () => {
    const next = document.body.classList.contains("dark-mode") ? "light" : "dark";
    localStorage.setItem("lockerTheme", next);
    apply();
  });
});
