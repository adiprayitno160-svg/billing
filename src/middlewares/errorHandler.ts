import { NextFunction, Request, Response } from 'express';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
	const status = err?.status || 500;
	const message = err?.message || 'Internal Server Error';
	
	console.error('Error handler called:', { status, message, error: err });
	
	if (req.accepts('html')) {
		res.status(status).render('error', { 
			title: 'Error', 
			status, 
			message 
		});
		return;
	}
	res.status(status).json({ error: message, status });
}


