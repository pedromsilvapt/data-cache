import { Evictor, CacheRecord, Cache } from '../CacheInterface';
import { TimeoutBalancedTreeList } from '../Utils/TimeoutBalancedTreeList';

export type TtlEvictorOptions = number | TtlEvictorOptionsObject;

export interface TtlEvictorOptionsObject {
    ttl : number;
}

export interface TtlEvictorGlobalOptions extends TtlEvictorOptionsObject {
    onlyPassive : boolean;

    refreshOnRead : boolean;

    refreshOnWrite : boolean;
}

export interface TtlEvictorState {
    lastTime : number;
}

export class TtlEvictor<T> implements Evictor<T, TtlEvictorOptions, TtlEvictorState> {
    tree : TimeoutBalancedTreeList<CacheRecord<T, TtlEvictorOptions, TtlEvictorState>>;

    options : TtlEvictorGlobalOptions;

    cache : Cache<T, TtlEvictorOptions, TtlEvictorState>;

    constructor ( options : Partial<TtlEvictorGlobalOptions> ) {
        this.tree = new TimeoutBalancedTreeList( () => {}, ( a, b ) => a.key == b.key );

        this.options = {
            ttl: Infinity,
            onlyPassive : true,
            refreshOnRead : true,
            refreshOnWrite : true,
            ...options
        };
    }

    protected getRecordTtl ( record : TtlEvictorOptions ) : number {
        if ( record == null ) {
            return this.options.ttl;
        }

        if ( typeof record === 'number' ) {
            return record;
        }

        return record.ttl;
    }

    protected getRecordThreshold ( record : CacheRecord<T, TtlEvictorOptions, TtlEvictorState>, options ?: TtlEvictorOptions ) {
        if ( !record.state ) {
            record.state = { lastTime: Date.now() }

            // TODO Save record
        }

        const ttl = options !== void 0 
            ? this.getRecordTtl( options ) 
            : this.getRecordTtl( record.expiry );

        return record.state.lastTime + ttl;
    }

    track ( record : CacheRecord<T, TtlEvictorOptions, TtlEvictorState> ) : void {
        const threshold = this.getRecordThreshold( record );
        
        if ( !this.options.onlyPassive ) {
            this.tree.insert( threshold, record );
        }
    }

    check ( record : CacheRecord<T, TtlEvictorOptions, TtlEvictorState>, options ?: TtlEvictorOptions ) : boolean {
        return this.getRecordThreshold( record, options ) >= Date.now();
    }

    retrieved ( record : CacheRecord<T, TtlEvictorOptions, TtlEvictorState> ) : boolean {
        if ( this.options.refreshOnRead ) {
            if ( record.state == null ) {
                record.state = { lastTime: Date.now() };
            } else {
                record.state.lastTime = Date.now();
            }

            return true;
        }

        return false;
    }

    updated ( record : CacheRecord<T, TtlEvictorOptions, TtlEvictorState> ) : void {
        if ( this.options.refreshOnWrite ) {
            if ( record.state == null ) {
                record.state = { lastTime: Date.now() };
            } else {
                record.state.lastTime = Date.now();
            }
        }
    }

    untrack ( record : CacheRecord<T, TtlEvictorOptions, TtlEvictorState> ) : void {
        if ( !this.options.onlyPassive ) {
            this.tree.delete( this.getRecordThreshold( record ), record );
        }
    }

    clear () : void {
        this.tree.clear();
    }

    close () : void {
        this.tree.clear();
    }
}
