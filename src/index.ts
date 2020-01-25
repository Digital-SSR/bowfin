import { MongoClient, MongoClientOptions, Db } from 'mongodb'
import { Request, Response, NextFunction } from 'express'
import EventHandler from 'events'

enum BowfinStatus 
{
    CONNECTED,
    ERROR
}

interface SchemaBlueprint
{
    schemaName: string,
    schemaDefinitions: string[]
}

export const toArray = (iterator: any) : Promise<any[]> => {
    return new Promise((resolve, reject) => {
        iterator.toArray((error: any, result: any[] | PromiseLike<any[]> | undefined) => {
            if(error) reject(error)
            else resolve(result)
        })
    })
}

// Singleton
class Bowfin
{
    public event: EventHandler

    private static instance: Bowfin

    private blueprintDB: Db
    private cachedSchema: SchemaBlueprint[]
    
    /* ---------- Properties ---------- */
    private _mongoClient: MongoClient
    public get mongoClient()
    {
        return this._mongoClient
    }

    
    private _status: BowfinStatus
    public get status()
    {
        return this._status
    }
    /* ---------- ----------- ---------- */

    // Constructor
    private constructor()
    {
        this.event = new EventHandler()
        this.cachedSchema = []

        this.event.on('connected', this.initializeSchema.bind(this))
    }

    public static getInstance() : Bowfin
    {
        if(!Bowfin.instance) Bowfin.instance = new Bowfin()
        return Bowfin.instance
    }

    public static BowfinMiddleware(req: Request<any>, res: Response, next: NextFunction)
    {
        if(Bowfin.instance._status === BowfinStatus.CONNECTED) next()
        else res.status(500).send("Internal Server Error")
    }

    public connect(uri: string, options: MongoClientOptions) : void
    {
        MongoClient.connect(uri, options, (error, client) => {
            if(error)
            {
                this._status = BowfinStatus.ERROR
                this.event.emit('connection-error')
                throw new Error("Failed to establish database connection!")
            }

            this._status = BowfinStatus.CONNECTED
            this._mongoClient = client
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

    private initializeSchema()
    {
        this.blueprintDB = this._mongoClient.db("SchemaBlueprints")

        this.updateSchemaCache().then(_ => {
            console.log(this.cachedSchema)
        })
    }

    private updateSchemaCache()
    {
        return new Promise((resolve, reject) => {
            toArray(this.blueprintDB.listCollections(undefined, { nameOnly: true }))
            .then(collectionArray => {
                return collectionArray.map(collection => collection.name)
            })
            .then(names => {
                let promiseArray = names.map(async name => {
                    const documents: string[] = await toArray(this.blueprintDB.collection(name).find({}))
                    return { schemaName: name, schemaDefinitions: documents } as SchemaBlueprint
                })

                Promise.all(promiseArray)
                .then(schemaBlueprints => {
                    this.cachedSchema = schemaBlueprints
                    resolve()
                })
                .catch(error => {
                    reject(error)
                })
            })
            .catch(error => {
                reject(error)
            })
        })
    }

    public isSchemaNameAvailable(name: string)
    {
        return this.cachedSchema.some(e => e.schemaName === name)
    }

    public addSchema(schemaName: string, schemaDefinition: string) : void
    {

    }
}

export default Bowfin