/**
 * Orientation constants and Vastu mapping.
 * Used for consistency between database values, UI filters, and display.
 */

export enum CompassDirection {
    NORTH = 'North',
    NORTHEAST = 'Northeast',
    EAST = 'East',
    SOUTHEAST = 'Southeast',
    SOUTH = 'South',
    SOUTHWEST = 'Southwest',
    WEST = 'West',
    NORTHWEST = 'Northwest'
}

export interface OrientationOption {
    value: CompassDirection;
    label: string;
    vastuName: string;
    deity: string;
    best?: boolean;
}

export const ORIENTATION_OPTIONS: OrientationOption[] = [
    { value: CompassDirection.NORTH,     label: 'North',      vastuName: 'Kubera',   deity: 'Kubera' },
    { value: CompassDirection.NORTHEAST, label: 'North-East', vastuName: 'Ishanya',  deity: 'Ishan',    best: true },
    { value: CompassDirection.EAST,      label: 'East',       vastuName: 'Aditya',   deity: 'Indra',    best: true },
    { value: CompassDirection.SOUTHEAST, label: 'South-East', vastuName: 'Agni',      deity: 'Agni' },
    { value: CompassDirection.SOUTH,     label: 'South',      vastuName: 'Yama',     deity: 'Yama' },
    { value: CompassDirection.SOUTHWEST, label: 'South-West', vastuName: 'Nirriti',  deity: 'Nairutya' },
    { value: CompassDirection.WEST,      label: 'West',       vastuName: 'Varuna',   deity: 'Varuna' },
    { value: CompassDirection.NORTHWEST, label: 'North-West', vastuName: 'Vayu',     deity: 'Vayu' },
];

/**
 * Normalizes an orientation string for comparison.
 * Removes spaces, hyphens, and underscores, and converts to lowercase.
 */
export const normalizeOrientation = (s: string | null | undefined): string => {
    if (!s) return '';
    return s.toLowerCase().replace(/[\s\-_]/g, '');
};

/**
 * Checks if a property orientation matches a filter value.
 */
export const matchesOrientation = (propertyOrientation: string | null | undefined, filterValue: string): boolean => {
    if (!filterValue) return true;
    return normalizeOrientation(propertyOrientation) === normalizeOrientation(filterValue);
};
