import { stopE2EStack } from './e2e-stack-lib.mjs';

await stopE2EStack();
console.log('E2E_STACK_STOPPED');
