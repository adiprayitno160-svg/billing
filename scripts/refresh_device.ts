
import axios from 'axios';

const GENIEACS_API = 'http://192.168.239.154:7557';
const DEVICE_ID = '00259E-HG8245H-48575443E6F52C0C';

async function refreshDevice() {
    try {
        console.log(`Refreshing device ${DEVICE_ID}...`);

        // Use 'refreshObject' task on root ''
        const response = await axios.post(`${GENIEACS_API}/devices/${encodeURIComponent(DEVICE_ID)}/tasks?connection_request`, {
            name: 'refreshObject',
            objectName: ''
        });

        console.log('Refresh task queued successfully:', response.data);
    } catch (error: any) {
        console.error('Error refreshing device:', error.response?.data || error.message);
    }
}

refreshDevice();
