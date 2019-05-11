import { 
    Cache, 
    CacheStorage, 
    Evictor, 
    CacheRecord, 
    ChangeRecord,
    ReadCacheOptions,
    WriteCacheOptions,
    CacheOptions
} from './CacheInterface';
import { ReadWriteSemaphore } from 'data-semaphore';
import { ReusableFuture } from './Utils/ReusableFuture';
import { ReusableTimer } from './Utils/ReusableTimer';
import { FileStorage } from './Storages/FileStorage';
import { TtlEvictor, TtlEvictorOptions, TtlEvictorState } from './Evictors/TtlEvictor';

export class MemoryCache<T, E = void, S = unknown> implements Cache<T, E, S> {
    protected _dirty : boolean = false;

    protected _stale : boolean = true;

    // Responsible for evicting unused/old records from the cache
    evictor : Evictor<T, E, S>;

    // The persistence layer for the cache records
    storage : CacheStorage<T, E, S>;

    // Does this cache have unsaved changes?
    get dirty () : boolean { return this._dirty; }

    get stale () : boolean { return this._stale; }

    loadOnRead : boolean = true;

    saveOnWrite : boolean = true;

    saveOnWriteDebounce : number = 0;

    disableInternalSyncIO : boolean = false;

    // IN-MEMORY DATA PERSISTENCE
    semaphore : ReadWriteSemaphore = new ReadWriteSemaphore( Infinity );

    protected items : Map<string, CacheRecord<T, E, S>> = new Map();

    protected changes : Map<string, ChangeRecord<T, E, S>> = new Map();

    protected loadingFuture : ReusableFuture = new ReusableFuture();

    protected savingFuture : ReusableFuture = new ReusableFuture();
    
    protected autoSaveTimer : ReusableTimer = new ReusableTimer( () => this.saveIfDirty() );

    // protected loading : boolean = false;

    // protected saving : boolean = false;

    protected get frozen () {
        return this.loadingFuture.isPending || this.savingFuture.isPending;
    }

    public constructor ( storage : CacheStorage<T, E, S> | string, evictor : Evictor<T, E, S> ) {
        if ( typeof storage == 'string' ) {
            storage = new FileStorage( storage );
        }

        this.storage = storage;
        this.evictor = evictor;
        
        if ( this.evictor != null ) {
            this.evictor.cache = this;
        }
    }

    public loadSync () : void {
        if ( this.storage == null ) {
            return;
        }
        
        this.items.clear();

        this.evictor.clear();

        for ( let record of this.storage.loadSync() ) {
            this.items.set( record.key, record );

            if ( this.evictor != null ) {
                this.evictor.track( record );
            }
        }

        this._stale = false;
    }

    public async load () : Promise<void> {
        if ( this.storage == null ) {
            return;
        }

        if ( this.loadingFuture.isPending ) {
            await this.loadingFuture.promise;
        }

        this.loadingFuture.prepare();

        const release = await this.semaphore.write.acquire();

        try {
            let items : Map<string, CacheRecord<T, E, S>> = new Map();

            this.evictor.clear();

            for await ( let record of this.storage.load() ) {
                items.set( record.key, record );

                this.evictor.track( record );
            }

            this.items = items;

            this._stale = false;
            
            this.applyChanges();

            this.loadingFuture.resolve();
        } catch ( error ) {
            this.applyChanges();

            this.loadingFuture.reject( error );

            throw error;
        } finally {
            release();
        }
    }
    
    public loadIfStaleSync () : boolean {
        if ( this.stale ) {
            this.loadSync();

            return true;
        }

        return false;
    }
    
    public async loadIfStale () : Promise<boolean> {
        if ( this.stale ) {
            await this.load();

            return true;
        }

        return false;
    }

    public saveSync () : void {
        this.storage.saveSync( this.items.values() );

        this._dirty = false;
    }
    
    public async save () : Promise<void> {
        if ( this.savingFuture.isPending ) {
            await this.savingFuture.promise;
        }

        this.savingFuture.prepare();

        const release = await this.semaphore.write.acquire();

        try {
            await this.storage.save( this.items.values() );

            this._dirty = false;

            this.applyChanges();
            
            this.savingFuture.resolve();
        } catch ( error ) {
            this.applyChanges();

            this.savingFuture.reject( error );

            throw error;
        } finally {
            release();
        }
    }

    public saveIfDirtySync () : boolean {
        if ( this.dirty ) {
            this.saveSync();

            return true;
        }

        return false;
    }

