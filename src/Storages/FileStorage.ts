import { CacheStorage, CacheRecord } from '../CacheInterface';
import { safeFileWriteSync, safeFileWrite } from 'safe-file-write';
import * as fs from 'mz/fs';
import { AsyncStream, dynamic, map } from 'data-async-iterators';
import { fromStream, toStream } from 'data-async-iterators/streams';

export class FileStorage<T, E, S> implements CacheStorage<T, E, S> {
    file : string;

    loading : boolean;

    saving : boolean;

    constructor ( file : string ) {
        this.file = file;
    }
    
    loadSync () : Iterable<CacheRecord<T, E, S>> {
        if ( fs.existsSync( this.file ) ) {
            const contents = fs.readFileSync( this.file, { encoding: 'utf8' } );

            return contents.split( '\n' ).map( line => JSON.parse( line ) );
        }

        return [];
    }

    load () : AsyncIterable<CacheRecord<T, E, S>> {
        return dynamic( async () => {
            if ( await fs.exists( this.file ) ) {
                const fileStream = fs.createReadStream( this.file, { encoding: 'utf8' } );
    
                const stream = new AsyncStream( fromStream( fileStream ) )
                    .chunkByLines()
                    .map( line => JSON.parse( line ) as CacheRecord<T, E, S> );
    
                return stream;
            }
    
            return [];
        } );
    }

    saveSync ( records : Iterable<CacheRecord<T, E, S>> ) : void {
        const contents = Array.from( records ).map( record => JSON.stringify( record ) ).join( '\n' );
        
        safeFileWriteSync( this.file, contents );
    }

    async save ( records : Iterable<CacheRecord<T, E, S>> ) : Promise<void> {
        const stream = map( records, record => JSON.stringify( record ) + '\n' );

        await safeFileWrite( this.file, toStream( stream ) );
    }

    close () : void { }
}
