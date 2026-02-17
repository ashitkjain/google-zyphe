/**
 * Context Graph Types
 * 
 * TypeScript types for the context graph taxonomy.
 * These will be populated after Gemini Deep Research proposes the taxonomy.
 */

// ── Graph Node ─────────────────────────────────────────

export interface GraphNodeType {
    name: string;
    description: string;
    coreProperties: string[];       // field paths from the data
    derivedProperties: string[];    // computed values
    tags: string[];                 // semantic labels for faceted search
}

export interface GraphNode {
    id: string;
    type: string;                   // references GraphNodeType.name
    properties: Record<string, any>;
    tags: string[];
}

// ── Graph Edge ─────────────────────────────────────────

export interface GraphEdgeType {
    name: string;
    sourceType: string;             // references GraphNodeType.name
    targetType: string;             // references GraphNodeType.name
    description: string;
    properties: string[];           // attributes on the edge
    bidirectional: boolean;
}

export interface GraphEdge {
    id: string;
    type: string;                   // references GraphEdgeType.name
    sourceId: string;
    targetId: string;
    properties: Record<string, any>;
}

// ── Tag Dimension ──────────────────────────────────────

export interface TagDimension {
    name: string;                   // e.g., "Physical & Experiential"
    description: string;
    tags: TagDefinition[];
}

export interface TagDefinition {
    label: string;                  // e.g., "Chef's Kitchen"
    extractedFrom: string;          // field path
    logic: string;                  // how to determine if the tag applies
}

// ── Full Taxonomy ──────────────────────────────────────

export interface ContextGraphTaxonomy {
    id: string;
    cityStateKey: string;
    version: number;
    createdAt: any;                 // Firestore timestamp

    // Schema definitions
    nodeTypes: GraphNodeType[];
    edgeTypes: GraphEdgeType[];
    tagDimensions: TagDimension[];

    // The raw Gemini response for reference
    rawResponse?: string;

    // Metadata
    dataSourceSummary?: {
        propertyCount: number;
        zipCodes: string[];
        dataSources: string[];
    };
}

// ── Materialized Graph ─────────────────────────────────
// (After taxonomy is defined and applied to actual data)

export interface ContextGraph {
    id: string;
    cityStateKey: string;
    taxonomyId: string;             // references ContextGraphTaxonomy.id

    nodes: GraphNode[];
    edges: GraphEdge[];

    generatedAt: any;               // Firestore timestamp
    stats: {
        nodeCount: number;
        edgeCount: number;
        tagCount: number;
        nodeTypeBreakdown: Record<string, number>;
        edgeTypeBreakdown: Record<string, number>;
    };
}
