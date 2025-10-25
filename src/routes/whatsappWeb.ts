import { Router } from 'express';
import { WhatsAppWebController } from '../controllers/whatsapp/WhatsAppWebController';

const router = Router();

// WhatsApp Web Routes
router.get('/qr', WhatsAppWebController.getQRCode);
router.post('/bind', WhatsAppWebController.bindDevice);
router.get('/status', WhatsAppWebController.getConnectionStatus);
router.post('/reconnect', WhatsAppWebController.reconnect);
router.post('/disconnect', WhatsAppWebController.disconnect);
router.post('/send', WhatsAppWebController.sendMessage);
router.post('/receive', WhatsAppWebController.receiveMessage);
router.get('/logs', WhatsAppWebController.getConnectionLogs);

export default router;
