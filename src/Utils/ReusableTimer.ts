
export interface ReusableTimerOptions {
    interval ?: number;
    rememberLastInterval ?: boolean;
    restartAfterIntervalChange ?: boolean;
    triggerPastEvents ?: boolean;
}

export class ReusableTimer {
    protected timerToken : any = null;

    protected timerLastInterval : number = null;

    protected timerLastDate : number = null;

    protected handler : () => unknown;

    options : ReusableTimerOptions;

    constructor ( handler : () => unknown, options : ReusableTimerOptions = {} ) {
        this.handler = handler;
        this.options = {
            interval: null,
            rememberLastInterval: false,
            restartAfterIntervalChange: false,
            triggerPastEvents: true,
            ...options
        };
    }

    get isTicking () : boolean {
        return this.timerToken != null;
    }

    get elapsed () : number {
        if ( this.isTicking == false ) {
            return null;
        }
        
        return Date.now() - this.timerLastDate;
    }

    get remaining () : number {
        if ( this.isTicking == false ) {
            return null;
        }
        
        return this.interval - this.elapsed;
    }

    get interval () : number {
        if ( this.timerLastInterval != null ) {
            return this.timerLastInterval;
        } else {
            return this.options.interval;
        }
    }

    set interval ( value : number ) {
        const current = this.interval;

        if ( value == current ) {
            return;
        }

        if ( this.timerLastInterval != null ) {
            this.timerLastInterval = value;
        } else {
            this.options.interval = value;
        }

        if ( this.timerToken != null ) {
            if ( this.options.restartAfterIntervalChange ) {
                this.startInternal( value );
            } else {
                const elapsed = Date.now() - this.timerLastDate;
    
                const remaining = value - elapsed;

                if ( remaining <= 0 ) {
                    this.stop();

                    this.startInternal( 0 );
                } else {
                    this.startInternal( remaining )
                }
            }
        }
    }

    protected tick () {
        this.timerToken = null;

        this.timerLastDate = null;

        this.handler();
    }

    protected startInternal ( interval : number = null ) {
        this.timerLastDate = Date.now();

        if ( this.timerToken != null ) {
            clearInterval( this.timerToken );
        }

        this.timerToken = setTimeout( () => this.tick(), interval );
    }

    start ( interval : number = null ) {
        // If no custom interval was given, we use the default interval provided
        if ( interval == null ) {
            interval = this.interval;
        }

        // In case interval is still null, we throw an error
        if ( interval == null ) {
            throw new Error( `No custom or default interval given.` );
        }

        if ( this.options.rememberLastInterval ) {
            this.timerLastInterval = interval;
        }

        this.startInternal( interval );
    }

    stop () {
        if ( this.timerToken != null ) {
            clearInterval( this.timerToken );

            this.timerToken = null;
        }
    }
}