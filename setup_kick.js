const fs = require('fs');
const path = 'c:/laragon/www/billing/src/controllers/customerController.ts';
let content = fs.readFileSync(path, 'utf8');

// The kick code
const kickCode = `
                                     // ========== AUTO-RESET (KICK) SESSION ==========
                                     const { removeActivePppConnection } = await import('../services/mikrotikService');
                                     await removeActivePppConnection(config, finalUsername).catch(() => {});
                                 `;

// Find where to insert (after ppp sync)
if (content.includes('PPPoE Secret created') && !content.includes('removeActivePppConnection')) {
    content = content.replace(
        /}\s*}\s*}\s*} catch \(pppSyncErr: any\) {/g, 
        `}\n${kickCode}\n                                }\n                            }\n                        } catch (pppSyncErr: any) {`
    );
    fs.writeFileSync(path, content);
    console.log('Successfully added kick logic!');
} else {
    console.log('Target not found or already added.');
}
