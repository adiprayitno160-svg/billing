
const { WhatsAppService } = require('./dist/services/whatsapp/WhatsAppServiceLegacy');

console.log('Force Initializing WhatsApp Service (Legacy)...');
WhatsAppService.initialize()
    .then(() => console.log('Initialization triggered.'))
    .catch(err => console.error('Init error:', err));
