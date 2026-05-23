import { describe, it, expect } from 'vitest';
import { parsePropertyCsv } from './parsePropertyCsv';

// ─── Fixture ─────────────────────────────────────────────────────────────────
// Matches the actual "340houses" MLS export format exactly.
// The spreadsheet includes a blank row-number column (col A) as the first
// column, followed by: S, MLS #, Street Address, Price, DOM, Beds Total,
// Bths, Sq Ft Total, Lot Size, Postal City, Property Sub Type, Age
// Data rows: row_num, status(A=Active), mls_id, street, price, dom, beds,
//            bths(X|Y), sqft, lot_size, city, property_type, age

const CSV = `,S,MLS #,Street Address,Price,DOM,Beds Total,Bths,Sq Ft Total,Lot Size,Postal City,Property Sub Type,Age
1,A,ML82045997,4889 Clarendon Drive,$2500000.00,7,4,3|0,1979,6448 Lot SqFt,San Jose,Res. Single Family,68
2,A,BE41133514,4858 Sterling Dr,$2500000.00,2,4,3|0,2533,9375 Lot SqFt,Fremont,Res. Single Family,73
3,A,ML82041352,1130 Nevada Avenue,$2500000.00,41,4,3|1,2373,6187 Lot SqFt,San Jose,Res. Single Family,96
4,A,ML82043166,2466 Armstrong,$2499999.00,,4,2|0,1885,5520 Lot SqFt,Santa Clara,Res. Single Family,71
5,A,ML82046482,953 Kenneth Avenue,$2499888.00,5,3,2|0,1454,10218 Lot SqFt,Campbell,Res. Single Family,77
6,A,ML82041476,1602 Sheffield Avenue,$2499000.00,37,4,3|0,2386,7700 Lot SqFt,San Jose,Res. Single Family,64
7,A,ML82040215,1439 Miller Avenue,$2499000.00,49,4,2|0,1778,6324 Lot SqFt,San Jose,Res. Single Family,67
8,A,ML82038168,901 Sunnyvale Saratoga Road,$2498998.00,54,4,1|0,1805,17424 Lot SqFt,Sunnyvale,Res. Single Family,136
9,A,ML82044903,2488 Hart Avenue,$2498888.00,7,5,3|0,2204,5520 Lot SqFt,Santa Clara,Res. Single Family,69
10,A,ML82040457,1626 Peacock Avenue,$2498800.00,,3,2|0,1524,6480 Lot SqFt,Sunnyvale,Res. Single Family,68
11,A,ML82046769,807 Cathedral Drive,$2498000.00,1,3,2|0,1512,10560 Lot SqFt,Sunnyvale,Res. Single Family,65
12,A,ML82046458,1087 S Stelling Road,$2498000.00,5,3,2|0,1421,6100 Lot SqFt,Cupertino,Res. Single Family,66
13,A,ML82045904,1151 Carolyn Avenue,$2498000.00,6,3,2|0,1797,6840 Lot SqFt,San Jose,Res. Single Family,76
14,A,ML82045827,719 Jackpine Court,$2498000.00,8,3,2|0,1433,5500 Lot SqFt,Sunnyvale,Res. Single Family,70
15,A,ML82044426,869 Lusterleaf Drive,$2498000.00,19,4,2|1,2204,6080 Lot SqFt,Sunnyvale,Res. Single Family,60
16,A,ML82044569,1666 Swallow Drive,$2495000.00,19,3,2|0,1338,6000 Lot SqFt,Sunnyvale,Res. Single Family,69
17,A,SF426124493,1666 Swallow Drive,$2495000.00,20,3,2|0,1338,6000 Lot SqFt,Sunnyvale,Res. Single Family,69
18,A,CC41131843,1079 Ginger Ln,$2495000.00,14,5,2|1,2102,6000 Lot SqFt,San Jose,Res. Single Family,64
19,A,ML82044580,17250 Pine Avenue,$2490000.00,19,4,3|0,2066,35313 Lot SqFt,Los Gatos,Res. Single Family,111
20,A,ML82041626,18825 Pendergast Avenue,$2488888.00,7,4,3|0,1618,5304 Lot SqFt,Cupertino,Res. Single Family,73
21,A,ML82039113,1547 Grackle Way,$2488888.00,8,3,2|0,1362,6902 Lot SqFt,Sunnyvale,Res. Single Family,64
22,A,ML82046881,945 Reed Avenue,$2488000.00,,3,2|0,1830,10200 Lot SqFt,Sunnyvale,Res. Single Family,62
23,A,ML82045861,586 Rockport Drive,$2488000.00,8,5,3|0,2363,8811 Lot SqFt,Sunnyvale,Res. Single Family,67
24,A,ML82046031,918 Mangrove Avenue,$2458000.00,7,4,2|1,1791,5580 Lot SqFt,Sunnyvale,Res. Single Family,64
25,A,ML82046603,227 Howes Drive,$2450000.00,,4,2|0,1918,6500 Lot SqFt,Los Gatos,Res. Single Family,63
26,A,ML82034859,2791 Scott Street,$2450000.00,78,5,5|0,2485,8424 Lot SqFt,San Jose,Res. Single Family,75
27,A,ML82044401,375 Stowell Avenue,$2430000.00,20,4,3|0,1694,5200 Lot SqFt,Sunnyvale,Res. Single Family,84
28,A,ML82046644,16857 Farley Road,$2400000.00,,3,2|0,1605,8820 Lot SqFt,Los Gatos,Res. Single Family,71
29,A,ML82043778,4893 Clarendon Drive,$2400000.00,,3,2|0,1400,6386 Lot SqFt,San Jose,Res. Single Family,68
30,A,ML82039984,1887 Blossom Hill Road,$2400000.00,,5,2|1,2369,10500 Lot SqFt,San Jose,Res. Single Family,61
31,A,ML82046268,204 Hardy Avenue,$2399888.00,1,3,2|0,1437,9375 Lot SqFt,Campbell,Res. Single Family,76
32,A,ML82041623,16737 Leroy Avenue,$2399888.00,36,4,3|0,1525,8961 Lot SqFt,Los Gatos,Res. Single Family,77
33,A,ML82042801,1748 Harte,$2398000.00,30,4,2|0,2029,7169 Lot SqFt,San Jose,Res. Single Family,65
34,A,ML82034737,22081 Caroline Drive,$2398000.00,90,3,2|0,1416,9375 Lot SqFt,Cupertino,Res. Single Family,74
35,A,ML82045220,68 N Midway Street,$2390000.00,13,4,3|1,2116,7272 Lot SqFt,Campbell,Res. Single Family,69
36,A,BE41131908,38048 Palmer Dr,$2389950.00,21,4,2|1,2006,9929 Lot SqFt,Fremont,Res. Single Family,71
37,A,ML82046777,5106 Emiline Drive,$2388000.00,1,4,3|0,1745,6000 Lot SqFt,San Jose,Res. Single Family,67
38,A,ML82045866,1594 Inverness Circle,$2388000.00,8,5,4|0,2123,6180 Lot SqFt,San Jose,Res. Single Family,62
39,A,ML82044827,826 Fife Way,$2388000.00,7,3,2|0,1302,6080 Lot SqFt,Sunnyvale,Res. Single Family,65
40,A,ML82046999,1234 Oak Street,$2388000.00,3,4,3|0,1850,7000 Lot SqFt,Sunnyvale,Res. Single Family,58`;

