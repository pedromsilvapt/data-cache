export interface CacheRecord<T, E, S> {
    key : string;
    expiry: E;
    value : T;
    state: S;
}

export type ChangeRecord<T, E, S> = { type: 'change', record : CacheRecord<T, E, S> }
                               | { type: 'delete', key : string };

export interface ReadCacheOptions<E> {
    readCache ?: boolean;
    readExpiry ?: E;
}

export interface WriteCacheOptions<E, S> {
    writeCache ?: boolean;
    writeExpiry ?: E;
    writeState ?: S;
}

export interface CacheOptions<E, S> extends ReadCacheOptions<E>, WriteCacheOptions<E, S> {

}


export interface Cache<T, E = void, S = void> {
    // Responsible for evicting unused/old records from the cache
    evictor : Evictor<T, E, S>;

    // The persistence layer for the cache records
    storage : CacheStorage<T, E, S>;

    // Does this cache have unsaved changes?
    readonly dirty : boolean;

    // Is the data in memory up-to-date?
    readonly stale : boolean;

    saveOnWrite : boolean;

    saveOnWriteDebounce : number;


    saveSync () : void;

    save () : Promise<void>;

    saveIfDirtySync () : boolean;

    saveIfDirty () : Promise<boolean>;


    loadSync () : void;

    load () : Promise<void>;

    loadIfStaleSync () : boolean;

    loadIfStale () : Promise<boolean>;


    hasSync ( key : string, options ?: ReadCacheOptions<E> ) : boolean;

    has ( key : string, options ?: ReadCacheOptions<E> ) : Promise<boolean>;

    getSync ( key : string, options ?: ReadCacheOptions<E> ) : T;
 
    get ( key : string, options ?: ReadCacheOptions<E> ) : Promise<T>;

    setSync ( key : string, value : T, options ?: WriteCacheOptions<E, S> ) : void;

    set ( key : string, value : T, options ?: WriteCacheOptions<E, S> ) : Promise<void>;

    deleteSync ( key : string ) : boolean;

    delete ( key : string ) : Promise<boolean>;

    compute<V extends T = T> ( key : string, producer : () => V | Promise<V>, options ?: CacheOptions<E, S> ) : Promise<V>;

    computeSync<V extends T = T> ( key : string, producer : () => V, options ?: CacheOptions<E, S> ) : V;


    keys ( options ?: ReadCacheOptions<E> ) : IterableIterator<string>;

    values ( options ?: ReadCacheOptions<E> ) : IterableIterator<T>;

    entries ( options ?: ReadCacheOptions<E> ) : IterableIterator<[string, T]>;

    [ Symbol.iterator ] () : IterableIterator<[string, T]>;

    close () : void;
}

export interface CacheStorage<T, E, S> {
    readonly loading : boolean;

    readonly saving : boolean;

    loadSync () : Iterable<CacheRecord<T, E, S>>;

    load () : AsyncIterable<CacheRecord<T, E, S>>;

    saveSync ( records : Iterable<CacheRecord<T, E, S>> ) : void;

    save ( records : Iterable<CacheRecord<T, E, S>> ) : Promise<void>;

    close () : void;
}

export interface Evictor<T, E, S> {
    cache : Cache<T, E, S>;

    track ( record : CacheRecord<T, E, S> ) : void;

    // Called when getting an element to make sure it still is valid
    check ( record : CacheRecord<T, E, S>, expiry ?: E ) : boolean;

    // Called when an element was successfuly retrieved. Returns true if that has caused the
    // state of the element to change, meaning the cache should be marked as dirty
    retrieved ( record : CacheRecord<T, E, S> ) : boolean;

    updated ( record : CacheRecord<T, E, S> ) : void;

    untrack ( record : CacheRecord<T, E, S> ) : void;

    clear () : void;

    close () : void;

    // TODO How will the evictor notify the cache that a record shall be evicted, both during the execution and at loading

    // trackAll ( records : Iterable<CacheRecord<T, E>> ) : void;
    
    // untrackAll ( records : Iterable<CacheRecord<T, E>> ) : void;
}