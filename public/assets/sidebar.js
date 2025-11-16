// Sidebar menu toggle functionality - SIMPLIFIED VERSION
function toggleMenu(menuName, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    }
    
    console.log('toggleMenu called for:', menuName);
    
    const menuContent = document.getElementById(`${menuName}-menu`);
    const arrow = document.getElementById(`${menuName}-arrow`);
    
    if (!menuContent) {
        console.warn(`Menu content not found: ${menuName}`);
        return false;
    }
    
    if (!arrow) {
        console.warn(`Menu arrow not found: ${menuName}`);
        return false;
    }
    
    // Check if menu is currently hidden
    const isHidden = menuContent.style.display === 'none' || 
                     menuContent.classList.contains('hidden') ||
                     getComputedStyle(menuContent).display === 'none';
    
    console.log(`Menu ${menuName} is hidden:`, isHidden);
    
    if (isHidden) {
        // Show menu
        menuContent.style.display = 'block';
        menuContent.classList.remove('hidden');
        menuContent.style.pointerEvents = 'auto';
        menuContent.style.visibility = 'visible';
        arrow.style.transform = 'rotate(180deg)';
        console.log(`Menu ${menuName} opened`);
    } else {
        // Hide menu
        menuContent.style.display = 'none';
        menuContent.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
        console.log(`Menu ${menuName} closed`);
    }
    
    return false;
}

// Make toggleMenu available globally immediately
window.toggleMenu = toggleMenu;

// Also ensure it's available on window object
if (typeof window !== 'undefined') {
    window.toggleMenu = toggleMenu;
}

// Log to confirm it's loaded
console.log('✅ sidebar.js loaded, toggleMenu available:', typeof window.toggleMenu !== 'undefined');

// Use event delegation on sidebar for better reliability
function setupMenuClickHandlers() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) {
        console.warn('Sidebar not found');
        return;
    }
    
    // Remove any existing click handlers to avoid duplicates
    const existingHandler = sidebar._menuClickHandler;
    if (existingHandler) {
        sidebar.removeEventListener('click', existingHandler, true);
    }
    
    // Create new click handler using event delegation
    const menuClickHandler = function(e) {
        console.log('Menu click handler triggered', e.target);
        
        // Find the closest menu-toggle button
        const button = e.target.closest('.menu-toggle[data-menu]');
        if (!button) {
            console.log('No menu button found for target:', e.target);
            return;
        }
        
        console.log('Menu button found:', button.getAttribute('data-menu'));
        
        // Prevent default and stop propagation
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Get menu name
        const menuName = button.getAttribute('data-menu');
        if (!menuName) {
            console.warn('No menu name found on button');
            return;
        }
        
        // Toggle menu
        toggleMenu(menuName, e);
        
        return false;
    };
    
    // Store handler reference
    sidebar._menuClickHandler = menuClickHandler;
    
    // Add event listener with capture phase (runs first)
    sidebar.addEventListener('click', menuClickHandler, true);
    
    // Also add direct listeners to each button as backup
    const menuButtons = document.querySelectorAll('.menu-toggle[data-menu]');
    menuButtons.forEach(button => {
        // Remove onclick attribute to avoid conflicts
        button.removeAttribute('onclick');
        
        // Ensure button is clickable
        button.style.pointerEvents = 'auto';
        button.style.cursor = 'pointer';
        button.style.position = 'relative';
        button.style.zIndex = '10003';
        
        // Add direct listener as backup
        const menuName = button.getAttribute('data-menu');
        if (menuName) {
            const directHandler = function(e) {
                console.log('Direct click handler triggered for:', menuName);
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                toggleMenu(menuName, e);
                return false;
            };
            button.addEventListener('click', directHandler, true);
            console.log(`✅ Direct listener added to ${menuName}`);
        }
    });
    
    console.log(`✅ Menu click handlers setup complete for ${menuButtons.length} buttons`);
}

// Initialize menu states on page load
function initializeMenus() {
    console.log('Initializing menus...');
    
    // Check if any menu should be open based on current path
    const currentPath = window.location.pathname;
    
    // Menu mapping - which menu should be open for which paths
    const menuPaths = {
        'customers': ['/customers'],
        'packages': ['/packages'],
        'ftth': ['/ftth'],
        'billing': ['/billing'],
        'prepaid': ['/prepaid'],
        'monitoring': ['/monitoring'],
        'settings': ['/settings', '/kasir', '/database', '/backup', '/whatsapp', '/notification']
    };
    
    // Open the appropriate menu based on current path
    for (const [menuName, paths] of Object.entries(menuPaths)) {
        const shouldOpen = paths.some(path => currentPath.startsWith(path));
        if (shouldOpen) {
            const menuContent = document.getElementById(`${menuName}-menu`);
            const arrow = document.getElementById(`${menuName}-arrow`);
            
            if (menuContent && arrow) {
                menuContent.style.display = 'block';
                menuContent.classList.remove('hidden');
                menuContent.style.pointerEvents = 'auto';
                arrow.style.transform = 'rotate(180deg)';
            }
        }
    }
    
    console.log('Menu initialization complete');
}

// Make initializeMenus available globally
window.initializeMenus = initializeMenus;

// Function to ensure menus are initialized
function ensureMenusInitialized() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) {
        setTimeout(ensureMenusInitialized, 100);
        return;
    }
    
    const menuButtons = document.querySelectorAll('.menu-toggle[data-menu]');
    if (menuButtons.length === 0) {
        setTimeout(ensureMenusInitialized, 100);
        return;
    }
    
    initializeMenus();
    
    // Setup menu click handlers using event delegation
    setupMenuClickHandlers();
    
    console.log('✅ Menus initialized successfully');
}

// Run on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureMenusInitialized);
} else {
    ensureMenusInitialized();
}

// Also run after delays to ensure everything is loaded (for redirects, etc)
setTimeout(ensureMenusInitialized, 100);
setTimeout(ensureMenusInitialized, 500);
setTimeout(ensureMenusInitialized, 1000);
setTimeout(ensureMenusInitialized, 2000);

// Also setup click handlers immediately if sidebar exists
(function() {
    function quickSetup() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            setupMenuClickHandlers();
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', quickSetup);
    } else {
        quickSetup();
    }
    
    setTimeout(quickSetup, 100);
    setTimeout(quickSetup, 500);
})();
