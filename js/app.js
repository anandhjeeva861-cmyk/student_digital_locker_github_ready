document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".caps-input").forEach((input) => {
    input.addEventListener("input", () => {
      input.value = input.value.toUpperCase();
    });
  });
});
