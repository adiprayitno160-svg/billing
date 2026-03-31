"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemUpdatePage = void 0;
const getSystemUpdatePage = async (req, res) => {
    try {
        // Initial check (non-blocking)
        // We let the frontend do the actual check to avoid slow page load
        res.render('settings/system_update', {
            title: 'Update Sistem',
            currentPath: '/settings/system-update',
            user: req.user
        });
    }
    catch (error) {
        res.status(500).render('error', { message: 'Gagal memuat halaman update' });
    }
};
exports.getSystemUpdatePage = getSystemUpdatePage;
//# sourceMappingURL=SystemUpdatePageController.js.map