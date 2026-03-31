
import axios from 'axios';

const API_URL = 'http://192.168.239.154:7557';

async function listVirtualParameters() {
    try {
        console.log('Listing Virtual Parameters...');
        const response = await axios.get(`${API_URL}/virtual_parameters`);
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error: any) {
        console.error('Error listing VPs:', error.message);
        if (error.response) console.error(error.response.data);
    }
}

async function createWifiPasswordVP() {
    const vpName = 'wifi_password';
    const script = `
let password = "-";

// Helper
function check(p) {
  for (let item of p) {
    if (item.value && item.value[0] && item.value[0] !== "") return item.value[0];
  }
  return null;
}

// Explicit paths for Huawei HG8245H
let paths = [
  "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey",
  "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase",
  "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase",
  "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.X_HW_WLANKey",
  "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.PreSharedKey", // 5GHz?
  "Device.WiFi.AccessPoint.1.Security.KeyPassphrase"
];

for(let path of paths) {
  let p = declare(path, {value: 1});
  let res = check(p);
  if(res) return {writable: false, value: [res, "xsd:string"]};
}

return {writable: false, value: ["-", "xsd:string"]};
`;

    // Attempt 1: JSON
    try {
        console.log(`Attempt 1 (JSON): Creating/Updating VP: ${vpName}...`);
        await axios.put(`${API_URL}/virtual_parameters/${vpName}`, {
            script: script
        });
        console.log('Virtual Parameter created successfully (JSON)!');
        return;
    } catch (error: any) {
        console.error('JSON Attempt failed:', error.message);
        if (error.response) console.error('Response:', error.response.data);
    }

    // Attempt 2: Plain Text
    try {
        console.log(`Attempt 2 (Plain Text): Creating/Updating VP: ${vpName}...`);
        await axios.put(`${API_URL}/virtual_parameters/${vpName}`, script, {
            headers: { 'Content-Type': 'text/plain' }
        });
        console.log('Virtual Parameter created successfully (Plain)!');
        return;
    } catch (error: any) {
        console.error('Plain Text Attempt failed:', error.message);
        if (error.response) console.error('Response:', error.response.data);
    }
}

// Check args
const args = process.argv.slice(2);
if (args.includes('list')) {
    listVirtualParameters();
} else if (args.includes('create')) {
    createWifiPasswordVP();
} else {
    // Default create
    createWifiPasswordVP();
}
