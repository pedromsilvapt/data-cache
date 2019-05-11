import { BalancedNode, BalancedTree, Comparator, DefaultComparators } from 'data-balanced-tree';

export interface BalancedTreeListNode<K, V> {
    key : K;
    values : V[];
}

export interface EqualityComparator<T> {
    ( a : T, b : T ) : boolean;
}

export class BalancedTreeList<K, V> {
    tree : BalancedTree<BalancedTreeListNode<K, V>>;

    equalityComparator : EqualityComparator<V>;

    protected tempNode : BalancedTreeListNode<K, V> = {
        key: null,
        values: null
    };

    constructor ( comparator : Comparator<K> = DefaultComparators.default, equalityComparator : EqualityComparator<V> = ( a : V, b : V ) => a == b ) {
        this.tree = new BalancedTree( (a, b) => comparator( a.key, b.key ) );

        this.equalityComparator = equalityComparator;
    }

    find ( key : K ) : BalancedTreeListNode<K, V> {
        this.tempNode.key = key;

        const node = this.tree.find( this.tempNode );

        this.tempNode.key = null;

        if ( !node ) {
            return null;
        }

        return node.value;
    }

    insert ( key : K, value : V ) : void {
        const node = this.find( key );

        if ( node != null ) {
            const existingIndex = node.values.findIndex( v => this.equalityComparator( v, value ) );

            if ( existingIndex >= 0 ) {
                node.values[ existingIndex ] = value;
            } else {
                node.values.push( value );
            }
        } else {
            this.tree.insert( { key, values: [ value ] } );
        }
    }

    delete ( key : K, value : V ) : void {
        const node = this.find( key );

        if ( node ) {
            const index = node.values.findIndex( v => this.equalityComparator( v, value ) );

            if ( index >= 0 && node.values.length == 1 ) {
                this.tree.delete( node );
            } else if ( index >= 0 ) {
                node.values.splice( index, 1 );
            }
        }
    }

    deleteAll ( key : K ) : void {
        const node = this.find( key );

        this.tree.delete( node );
    }
    
    clear () {
        this.tree.clear();
    }

    previous ( node : BalancedNode<BalancedTreeListNode<K, V>> ) : BalancedNode<BalancedTreeListNode<K, V>> {
        return this.tree.previous( node );
    }

    biggestNodeUnder ( upperBound : K, included : boolean = false ) : BalancedNode<BalancedTreeListNode<K, V>> {
        this.tempNode.key = upperBound;

        const node = this.tree.biggestNodeUnder( this.tempNode, included );

        this.tempNode.key = null;

        return node;
    }

    biggestUnder ( upperBound : K, included : boolean = false ) : V[] {
        this.tempNode.key = upperBound;

        const node = this.tree.biggestUnder( this.tempNode, included );

        this.tempNode.key = null;

        if ( node == null ) return [];

        return node.values;
    }

    smallestNodeAbove ( lowerBound : K, included : boolean = false ) : BalancedNode<BalancedTreeListNode<K, V>> {
        this.tempNode.key = lowerBound;

        const node = this.tree.smallestNodeAbove( this.tempNode, included );

        this.tempNode.key = null;

        return node;
    }

    smallestAbove ( lowerBound : K, included : boolean = false ) : V[] {
        this.tempNode.key = lowerBound;

        const node = this.tree.smallestAbove( this.tempNode, included );

        this.tempNode.key = null;

        if ( node == null ) return [];

        return node.values;
    }

    smallestNodeUnder ( upperBound : K, included : boolean = false ) : BalancedNode<BalancedTreeListNode<K, V>> {
        this.tempNode.key = upperBound;

        const node = this.tree.smallestNodeUnder( this.tempNode, included );

        this.tempNode.key = null;

        return node;
    }

    smallestUnder ( upperBound : K, included : boolean = false ) : V[] {
        this.tempNode.key = upperBound;

        const node = this.tree.smallestUnder( this.tempNode, included );

        this.tempNode.key = null;

        if ( node == null ) return [];

        return node.values;
    }
    
    biggestNodeAbove ( lowerBound : K, included : boolean = false ) : BalancedNode<BalancedTreeListNode<K, V>> {
        this.tempNode.key = lowerBound;

        const node = this.tree.biggestNodeAbove( this.tempNode, included );

        this.tempNode.key = null;

        return node;
    }

    biggestAbove ( lowerBound : K, included : boolean = false ) : V[] {
        this.tempNode.key = lowerBound;

        const node = this.tree.biggestAbove( this.tempNode, included );

        this.tempNode.key = null;

        if ( node == null ) return [];

        return node.values;
    }

    closestNodes ( bound : K ) : [ BalancedNode<BalancedTreeListNode<K, V>>, BalancedNode<BalancedTreeListNode<K, V>> ] {
        try {
            this.tempNode.key = bound;

            return this.tree.closestNodes( this.tempNode );
        } finally {
            this.tempNode.key = null;
        }
    }

    closest ( bound : K ) : [ V[], V[] ] {
        try {
            this.tempNode.key = bound;

            return this.tree.closest( this.tempNode ).map( v => v ? v.values : [] ) as [ V[], V[] ];
        } finally {
            this.tempNode.key = null;
        }
    }

    next ( node : BalancedNode<BalancedTreeListNode<K, V>> ) : BalancedNode<BalancedTreeListNode<K, V>> {
        return this.tree.previous( node );        
    }

    firstNode () : BalancedNode<BalancedTreeListNode<K, V>> {
        return this.tree.firstNode();
    }

    first () : V[] {
        const node = this.tree.first();

        if ( node == null ) return [];

        return node.values;
    }

    lastNode () : BalancedNode<BalancedTreeListNode<K, V>> {
        return this.tree.lastNode();
    }

    last () : V[] {
        const node = this.tree.last();

        if ( node == null ) return [];

        return node.values;
    }

    * [ Symbol.iterator ] () : IterableIterator<V> {
        for ( let node of this.nodes() ) {
            yield * node.value.values;
        }
    }

    * nodes () : IterableIterator<BalancedNode<BalancedTreeListNode<K, V>>> {
        let node = this.firstNode();

        while ( node != null ) {
            yield node;

            node = this.next( node );
        }
    }

    nodesBetween ( lower : K, upper : K, included : boolean = true ) : IterableIterator<BalancedNode<BalancedTreeListNode<K, V>>> {
        return this.tree.nodesBetween( { key: lower, values: null }, { key: upper, values: null }, included );
    }

    * between ( lower : K, upper : K, included : boolean = true ) : IterableIterator<V> {
        for ( let node of this.nodesBetween( lower, upper, included ) ) {
            yield * node.value.values;
        }
    }

    toArray () : V[] {
        return Array.from( this );
    }

    print ( node ?: BalancedNode<BalancedTreeListNode<K, V>> ) {
        this.tree.print( node );
    }
}