    async saveIfDirty () : Promise<boolean> {
        if ( this.dirty ) {
            await this.saveSync();

            return true;
        }

        return false;
    }

    // Operation Helpers
    protected applyChanges () {
        if ( this.changes.size > 0 ) {
            this._dirty = true;
        }

        for ( let [ key, change ] of this.changes ) {
            if ( change.type == 'delete' ) {
                this.items.delete( key );
            } else if ( change.type === 'change' ) {
                this.items.set( key, change.record );
            }
        }
    }

    protected readOperation<M> ( fn : () => M ) : M {
        if ( this.loadOnRead ) {
            if ( this.disableInternalSyncIO ) {
                this.loadIfStale();
            } else {
                this.loadIfStaleSync();
            }
        }

        return fn();
    }

    protected async readOperationAsync<M> ( fn : () => M ) : Promise<M> {
        if ( this.loadOnRead ) {
            await this.loadIfStale();
        }

        return fn();
    }

    protected writeOperation<M> ( fn : () => M ) : M {
        this._dirty = true;

        const result = fn();

        if ( this.saveOnWrite ) {
            if ( this.saveOnWriteDebounce == 0 ) {
                if ( this.disableInternalSyncIO ) {
                    this.saveIfDirty();
                } else {
                    this.saveIfDirtySync();
                }
            } else {
                if ( !this.autoSaveTimer.isTicking ) {
                    this.autoSaveTimer.start( this.saveOnWriteDebounce );
                }
            }
        }
        
        return result;
    }

    protected async writeOperationAsync<M> ( fn : () => M ) : Promise<M> {
        this._dirty = true;

        const result = fn();

        if ( this.saveOnWrite ) {
            if ( this.saveOnWriteDebounce == 0 ) {
                await this.saveIfDirty();
            } else {
                if ( !this.autoSaveTimer.isTicking ) {
                    this.autoSaveTimer.start( this.saveOnWriteDebounce );
                }
            }
        }
            
        return result;
    }

    protected forceGetRecordInternal ( key : string ) : CacheRecord<T, E, S> {
        let record : CacheRecord<T, E, S> = void 0;

        if ( this.frozen ) {
            const change = this.changes.get( key );

            if ( change != null ) {
                if ( change.type === 'delete' ) {
                    return null;
                } else  {
                    record = change.record;
                }
            }
        }

        if ( record == null ) {
            record = this.items.get( key );
        }

        return record;
    }

    protected checkRecordInternal ( record : CacheRecord<T, E, S>, options : ReadCacheOptions<E> = {} ) : boolean {
        if ( 'readCache' in options && options.readCache == false ) {
            return void 0;
        }

        if ( this.evictor != null ) {
            // The evictor settings attributed to the record always take precedence
            if ( this.evictor != null && !this.evictor.check( record ) ) {
                this.deleteInternal( record.key );

                this._dirty = true;

                return false;
            }
            

            // The read evictor settings only matter to this request and as such don't delete the record
            if ( options.readExpiry !== void 0 && !this.evictor.check( record, options.readExpiry ) ) {
                return false;
            }
        }

        return true;
    }

    protected getRecordInternal ( key : string, options : ReadCacheOptions<E> = {} ) : CacheRecord<T, E, S> {
        if ( 'readCache' in options && options.readCache == false ) {
            return void 0;
        }

        let record : CacheRecord<T, E, S> = this.forceGetRecordInternal( key );

        if ( record != null ) {            
            if ( !this.checkRecordInternal( record, options ) ) {
                return void 0;
            }

            return record;
        }

        return void 0;
    }

    protected hasInternal ( key : string, options ?: ReadCacheOptions<E> ) : boolean {
        const result = this.getRecordInternal( key, options );

        if ( result != null ) {
            return true;
        }

        return false;
    }

    public hasSync ( key : string, options ?: ReadCacheOptions<E> ) : boolean {
        return this.readOperation( () => this.hasInternal( key, options ) );
    }

    public has ( key : string, options ?: ReadCacheOptions<E> ) : Promise<boolean> {
        return this.readOperationAsync( () => this.hasInternal( key, options ) );
    }

    protected getInternal ( key : string, options ?: ReadCacheOptions<E> ) : T {
        const result = this.getRecordInternal( key );

        if ( result != null ) {
            // evictor.retrieved returns true if the state has changed. That way, the 
            // cache knows that it is dirty and thus needs saving
            if ( this.evictor != null && this.evictor.retrieved( result ) ) {
                this._dirty = true;
            }

            return result.value;
        }

        return void 0;
    }

