const axios = require('axios');
const fs = require('fs');

async function debugDevice() {
    const deviceId = '00259E-HG8245A-4857544365A5A895';
    const host = '192.168.239.154';
    const port = 7557;

    try {
        console.log(`Fetching device data for ${deviceId}...`);
        const response = await axios.get(`http://${host}:${port}/devices/`, {
            params: { query: JSON.stringify({ _id: deviceId }) }
        });

        if (response.data && response.data.length > 0) {
            const device = response.data[0];
            fs.writeFileSync('device_dump.json', JSON.stringify(device, null, 2));
            console.log('Device data dumped to device_dump.json');

            // Search for -10 or 40 in the JSON
            const raw = JSON.stringify(device);
            if (raw.includes('"-10"') || raw.includes('-10')) {
                console.log('Found "-10" in the data!');
            }
            if (raw.includes('"40"') || raw.includes(40)) {
                console.log('Found "40" in the data!');
            }
        } else {
            console.log('Device not found in GenieACS');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugDevice();
