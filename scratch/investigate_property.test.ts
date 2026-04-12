import { it, expect } from 'vitest';
import { getPropertyByAddress } from '../services/firebase/properties';

it('investigate 3492 Dorset Ct', async () => {
    const address = '3492 Dorset Ct, Pleasanton, CA';
    const property = await getPropertyByAddress(address);
    console.log('INVESTIGATION_START');
    console.log(JSON.stringify(property, null, 2));
    console.log('INVESTIGATION_END');
});
