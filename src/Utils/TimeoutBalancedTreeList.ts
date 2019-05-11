import { DefaultComparators, BalancedNode } from 'data-balanced-tree';
import { EqualityComparator, BalancedTreeListNode, BalancedTreeList } from './BalancedTreeList';
import { ReusableTimer } from './ReusableTimer';

export class TimeoutBalancedTreeList<V> extends BalancedTreeList<number, V> {
    protected timer : ReusableTimer = new ReusableTimer( () => this.tick() );

    protected handler : ( item : V ) => unknown;

    protected targetNode : BalancedNode<BalancedTreeListNode<number, V>> = null;

    constructor ( handler : ( item : V ) => unknown, equalityComparator ?: EqualityComparator<V> ) {
        super( DefaultComparators.numbers, equalityComparator );

        this.handler = handler;
    }

    protected tick () {
        let first = this.targetNode;
        
        // Allow a 5 milliseconds threshold
        if ( first != null && first.value.key - Date.now() <= 5 ) {
            for ( let item of first.value.values ) {
                if ( this.handler != null ) {
                    this.handler( item );
                }
            }

            this.deleteAll( first.value.key );

            first = this.firstNode();
        }

        if ( first != null ) {
            this.update( first );
        }
    }

    protected update ( first : BalancedNode<BalancedTreeListNode<number, V>> = null ) {
        first = first || this.firstNode();

        this.targetNode = first;

        const remaining = Math.ceil( first.value.key - Date.now() );

        if ( remaining < Infinity ) {
            this.timer.start( remaining );
        }
    }

    insert ( key : number, value : V ) : void {
        super.insert( key, value );

        if ( this.targetNode == null || key < this.targetNode.value.key ) {
            this.update();
        }
    }

    delete ( key : number, value : V ) : void {
        super.delete( key, value );

        if ( this.targetNode == null || key <= this.targetNode.value.key ) {
            this.update();
        }
    }
    
    clear () {
        super.clear();

        this.timer.stop();
    }
}