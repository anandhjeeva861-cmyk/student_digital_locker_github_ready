document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('lockerTheme');

    if (savedTheme === 'dark') {
        body.classList.add('dark-mode');
    }

    if (themeToggle) {
        themeToggle.textContent = body.classList.contains('dark-mode') ? '☀️' : '🌙';
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            const isDark = body.classList.contains('dark-mode');
            localStorage.setItem('lockerTheme', isDark ? 'dark' : 'light');
            themeToggle.textContent = isDark ? '☀️' : '🌙';
        });
    }

    document.querySelectorAll('.caps-input').forEach((input) => {
        input.addEventListener('input', () => {
            input.value = input.value.toUpperCase();
        });
    });

    const studentSearch = document.getElementById('studentSearch');
    const studentTable = document.getElementById('studentTable');
    if (studentSearch && studentTable) {
        studentSearch.addEventListener('input', () => {
            const value = studentSearch.value.toLowerCase().trim();
            studentTable.querySelectorAll('tbody tr').forEach((row) => {
                row.style.display = row.innerText.toLowerCase().includes(value) ? '' : 'none';
            });
        });
    }

    setTimeout(() => {
        document.querySelectorAll('.flash').forEach((flash) => {
            flash.style.opacity = '0';
            flash.style.transform = 'translateX(20px)';
            flash.style.transition = '0.25s ease';
            setTimeout(() => flash.remove(), 260);
        });
    }, 3500);
});
