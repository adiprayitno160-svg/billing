import { Request, Response, NextFunction } from 'express';
import { listParentQueues, getParentQueueById, createParentQueue, updateParentQueue, deleteParentQueue } from '../services/parentQueueService';

export async function getParentQueueList(req: Request, res: Response, next: NextFunction) {
    try {
        const parentQueues = await listParentQueues();
        res.render('packages/parent_queues', { title: 'Parent Queues', parentQueues, error: req.flash('error'), success: req.flash('success') });
    } catch (err) { next(err); }
}

export async function getParentQueueAdd(req: Request, res: Response, next: NextFunction) {
    try {
        res.render('packages/parent_queue_add', { title: 'Tambah Parent Queue', error: req.flash('error') });
    } catch (err) { next(err); }
}

export async function getParentQueueEdit(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number(req.params.id);
        const pq = await getParentQueueById(id);
        if (!pq) { req.flash('error', 'Parent queue tidak ditemukan'); return res.redirect('/packages/parent-queues'); }
        res.render('packages/parent_queue_edit', { title: 'Edit Parent Queue', pq, error: req.flash('error') });
    } catch (err) { next(err); }
}

export async function postParentQueueCreate(req: Request, res: Response) {
    try {
        const { name, description, status } = req.body as any;
        if (!name) throw new Error('Nama parent queue wajib diisi');
        await createParentQueue({ name, description, status });
        req.flash('success', 'Parent queue berhasil dibuat');
        res.redirect('/packages/parent-queues');
    } catch (err) {
        req.flash('error', err instanceof Error ? err.message : 'Gagal membuat parent queue');
        res.redirect('/packages/parent-queues/add');
    }
}

export async function postParentQueueUpdate(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);
        const { name, description, status } = req.body as any;
        await updateParentQueue(id, { name, description, status });
        req.flash('success', 'Parent queue berhasil diupdate');
        res.redirect('/packages/parent-queues');
    } catch (err) {
        req.flash('error', err instanceof Error ? err.message : 'Gagal mengupdate parent queue');
        res.redirect(`/packages/parent-queues/${req.params.id}/edit`);
    }
}

export async function postParentQueueDelete(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);
        await deleteParentQueue(id);
        req.flash('success', 'Parent queue berhasil dihapus');
        res.redirect('/packages/parent-queues');
    } catch (err) {
        req.flash('error', err instanceof Error ? err.message : 'Gagal menghapus parent queue');
        res.redirect('/packages/parent-queues');
    }
}



