import { Request, Response, NextFunction } from 'express';
import { databasePool } from '../../db/pool';

export async function getOltList(req: Request, res: Response, next: NextFunction) {
    try {
        const [rows] = await databasePool.query(`
            SELECT * FROM ftth_olt 
            ORDER BY id DESC
        `);
        
        res.render('ftth/olt', { 
            title: 'FTTH - OLT', 
            items: rows 
        });
    } catch (err) { 
        next(err); 
    }
}

export async function getOltEdit(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number(req.params.id);
        const [rows] = await databasePool.query(`
            SELECT * FROM ftth_olt WHERE id = ?
        `, [id]);
        
        if (!Array.isArray(rows) || rows.length === 0) {
            res.status(404).send('OLT tidak ditemukan');
            return;
        }
        
        res.render('ftth/olt_edit', { 
            title: 'Edit OLT', 
            olt: rows[0] 
        });
    } catch (err) { 
        next(err); 
    }
}

export async function postOltCreate(req: Request, res: Response, next: NextFunction) {
    try {
        const { name, ip_address, location, status, total_ports, used_ports, description } = req.body;
        
        await databasePool.query(`
            INSERT INTO ftth_olt (name, ip_address, location, status, total_ports, used_ports, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [name, ip_address, location, status || 'offline', total_ports || 0, used_ports || 0, description]);
        
        res.redirect('/ftth/olt');
    } catch (err) { 
        next(err); 
    }
}

export async function postOltUpdate(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number(req.params.id);
        const { name, ip_address, location, status, total_ports, used_ports, description } = req.body;
        
        await databasePool.query(`
            UPDATE ftth_olt 
            SET name = ?, ip_address = ?, location = ?, status = ?, total_ports = ?, used_ports = ?, description = ?, updated_at = NOW()
            WHERE id = ?
        `, [name, ip_address, location, status, total_ports, used_ports, description, id]);
        
        res.redirect('/ftth/olt');
    } catch (err) { 
        next(err); 
    }
}

export async function postOltDelete(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number(req.params.id);
        
        await databasePool.query(`
            DELETE FROM ftth_olt WHERE id = ?
        `, [id]);
        
        res.redirect('/ftth/olt');
    } catch (err) { 
        next(err); 
    }
}