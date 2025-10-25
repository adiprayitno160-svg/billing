// Dropdown function - simple and reliable
function toggleMenu(menuId) {
    const menu = document.getElementById(menuId + '-menu');
    const arrow = document.getElementById(menuId + '-arrow');
    if (menu && arrow) {
        const shouldOpen = menu.style.display === 'none' || menu.classList.contains('hidden');
        if (shouldOpen) {
            menu.style.display = 'block';
            menu.classList.remove('hidden');
            arrow.style.transform = 'rotate(180deg)';
        } else {
            menu.style.display = 'none';
            menu.classList.add('hidden');
            arrow.style.transform = 'rotate(0deg)';
        }
    }
}

window.toggleMenu = toggleMenu;

function initDropdowns() {
    // Global event delegation for all menu toggles
    document.addEventListener('click', function(ev) {
        const toggleButton = ev.target && ev.target.closest && ev.target.closest('.menu-toggle');
        if (!toggleButton) return;
        const menuId = toggleButton.getAttribute('data-menu');
        if (!menuId) return;
        ev.preventDefault();
        toggleMenu(menuId);
    });

    // Auto-open based on path
    const path = window.location.pathname;
    if (path.startsWith('/customers/') || path.startsWith('/billing/customers')) {
        toggleMenu('customers');
    } else if (path.startsWith('/packages/pppoe/') || path.startsWith('/packages/static-ip')) {
        toggleMenu('packages');
    } else if (path.startsWith('/monitoring/')) {
        toggleMenu('monitoring');
    } else if (path.startsWith('/ftth/')) {
        toggleMenu('ftth');
    } else if (path.startsWith('/prepaid/')) {
        toggleMenu('prepaid');
    } else if (path.startsWith('/settings/')) {
        toggleMenu('settings');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDropdowns);
} else {
    initDropdowns();
}


