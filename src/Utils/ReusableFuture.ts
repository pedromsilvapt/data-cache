import { Future } from '@pedromsilva/data-future';

export class ReusableFuture<T = void> {
    protected future : Future<T> = null;

    get promise () : Promise<T> {
        if ( this.future == null ) {
            return null;
        }

        return this.future.promise;
    }

    get isEmpty () {
        return true;
    }

    get isPending () {
        return this.future != null;
    }

    prepare () {
        this.future = new Future();
    }

    resolve ( value ?: T | PromiseLike<T> ) {
        const future = this.future;

        this.future = null;

        future.resolve( value );
    }

    reject ( reason ?: any ) {
        const future = this.future;

        this.future = null;

        future.reject( reason );
    }
}