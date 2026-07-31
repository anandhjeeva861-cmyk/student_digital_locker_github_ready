import { ACADEMIC_YEAR_EXAMPLE, DEPARTMENT_OPTIONS } from "./options.js";

function fillSelect(select, options, placeholder) {
  const selected = select.value;
  select.innerHTML = "";
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  select.appendChild(placeholderOption);

  for (const value of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }

  select.value = options.includes(selected) ? selected : "";
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("select[data-options='departments']").forEach((select) => {
    fillSelect(select, DEPARTMENT_OPTIONS, "Select Department");
  });

  document.querySelectorAll("[data-academic-year]").forEach((input) => {
    input.placeholder = input.placeholder || ACADEMIC_YEAR_EXAMPLE;
    input.title = `Enter academic year like ${ACADEMIC_YEAR_EXAMPLE}.`;
  });

  document.querySelectorAll(".caps-input").forEach((input) => {
    input.addEventListener("input", () => {
      input.value = input.value.toUpperCase();
    });
  });
});
