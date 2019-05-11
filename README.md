# Cache

> Incredibly simple and extensible in-memory sync/async cache with optional persistence and eviction

# Installation
```shell
npm install --save @pedromsilva/data-cache
```

# Usage
> **Note:** Using async-await syntax for simplicity. Not that async-await code must be run inside an async function

```typescript
import { MemoryCache } from '@pedromsilva/data-cache';

const cache = new MemoryCache( 'cache.jsonl' );

// All the methods below have matching synchronous version with a 'Sync' suffix, such as getSync(), loadSync() etc...
// You can choose to use either the async or sync versions of the methods, however
// it is not recommended to mix the two: choose one style and stick with it.
await cache.load();

const has = await cache.has( 'key' );

await cache.set( 'key', 'value' );

const value = await cache.get( 'key' );

await cache.delete( 'key' );

await cache.save();

// There is a shortcut for retrieving an item if it exists, or calculating and storing it if it doesn't
const remoteValue = await cache.compute( 'key', async () => {
    return await fetchValueFromSomeRemoteApi();
} );

// You can iterate over the cache items
for ( let [ key, value ] of cache ) { }
for ( let key of cache.keys() ) { }
for ( let value of cache.values() ) { }

// To fully dispose of a cache, you can close it (releasing any resources it might be holding)
cache.close();
```

## TtlEvictor
By default, this package comes with a TtlEvictor that allows to automatically remove elements from the cache if they are too old.
```typescript
import { MemoryCache, TtlEvictor } from '@pedromsilva/data-cache';

// Items in the cache live for one minute.
const cache = new MemoryCache( 'cache.jsonl', new TtlEvictor( { ttl: 60 * 1000 } ) );
// Or use the shorter version
import { TtlMemoryCache } from '@pedromsilva/data-cache';

const cache = new TtlMemoryCache( 'cache.jsonl', 60 * 1000 );
```

## API
```typescript
export interface ReadCacheOptions<E> {
    readCache ?: boolean;
    readExpiry ?: E;
}

export interface WriteCacheOptions<E, S> {
    writeCache ?: boolean;
    writeExpiry ?: E;
    writeState ?: S;
}

export interface CacheOptions<E, S> extends ReadCacheOptions<E>, WriteCacheOptions<E, S> { }

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
```