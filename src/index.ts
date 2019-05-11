export { Cache, CacheOptions, CacheStorage, Evictor, CacheRecord, ReadCacheOptions, WriteCacheOptions, ChangeRecord } from './CacheInterface';

export { MemoryCache, TtlMemoryCache } from './MemoryCache';

export { TtlEvictor, TtlEvictorGlobalOptions, TtlEvictorOptions, TtlEvictorOptionsObject, TtlEvictorState } from './Evictors/TtlEvictor';

export { FileStorage } from './Storages/FileStorage';
