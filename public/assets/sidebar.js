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

// Sidebar Toggle Function
function initSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    const mainContent = document.getElementById('main-content');
    const footer = document.getElementById('footer');
    
    if (!sidebar || !toggleBtn) {
        console.log('Sidebar toggle elements not found');
        return;
    }
    
    // Load saved state from localStorage
    const savedState = localStorage.getItem('sidebarCollapsed');
    const isCollapsed = savedState === 'true';
    
    // Apply saved state on load
    if (isCollapsed) {
        collapseSidebar();
    }
    
    // Toggle button click handler
    toggleBtn.addEventListener('click', function() {
        const currentlyCollapsed = sidebar.classList.contains('sidebar-collapsed');
        if (currentlyCollapsed) {
            expandSidebar();
        } else {
            collapseSidebar();
        }
    });
    
    function collapseSidebar() {
        sidebar.classList.add('sidebar-collapsed');
        sidebar.style.width = '0px';
        sidebar.style.minWidth = '0px';
        sidebar.style.overflow = 'hidden';
        if (mainContent) {
            mainContent.style.marginLeft = '0px';
        }
        if (footer) {
            footer.style.left = '0px';
        }
        localStorage.setItem('sidebarCollapsed', 'true');
    }
    
    function expandSidebar() {
        sidebar.classList.remove('sidebar-collapsed');
        sidebar.style.width = '16rem'; // 64 = 16rem
        sidebar.style.minWidth = '16rem';
        sidebar.style.overflow = 'visible';
        if (mainContent) {
            mainContent.style.marginLeft = '0px';
        }
        if (footer) {
            footer.style.left = '256px'; // 16rem = 256px
        }
        localStorage.setItem('sidebarCollapsed', 'false');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        initDropdowns();
        initSidebarToggle();
    });
} else {
    initDropdowns();
    initSidebarToggle();
}


