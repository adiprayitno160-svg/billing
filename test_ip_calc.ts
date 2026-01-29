
const ipToInt = (ip: string) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
const intToIp = (int: number) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');

function calculateGatewayAndPeer(clientIpWithPrefix: string) {
    console.log(`\n--- Testing IP: ${clientIpWithPrefix} ---`);
    const [ipOnly, prefixStr] = String(clientIpWithPrefix).split('/');
    const prefix = Number(prefixStr || '0');

    if (prefix === 30) {
        const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
        const networkInt = ipToInt(ipOnly || '0.0.0.0') & mask;
        const firstHost = networkInt + 1;
        const secondHost = networkInt + 2;
        const ipInt = ipToInt(ipOnly || '0.0.0.0');

        const gatewayIp = (ipInt === firstHost) ? intToIp(secondHost) : intToIp(firstHost);
        const mikrotikAddress = `${gatewayIp}/${prefix}`;

        console.log(`Input Client IP: ${ipOnly}`);
        console.log(`Subnet: /${prefix}`);
        console.log(`Gateway (Router) IP: ${gatewayIp}`);
        console.log(`MikroTik Address Assignment: ${mikrotikAddress}`);
        console.log(`Target Queue/Mangle IP: ${ipOnly}`); // Should remain client IP
    } else {
        console.log(`Prefix is /${prefix}, using standard logic.`);
        console.log(`MikroTik Address: ${clientIpWithPrefix}`);
        console.log(`Target Queue/Mangle IP: ${ipOnly}`);
    }
}

// Test Case 1: Client uses .2 (common)
calculateGatewayAndPeer('192.168.10.2/30');

// Test Case 2: Client uses .1 (uncommon but valid)
calculateGatewayAndPeer('192.168.10.1/30');

// Test Case 3: Standard /24
calculateGatewayAndPeer('192.168.50.10/24');