// Pin the reference year so yearBuilt assertions are stable
const YEAR = 2026;

describe('parsePropertyCsv — MLS export format', () => {
    const props = parsePropertyCsv(CSV, YEAR);

    it('parses all 40 properties', () => {
        expect(props).toHaveLength(40);
    });

    it('builds full address from Street Address + Postal City + CA', () => {
        expect(props[0].address).toBe('4889 Clarendon Drive, San Jose, CA');
        expect(props[1].address).toBe('4858 Sterling Dr, Fremont, CA');
        expect(props[4].address).toBe('953 Kenneth Avenue, Campbell, CA');
        expect(props[18].address).toBe('17250 Pine Avenue, Los Gatos, CA');
    });

    it('parses MLS # as mlsId', () => {
        expect(props[0].mlsId).toBe('ML82045997');
        expect(props[1].mlsId).toBe('BE41133514');
        expect(props[16].mlsId).toBe('SF426124493');
        expect(props[17].mlsId).toBe('CC41131843');
    });

    it('parses Price correctly (strips $ and commas)', () => {
        expect(props[0].listPrice).toBe(2500000);
        expect(props[4].listPrice).toBe(2499888);
        expect(props[35].listPrice).toBe(2389950);
        expect(props[36].listPrice).toBe(2388000);
    });

    it('parses Beds Total', () => {
        expect(props[0].bedrooms).toBe(4);
        expect(props[4].bedrooms).toBe(3);
        expect(props[8].bedrooms).toBe(5);  // 2488 Hart — 5 beds
        expect(props[25].bedrooms).toBe(5); // 2791 Scott — 5 beds
    });

    it('parses Bths in "X|Y" pipe format — takes only full baths', () => {
        expect(props[0].bathrooms).toBe(3);   // 3|0
        expect(props[2].bathrooms).toBe(3);   // 3|1 → 3
        expect(props[3].bathrooms).toBe(2);   // 2|0
        expect(props[14].bathrooms).toBe(2);  // 2|1 → 2
        expect(props[25].bathrooms).toBe(5);  // 5|0
        expect(props[37].bathrooms).toBe(4);  // 4|0
    });

    it('parses Sq Ft Total (strips commas)', () => {
        expect(props[0].squareFootage).toBe(1979);
        expect(props[1].squareFootage).toBe(2533);
        expect(props[7].squareFootage).toBe(1805);
        expect(props[18].squareFootage).toBe(2066);
    });

    it('parses Lot Size (strips "Lot SqFt" suffix and commas)', () => {
        expect(props[0].lotSize).toBe(6448);
        expect(props[1].lotSize).toBe(9375);
        expect(props[7].lotSize).toBe(17424);  // large lot
        expect(props[18].lotSize).toBe(35313); // 17250 Pine — 35,313 sqft
    });

    it('computes yearBuilt from Age column (currentYear - age)', () => {
        expect(props[0].yearBuilt).toBe(YEAR - 68);   // 1958
        expect(props[1].yearBuilt).toBe(YEAR - 73);   // 1953
        expect(props[7].yearBuilt).toBe(YEAR - 136);  // very old — 1890
        expect(props[18].yearBuilt).toBe(YEAR - 111); // 1915
    });

    it('normalizes homeType from "Res. Single Family" to "Single Family"', () => {
        props.forEach((p, i) => {
            expect(p.homeType).toBe('Single Family',
                `row ${i + 1} (${p.address}) should normalize to Single Family`);
        });
    });

    it('handles blank DOM fields without crashing (DOM not in SubjectProperty)', () => {
        // Rows with blank DOM: #4 (Armstrong), #11 (Peacock), #23 (Reed)
        // Parser should succeed and not carry DOM into SubjectProperty at all
        expect(props[3].address).toBe('2466 Armstrong, Santa Clara, CA');
        expect(props[9].address).toBe('1626 Peacock Avenue, Sunnyvale, CA');
        expect(props[21].address).toBe('945 Reed Avenue, Sunnyvale, CA');
    });

    it('handles non-ML MLS prefixes (BE, SF, CC)', () => {
        const be1 = props.find(p => p.mlsId === 'BE41133514');
        const sf1 = props.find(p => p.mlsId === 'SF426124493');
        const cc1 = props.find(p => p.mlsId === 'CC41131843');
        expect(be1?.address).toBe('4858 Sterling Dr, Fremont, CA');
        expect(sf1?.address).toBe('1666 Swallow Drive, Sunnyvale, CA');
        expect(cc1?.address).toBe('1079 Ginger Ln, San Jose, CA');
    });

    it('all parsed properties have a non-empty address ending in ", CA"', () => {
        props.forEach((p, i) => {
            expect(p.address.endsWith(', CA')).toBe(true,
                `row ${i + 1}: address "${p.address}" should end with ", CA"`);
            expect(p.address.length).toBeGreaterThan(10);
        });
    });

    it('all parsed properties have a listPrice > 0', () => {
        props.forEach((p, i) => {
            expect(p.listPrice).toBeGreaterThan(0);
        });
    });

    it('all parsed properties have squareFootage > 0', () => {
        props.forEach((p, i) => {
            expect(p.squareFootage).toBeGreaterThan(0);
        });
    });

    it('spot-checks a mid-list property end-to-end', () => {
        // ML82044580 — 17250 Pine Avenue, Los Gatos, $2,490,000, 4bd/3ba, 2066sf, 35313 lot, age 111
        const p = props.find(p => p.mlsId === 'ML82044580');
        expect(p).toBeDefined();
        expect(p!.address).toBe('17250 Pine Avenue, Los Gatos, CA');
        expect(p!.listPrice).toBe(2490000);
        expect(p!.bedrooms).toBe(4);
        expect(p!.bathrooms).toBe(3);
        expect(p!.squareFootage).toBe(2066);
        expect(p!.lotSize).toBe(35313);
        expect(p!.yearBuilt).toBe(YEAR - 111);
        expect(p!.homeType).toBe('Single Family');
    });

    it('spot-checks the Fremont Palmer Dr property', () => {
        // BE41131908 — 38048 Palmer Dr, Fremont, $2,389,950, 4bd/2|1, 2006sf, 9929 lot, age 71
        const p = props.find(p => p.mlsId === 'BE41131908');
        expect(p).toBeDefined();
        expect(p!.address).toBe('38048 Palmer Dr, Fremont, CA');
        expect(p!.listPrice).toBe(2389950);
        expect(p!.bedrooms).toBe(4);
        expect(p!.bathrooms).toBe(2);
        expect(p!.squareFootage).toBe(2006);
        expect(p!.lotSize).toBe(9929);
        expect(p!.yearBuilt).toBe(YEAR - 71);
    });
});

