import { ensureInitialSchema } from '../src/db/pool';

async function runSchemaUpdate() {
    try {
        console.log('🔧 Running schema update...');
        await ensureInitialSchema();
        console.log('✅ Schema update completed successfully!');
    } catch (error) {
        console.error('❌ Schema update failed:', error);
    }
}

runSchemaUpdate();