/* eslint-disable @typescript-eslint/no-non-null-assertion */
/*
 * index.ts
 *
 * Created by Dr. Maximillian Dornseif 2023-04-20 in huwawi3backend 18.13.0
 * based on https://github.com/KoryNunn/datastore-mock 1.1.0 by korynunn
 */

import {
  DatastoreOptions,
  DatastoreRequest,
  Entity,
  InsertCallback,
  InsertResponse,
  Key,
  KeyToLegacyUrlSafeCallback,
  Datastore as OrigDatastore,
  TransactionOptions,
  UpdateCallback,
  UpdateResponse,
  UpsertCallback,
  UpsertResponse,
  Query,
  Transaction,
  PathType,
} from '@google-cloud/datastore'
import { Entities, entity } from '@google-cloud/datastore/build/src/entity'
import { RunQueryOptions, RunQueryResponse, RunQueryCallback } from '@google-cloud/datastore/build/src/query'
import {
  AllocateIdsCallback,
  AllocateIdsOptions,
  AllocateIdsResponse,
  CommitResponse,
  CreateReadStreamOptions,
  DeleteCallback,
  DeleteResponse,
  GetCallback,
  GetResponse,
  PrepareEntityObjectResponse,
  SaveCallback,
  SaveResponse,
} from '@google-cloud/datastore/build/src/request'
import { promisifyAll } from '@google-cloud/promisify'
import { CallOptions } from 'google-gax'
import * as is from 'is'

const urlSafeKey = new entity.URLSafeKey()

const KEY_SELECT = '__key__'

function filter(query: { filters: any[][] }, field: any, operator: any, value: any): any {
  query.filters.push([field, operator, value])
  return createQuery(query)
}

function limit(query: { limit: any }, limit: any): any {
  query.limit = limit
  return createQuery(query)
}

function select(query: { select: string | string[] }, fields: ConcatArray<never>) {
  query.select = [].concat(fields)

  if (query.select.length > 1 && query.select.includes(KEY_SELECT)) {
    throw new Error('Cannot mix __key__ select with other fields')
  }

  return createQuery(query)
}

function createQuery(query: any): any {
  return {
    filter: filter.bind(null, query),
    limit: limit.bind(null, query),
    select: select.bind(null, query),
    query,
  }
}

export class Datastore extends OrigDatastore {
  namespace: any
  db: Map<string, any>
  auth: any
  rnd = 0
  constructor(options?: DatastoreOptions) {
    super()
    options = options || {}
    this.clients_ = new Map()
    // this.datastore = this as unknown as Datastore;
    this.namespace = options.namespace
    this.db = new Map()

    options.projectId = options.projectId || process.env.DATASTORE_PROJECT_ID
  }
  _keySerializer(key: entity.Key) {
    const newKey =
      key.id === undefined
        ? this.key(key.path)
        : this.key([...key.path.slice(0, -1), this.int(key.path.slice(-1)[0])])
    return JSON.stringify(newKey)
  }

  // export
  // getIndexes getIndexes
  // getProjectId
  // index(id: string): Index {
  //   return new Index(this, id);
  // }

  allocateIds(key: entity.Key, options: AllocateIdsOptions | number): Promise<AllocateIdsResponse>
  allocateIds(key: entity.Key, options: AllocateIdsOptions | number, callback: AllocateIdsCallback): void
  allocateIds(
    key: entity.Key,
    options: AllocateIdsOptions | number,
    callback?: AllocateIdsCallback
  ): void | Promise<AllocateIdsResponse> {
    options = typeof options === 'number' ? { allocations: options } : options
    const allocations = options.allocations || 1
    const result: entity.Key[] = []
    const info = { keys: [] as google.datastore.v1.IKey[] }

    do {
      const id = 5000000000000000 + this.rnd++
      const newKey = this.key([...key.path.slice(0, -1), this.int(id)])
      result.push(newKey)
      info.keys.push({
        partitionId: {
          databaseId: '',
          namespaceId: 'test',
          projectId: 'huwawi3',
        },
        path: [
          {
            id: newKey.id,
            idType: 'id',
            kind: newKey.kind,
          },
        ],
      })
    } while (result.length < allocations)
    callback!(null, result, info)
  }

