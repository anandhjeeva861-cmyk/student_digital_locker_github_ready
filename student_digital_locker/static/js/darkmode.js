function applyDarkMode() {
    const body = document.body;
    const themeToggle = document.getElementById("themeToggle");
    const savedTheme = localStorage.getItem("lockerTheme");

    body.classList.toggle("dark-mode", savedTheme === "dark");
    if (themeToggle) {
        themeToggle.textContent = body.classList.contains("dark-mode") ? "☀️" : "🌙";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    applyDarkMode();
    const themeToggle = document.getElementById("themeToggle");
    if (!themeToggle) return;

    themeToggle.addEventListener("click", () => {
        const isDark = !document.body.classList.contains("dark-mode");
        document.body.classList.toggle("dark-mode", isDark);
        localStorage.setItem("lockerTheme", isDark ? "dark" : "light");
        themeToggle.textContent = isDark ? "☀️" : "🌙";
    });
});
