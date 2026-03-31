"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getParentQueueList = getParentQueueList;
exports.getParentQueueAdd = getParentQueueAdd;
exports.getParentQueueEdit = getParentQueueEdit;
exports.postParentQueueCreate = postParentQueueCreate;
exports.postParentQueueUpdate = postParentQueueUpdate;
exports.postParentQueueDelete = postParentQueueDelete;
const parentQueueService_1 = require("../services/parentQueueService");
async function getParentQueueList(req, res, next) {
    try {
        const parentQueues = await (0, parentQueueService_1.listParentQueues)();
        res.render('packages/parent_queues', { title: 'Parent Queues', parentQueues, error: req.flash('error'), success: req.flash('success') });
    }
    catch (err) {
        next(err);
    }
}
async function getParentQueueAdd(req, res, next) {
    try {
        res.render('packages/parent_queue_add', { title: 'Tambah Parent Queue', error: req.flash('error') });
    }
    catch (err) {
        next(err);
    }
}
async function getParentQueueEdit(req, res, next) {
    try {
        const id = Number(req.params.id);
        const pq = await (0, parentQueueService_1.getParentQueueById)(id);
        if (!pq) {
            req.flash('error', 'Parent queue tidak ditemukan');
            return res.redirect('/packages/parent-queues');
        }
        res.render('packages/parent_queue_edit', { title: 'Edit Parent Queue', pq, error: req.flash('error') });
    }
    catch (err) {
        next(err);
    }
}
async function postParentQueueCreate(req, res) {
    try {
        const { name, description, status } = req.body;
        if (!name)
            throw new Error('Nama parent queue wajib diisi');
        await (0, parentQueueService_1.createParentQueue)({ name, description, status });
        req.flash('success', 'Parent queue berhasil dibuat');
        res.redirect('/packages/parent-queues');
    }
    catch (err) {
        req.flash('error', err instanceof Error ? err.message : 'Gagal membuat parent queue');
        res.redirect('/packages/parent-queues/add');
    }
}
async function postParentQueueUpdate(req, res) {
    try {
        const id = Number(req.params.id);
        const { name, description, status } = req.body;
        await (0, parentQueueService_1.updateParentQueue)(id, { name, description, status });
        req.flash('success', 'Parent queue berhasil diupdate');
        res.redirect('/packages/parent-queues');
    }
    catch (err) {
        req.flash('error', err instanceof Error ? err.message : 'Gagal mengupdate parent queue');
        res.redirect(`/packages/parent-queues/${req.params.id}/edit`);
    }
}
async function postParentQueueDelete(req, res) {
    try {
        const id = Number(req.params.id);
        await (0, parentQueueService_1.deleteParentQueue)(id);
        req.flash('success', 'Parent queue berhasil dihapus');
        res.redirect('/packages/parent-queues');
    }
    catch (err) {
        req.flash('error', err instanceof Error ? err.message : 'Gagal menghapus parent queue');
        res.redirect('/packages/parent-queues');
    }
}
//# sourceMappingURL=parentQueueController.js.map