  delete(keys: Entities, gaxOptions?: CallOptions): Promise<DeleteResponse>
  delete(keys: Entities, callback: DeleteCallback): void
  delete(keys: Entities, gaxOptions: CallOptions, callback: DeleteCallback): void
  delete(
    keys: entity.Key | entity.Key[],
    gaxOptionsOrCallback?: CallOptions | DeleteCallback,
    cb?: DeleteCallback
  ): void | Promise<DeleteResponse> {
    const gaxOptions = typeof gaxOptionsOrCallback === 'object' ? gaxOptionsOrCallback : {}
    const callback = typeof gaxOptionsOrCallback === 'function' ? gaxOptionsOrCallback : cb!

    const result: CommitResponse[] = []

    for (const key of [keys].flat()) {
      this.db.delete(this._keySerializer(key))
      result.push({
        mutationResults: [
          {
            key: null,
            version: 1,
            conflictDetected: false, // (boolean|null);
          },
        ],
        indexUpdates: 1, // number|null);
      } as unknown as CommitResponse)
    }
    setImmediate(() => callback(null, result.length === 1 ? result[0] : (result as any)))
  }
  get(keys: entity.Key | entity.Key[], options?: CreateReadStreamOptions): Promise<GetResponse>
  get(keys: entity.Key | entity.Key[], callback: GetCallback): void
  get(keys: entity.Key | entity.Key[], options: CreateReadStreamOptions, callback: GetCallback): void
  get(
    keys: entity.Key | entity.Key[],
    optionsOrCallback?: CreateReadStreamOptions | GetCallback,
    cb?: GetCallback
  ): void | Promise<GetResponse> {
    const options = typeof optionsOrCallback === 'object' && optionsOrCallback ? optionsOrCallback : {}
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : cb!

    if ([keys].flat().length === 0) {
      throw Error('At least one Key object is required.')
    }

    const result: any[] = []
    let lastK
    for (let key of [keys].flat()) {
      // dedupe
      const k = this._keySerializer(key)
      if (k !== lastK && this.db.has(k)) {
        result.push(this.db.get(k))
      }
      lastK = k
    }

    setImmediate(() => callback(null, Array.isArray(keys) ? result : (result[0] as any)))
  }

  runQuery(query: Query, options?: RunQueryOptions): Promise<RunQueryResponse>
  runQuery(query: Query, options: RunQueryOptions, callback: RunQueryCallback): void
  runQuery(query: Query, callback: RunQueryCallback): void
  runQuery(
    query: Query,
    optionsOrCallback?: RunQueryOptions | RunQueryCallback,
    cb?: RunQueryCallback
  ): void | Promise<RunQueryResponse> {
    const options = typeof optionsOrCallback === 'object' ? optionsOrCallback : {}
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : cb!

    setImmediate(() => callback(null, [], {}))
  }

  merge(entities: Entities): Promise<CommitResponse>
  merge(entities: Entities, callback: SaveCallback): void
  merge(entities: Entities, callback?: SaveCallback): void | Promise<CommitResponse> {
    throw Error('not implemented')
  }

  insert(entities: Entities): Promise<InsertResponse>
  insert(entities: Entities, callback: InsertCallback): void
  insert(entities: Entities, callback?: InsertCallback): void | Promise<InsertResponse> {
    entities = [entities]
      .flat()
      .map(DatastoreRequest.prepareEntityObject_)
      .map((x: PrepareEntityObjectResponse) => {
        x.method = 'insert'
        return x
      })

    this.save(entities, callback!)
  }

  update(entities: Entities): Promise<UpdateResponse>
  update(entities: Entities, callback: UpdateCallback): void
  update(entities: Entities, callback?: UpdateCallback): void | Promise<UpdateResponse> {
    entities = [entities]
      .flat()
      .map(DatastoreRequest.prepareEntityObject_)
      .map((x: PrepareEntityObjectResponse) => {
        x.method = 'update'
        return x
      })

    this.save(entities, callback!)
  }

  upsert(entities: Entities): Promise<UpsertResponse>
  upsert(entities: Entities, callback: UpsertCallback): void
  upsert(entities: Entities, callback?: UpsertCallback): void | Promise<UpsertResponse> {
    entities = [entities]
      .flat()
      .map(DatastoreRequest.prepareEntityObject_)
      .map((x: PrepareEntityObjectResponse) => {
        x.method = 'upsert'
        return x
      })

    this.save(entities, callback!)
  }