describe('parsePropertyCsv — edge cases', () => {
    it('returns empty array for blank input', () => {
        expect(parsePropertyCsv('')).toHaveLength(0);
        expect(parsePropertyCsv('header only\n')).toHaveLength(0);
    });

    it('handles quoted fields containing commas', () => {
        const csv = `MLS #,Street Address,Price,Beds Total,Bths,Sq Ft Total,Lot Size,Postal City,Property Sub Type,Age
ML001,"123 Main St, Unit A",$1000000,3,2|0,1500,5000 Lot SqFt,San Jose,Res. Single Family,30`;
        const result = parsePropertyCsv(csv, 2026);
        expect(result[0].address).toBe('123 Main St, Unit A, San Jose, CA');
    });

    it('handles missing city — uses street address alone', () => {
        const csv = `Street Address,Price,Beds Total,Bths,Sq Ft Total,Age
123 Oak Ave,$900000,3,2|0,1200,50`;
        const result = parsePropertyCsv(csv, 2026);
        expect(result[0].address).toBe('123 Oak Ave');
    });

    it('handles price with dollar signs and commas', () => {
        const csv = `Street Address,Price,Beds Total,Bths,Sq Ft Total,Lot Size,Postal City,Property Sub Type,Age
999 Test Rd,"$2,500,000.00",4,3|0,2000,6000 Lot SqFt,Sunnyvale,Res. Single Family,40`;
        const result = parsePropertyCsv(csv, 2026);
        expect(result[0].listPrice).toBe(2500000);
    });

    it('skips rows with empty street address', () => {
        const csv = `Street Address,Postal City,Price,Beds Total,Bths,Sq Ft Total,Age
123 Main St,San Jose,$1000000,3,2|0,1200,40
,San Jose,$900000,3,2|0,1100,50`;
        const result = parsePropertyCsv(csv, 2026);
        expect(result).toHaveLength(1);
        expect(result[0].address).toBe('123 Main St, San Jose, CA');
    });
});