    public getSync ( key : string, options ?: ReadCacheOptions<E> ) : T {
        return this.readOperation( () => this.getInternal( key, options ) );
    }

    public get ( key : string, options ?: ReadCacheOptions<E> ) : Promise<T> {
        return this.readOperationAsync( () => this.getInternal( key, options ) );
    }

    protected setInternal ( key : string, value : T, options : WriteCacheOptions<E, S> = {} ) : void {
        if ( options.writeCache !== void 0 && options.writeCache == false ) {
            return;
        }

        const existingRecord = this.forceGetRecordInternal( key );

        const expiry = options.writeExpiry !== void 0 
            ? options.writeExpiry 
            : ( existingRecord != null
                ? existingRecord.expiry 
                : void 0
              );

        const state = options.writeState !== void 0 
            ? options.writeState 
            : ( existingRecord != null 
                ? existingRecord.state 
                : void 0 
              );

        const record : CacheRecord<T, E, S> = { key, value, expiry, state };

        if ( this.evictor != null ) {
            if ( existingRecord == null ) {
                this.evictor.updated( record );
            } else {
                this.evictor.track( record );
            }
        }

        if ( this.frozen ) {
            this.changes.set( key, { type: 'change', record } );
        } else {
            this.items.set( key, record );
        }
    }

    public setSync ( key : string, value : T, options ?: WriteCacheOptions<E, S> ) : void {
        this.writeOperation( () => this.setInternal( key, value, options ) );
    }

    public set ( key : string, value : T, options ?: WriteCacheOptions<E, S> ) : Promise<void> {
        return this.writeOperationAsync( () => this.setInternal( key, value, options ) );
    }

    protected deleteInternal ( key : string ) : boolean {        
        if ( this.frozen ) {
            this.changes.set( key, { type: 'delete', key } );
        } else {
            this.items.delete( key );
        }

        const record = this.forceGetRecordInternal( key );
        
        if ( this.evictor != null && record != null ) {
            this.evictor.untrack( record );
        }

        return record != null;
    }

    public deleteSync ( key : string ) : boolean {
        return this.writeOperation( () => this.deleteInternal( key ) );
    }

    public delete ( key : string ) : Promise<boolean> {
        return this.writeOperationAsync( () => this.deleteInternal( key ) );
    }

    public async compute<V extends T = T> ( key : string, producer : () => V | Promise<V>, options ?: CacheOptions<E, S> ) : Promise<V> {
        let result = await this.get( key, options ) as V;

        if ( result === void 0 ) {
            result = await producer();

            await this.set( key, result, options );
        }
        
        return result;
    }

    public computeSync<V extends T = T> ( key : string, producer : () => V, options ?: CacheOptions<E, S> ) : V {
        let result = this.getSync( key, options ) as V;

        if ( result === void 0 ) {
            result = producer();

            this.setSync( key, result, options );
        }
        
        return result;
    }

    
    public * keys ( options ?: ReadCacheOptions<E> ) : IterableIterator<string> {
        for ( let tuple of this.entries( options ) ) {
            yield tuple[ 0 ];
        }
    }

    public * values ( options ?: ReadCacheOptions<E> ) : IterableIterator<T> {
        for ( let tuple of this.entries( options ) ) {
            yield tuple[ 1 ];
        }
    }

    public * entries ( options ?: ReadCacheOptions<E> ) : IterableIterator<[string, T]> {
        for ( let [ key, record ] of this.items ) {
            if ( this.checkRecordInternal( record, options ) ) {
                yield [ key, record.value ];
            }
        }
    }

    public [ Symbol.iterator ] () : IterableIterator<[string, T]> {
        return this.entries();
    }

    public close () {
        if ( this.evictor != null ) {
            this.evictor.close();

            this.evictor = null;
        }

        if ( this.storage != null ) {
            this.storage.close();

            this.storage = null;
        }

        this.items.clear();

        this.changes.clear();
    }
}

export class TtlMemoryCache<T> extends MemoryCache<T, TtlEvictorOptions, TtlEvictorState> {
    public constructor ( storage ?: CacheStorage<T, TtlEvictorOptions, TtlEvictorState> | string, evictor ?: TtlEvictor<T> | number ) {
        super( storage, typeof evictor === 'number' ? new TtlEvictor( { ttl: evictor } ) : evictor );
    }
}