  save(entities: Entities, gaxOptions?: CallOptions): Promise<SaveResponse>
  save(entities: Entities, gaxOptions: CallOptions, callback: SaveCallback): void
  save(entities: Entities, callback: SaveCallback): void
  save(
    entities: Entities,
    gaxOptionsOrCallback?: CallOptions | SaveCallback,
    cb?: SaveCallback
  ): void | Promise<SaveResponse> {
    const gaxOptions = typeof gaxOptionsOrCallback === 'object' ? gaxOptionsOrCallback : {}
    const callback = typeof gaxOptionsOrCallback === 'function' ? gaxOptionsOrCallback : cb!

    const methods: Record<string, boolean> = {
      insert: true,
      update: true,
      upsert: true,
    }
    entities = [entities].flat()
    // Iterate over the entity objects, build a proto from all keys and values,
    // then place in the correct mutation array (insert, update, etc).
    const result: CommitResponse[] = []
    ;[entities]
      .flat()
      .map(DatastoreRequest.prepareEntityObject_)
      .forEach((entityObject: Entity, index: number) => {
        let method = 'upsert'
        if (entityObject.method) {
          if (methods[entityObject.method]) {
            method = entityObject.method
          } else {
            throw new Error('Method ' + entityObject.method + ' not recognized.')
          }
        }
        // TODO: generate key

        // Numerical IDs are always encoded as string in the datastore

        const newKey =
          entityObject.key.id === undefined
            ? this.key(entityObject.key.path)
            : this.key([...entityObject.key.path.slice(0, -1), this.int(entityObject.key.path.slice(-1)[0])])

        this.db.set(this._keySerializer(newKey), {
          [Datastore.KEY]: newKey,
          ...entityObject.data,
        })

        result.push({
          mutationResults: [
            {
              key: null,
              version: 1,
              conflictDetected: false, // (boolean|null);
              createTime: { nanos: 1, seconds: 2 },
              updateTime: { nanos: 3, seconds: 4 },
            },
          ],
          indexUpdates: 1, // number|null);
        } as unknown as CommitResponse)
      })
    setImmediate(() => callback(null, result[0] as any))
  }

  static KEY: typeof entity.KEY_SYMBOL = entity.KEY_SYMBOL
  KEY: typeof entity.KEY_SYMBOL = Datastore.KEY
  static MORE_RESULTS_AFTER_CURSOR = 'MORE_RESULTS_AFTER_CURSOR'
  MORE_RESULTS_AFTER_CURSOR = Datastore.MORE_RESULTS_AFTER_CURSOR
  static MORE_RESULTS_AFTER_LIMIT = 'MORE_RESULTS_AFTER_LIMIT'
  MORE_RESULTS_AFTER_LIMIT = Datastore.MORE_RESULTS_AFTER_LIMIT
  static NO_MORE_RESULTS = 'NO_MORE_RESULTS'
  NO_MORE_RESULTS = Datastore.NO_MORE_RESULTS

  createQuery(kind?: string): Query
  createQuery(kind?: string[]): Query
  createQuery(namespace: string, kind: string): Query
  createQuery(namespace: string, kind: string[]): Query
  createQuery(namespaceOrKind?: string | string[], kind?: string | string[]): Query {
    let namespace = namespaceOrKind as string
    if (!kind) {
      kind = namespaceOrKind
      namespace = this.namespace!
    }
    return new Query(this as any, namespace, [kind].flat() as string[])
  }
  key(options: entity.KeyOptions): entity.Key
  key(path: PathType[]): entity.Key
  key(path: string): entity.Key
  key(options: string | entity.KeyOptions | PathType[]): entity.Key {
    const keyOptions = is.object(options)
      ? (options as entity.KeyOptions)
      : {
          namespace: this.namespace,
          path: [options].flat() as PathType[],
        }
    return new entity.Key(keyOptions)
  }
  static isKey(value?: unknown) {
    return entity.isDsKey(value)
  }
  isKey(value?: unknown) {
    return Datastore.isKey(value)
  }

  keyToLegacyUrlSafe(key: entity.Key, locationPrefix?: string): Promise<string>
  keyToLegacyUrlSafe(key: entity.Key, callback: KeyToLegacyUrlSafeCallback): void
  keyToLegacyUrlSafe(key: entity.Key, locationPrefix: string, callback: KeyToLegacyUrlSafeCallback): void
  keyToLegacyUrlSafe(
    key: entity.Key,
    locationPrefixOrCallback?: string | KeyToLegacyUrlSafeCallback,
    callback?: KeyToLegacyUrlSafeCallback
  ): Promise<string> | void {
    const locationPrefix = typeof locationPrefixOrCallback === 'string' ? locationPrefixOrCallback : ''
    callback = typeof locationPrefixOrCallback === 'function' ? locationPrefixOrCallback : callback
    this.auth.getProjectId((err: any, projectId: any) => {
      if (err) {
        setImmediate(() => callback!(err))
        return
      }
      setImmediate(() => callback!(null, urlSafeKey.legacyEncode(projectId!, key, locationPrefix)))
    })
  }

  keyFromLegacyUrlsafe(key: string): entity.Key {
    return urlSafeKey.legacyDecode(key)
  }
  transaction(options?: TransactionOptions) {
    return new Transaction(this as any, options)
  }
}

promisifyAll(Datastore, {
  exclude: [
    'createAggregationQuery',
    'double',
    'isDouble',
    'geoPoint',
    'getProjectId',
    'getSharedQueryOptions',
    'isGeoPoint',
    'index',
    'int',
    'isInt',
    'createQuery',
    'key',
    'isKey',
    'keyFromLegacyUrlsafe',
    'transaction',
  ],
})

export default Datastore
