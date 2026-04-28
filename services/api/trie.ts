
/**
 * Result object stored at terminal nodes in the Trie.
 */
export interface SearchResult {
    type: 'city' | 'zip' | 'address';
    label: string;
    zpid?: string;
    city?: string;
    zip?: string;
}

/**
 * A single node in the Search Trie.
 */
class SearchNode {
    children: Map<string, SearchNode> = new Map();
    terminalResult: SearchResult | null = null;
}

/**
 * SearchTrie: A high-performance prefix tree for restricted property search.
 * Supports City, Zip, and Address discovery with O(K) lookup complexity.
 */
export class SearchTrie {
    private root: SearchNode = new SearchNode();
    private totalNodes: number = 0;

    /**
     * Inserts a searchable string into the Trie.
     */
    insert(text: string, result: SearchResult) {
        if (!text) return;
        
        let current = this.root;
        const chars = text.toLowerCase().split('');

        for (const char of chars) {
            if (!current.children.has(char)) {
                current.children.set(char, new SearchNode());
                this.totalNodes++;
            }
            current = current.children.get(char)!;
        }
        
        // Mark as terminal and store result
        current.terminalResult = result;
    }

    /**
     * Finds the top N suggestions matching a given prefix.
     */
    search(prefix: string, maxResults: number = 10): SearchResult[] {
        if (!prefix) return [];

        let current = this.root;
        const chars = prefix.toLowerCase().split('');

        // Traverse to the end of the prefix
        for (const char of chars) {
            if (!current.children.has(char)) return [];
            current = current.children.get(char)!;
        }

        // Deep search for terminal results in the subtree
        const results: SearchResult[] = [];
        this.collectResults(current, results, maxResults);
        return results;
    }

    /**
     * Checks if a prefix is "Valid" (exists in the Trie path).
     */
    isValidPrefix(prefix: string): boolean {
        if (!prefix) return true;
        let current = this.root;
        for (const char of prefix.toLowerCase().split('')) {
            if (!current.children.has(char)) return false;
            current = current.children.get(char)!;
        }
        return true;
    }

    /**
     * Checks if a string is a "Terminal" node (a complete valid search entity).
     */
    isCompleteMatch(text: string): SearchResult | null {
        if (!text) return null;
        let current = this.root;
        for (const char of text.toLowerCase().split('')) {
            if (!current.children.has(char)) return null;
            current = current.children.get(char)!;
        }
        return current.terminalResult;
    }

    private collectResults(node: SearchNode, results: SearchResult[], limit: number) {
        if (results.length >= limit) return;
        
        if (node.terminalResult) {
            results.push(node.terminalResult);
        }

        // Depth-first traversal of children
        for (const child of node.children.values()) {
            this.collectResults(child, results, limit);
            if (results.length >= limit) return;
        }
    }

    get size() {
        return this.totalNodes;
    }
}
