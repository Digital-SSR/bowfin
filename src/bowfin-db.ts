import { MongoClient, MongoClientOptions, Db } from 'mongodb'
import { Request, Response, NextFunction } from 'express'
import EventHandler from 'events'

enum BowfinDBStatus 
{
    CONNECTED,
    ERROR
}

// Singleton
class BowfinDB
{
    public event: EventHandler

    private static instance: BowfinDB

    private mongoClient: MongoClient

    // Properties
    private _status: BowfinDBStatus

    public get status()
    {
        return this._status
    }

    // Constructor
    private constructor()
    {
        this.event = new EventHandler()
    }

    public static getInstance() : BowfinDB
    {
        if(!BowfinDB.instance) BowfinDB.instance = new BowfinDB()
        return BowfinDB.instance
    }

    public static BowfinMiddleware(req: Request<any>, res: Response, next: NextFunction)
    {
        if(BowfinDB.instance._status === BowfinDBStatus.CONNECTED) next()
        else res.status(500).send("Internal Server Error")
    }

    public connect(uri: string, options: MongoClientOptions) : void
    {
        MongoClient.connect(uri, options, (error, client) => {
            if(error)
            {
                this._status = BowfinDBStatus.ERROR
                this.event.emit('connection-error')
                throw new Error("Failed to establish database connection!")
            }

            this._status = BowfinDBStatus.CONNECTED
            this.mongoClient = client
            this.event.emit('connected')
        })
    }

    public getDatabase(name: string) : Db
    {
        try
        {
            return this.mongoClient.db(name)
        }
        catch(e)
        {
            throw new Error(`Database Error: Cannot find database with name: '${name}'`)
        }
    }
}

export default BowfinDB