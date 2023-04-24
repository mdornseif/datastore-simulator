/*
 * index.test.ts
 *
 * Created by Dr. Maximilian Dornseif 2021-12-10 in datastore-api
 * Copyright (c) 2021, 2023 Dr. Maximilian Dornseif
 */

import { Datastore, KEY } from '@google-cloud/datastore'
import { assert, describe, expect, test, beforeAll, afterAll } from 'vitest'
import { entity } from '@google-cloud/datastore/build/src/entity'

import { Datastore } from '../src'

process.env.GCLOUD_PROJECT = 'project-id' // Set the datastore project Id globally

function getDatastore() {
  return new Datastore({ namespace: 'test' })
}

describe('Keys', () => {
  test('keySerialize', async () => {
    const kvStore = getDatastore()
    assert.deepEqual(kvStore.key(['testYodel', 123]).path, ['testYodel', 123])
    assert.deepEqual(JSON.parse(JSON.stringify(kvStore.key(['testYodel', 123]))), {
      id: 123 as any, // typing in inconclusive here
      kind: 'testYodel',
      namespace: 'test',
      path: ['testYodel', 123],
    } as any)
    const ser = await kvStore.keyToLegacyUrlSafe(kvStore.key(['testYodel', 123]))
    expect(ser[0].endsWith('g8LEgl0ZXN0WW9kZWwYewyiAQR0ZXN0')).toBeTruthy()
    expect(JSON.parse(JSON.stringify(kvStore.keyFromLegacyUrlsafe(ser[0])))).toMatchInlineSnapshot(`
    {
      "id": "123",
      "kind": "testYodel",
      "namespace": "test",
      "path": [
        "testYodel",
        "123",
      ],
    }
  `)
    expect(kvStore.keyFromLegacyUrlsafe(ser[0])).toMatchInlineSnapshot(`
    Key {
      "id": "123",
      "kind": "testYodel",
      "namespace": "test",
      "path": [
        "testYodel",
        "123",
      ],
    }
  `)
  })

  test('allocateIds', async () => {
    const kvStore = getDatastore()
    const [keys, info] = await kvStore.datastore.allocateIds(kvStore.datastore.key(['testYodel']), 2)
    expect(Array.isArray(keys)).toBeTruthy()
    expect(keys.length).toBe(2)
    expect(keys[0].kind).toBe('testYodel')
    expect(keys[0].id).toMatch(/\d+/)
    expect(typeof keys[0].id).toMatchInlineSnapshot('"string"')
    // expect(keys[0].id).toBeInstanceOf(entity.Int)
    expect(keys[1].kind).toBe('testYodel')
    expect(keys[1].id).toMatch(/\d+/)

    expect(info.keys.length).toBe(2)
    expect(info.keys[0].partitionId.databaseId).toMatchInlineSnapshot('""')
    expect(info.keys[0].partitionId.namespaceId).toMatchInlineSnapshot('"test"')
    expect(info.keys[0].path[0].idType).toMatchInlineSnapshot('"id"')
    expect(info.keys[0].path[0].kind).toMatchInlineSnapshot('"testYodel"')
    expect(info.keys[0].path[0].id).toMatch(/\d+/)
  })
})

describe('Reading', () => {
  test('get num_id', async () => {
    const kvStore = getDatastore()
    const entity = { key: kvStore.key(['testYodel', 2]), data: { foo: 'bar', date: new Date() } }
    const entity2 = {
      key: kvStore.key(['testYodel', 3]),
      data: { foo: 'bar' },
    }
    await kvStore.save([entity, entity2])

    // get with a key as argument returns a Array
    const result = await kvStore.get(entity.key)
    // get with a key as argument returns a Array
    expect(Array.isArray(result)).toBeTruthy()
    expect(result[0].foo).toMatchInlineSnapshot('"bar"')
    // Key.id is always a string
    expect(result[0][Datastore.KEY].id).toMatchInlineSnapshot('"2"')

    // Keys can be different objects
    const result0 = await kvStore.get(kvStore.key(['testYodel', 2]))
    expect(Array.isArray(result0)).toBeTruthy()
    expect(result0[0].foo).toMatchInlineSnapshot('"bar"')
    // Key.id is always a string
    expect(result0[0][Datastore.KEY].id).toMatchInlineSnapshot('"2"')

    const result1 = await kvStore.get(entity2.key)
    expect(Array.isArray(result1)).toBeTruthy()
    expect(result1[0].foo).toMatchInlineSnapshot('"bar"')
    expect(result1[0][Datastore.KEY].id).toMatchInlineSnapshot('"3"')

    // get with a array as argument returns a Array
    const result2 = await kvStore.get([entity.key])
    expect(Array.isArray(result2)).toBeTruthy()
    expect(Array.isArray(result2[0])).toBeTruthy()
    expect(result2[0][0][Datastore.KEY].id).toMatchInlineSnapshot('"2"')

    const result3 = await kvStore.get([entity.key, entity2.key])

    // get with a array as argument returns a Array
    expect(Array.isArray(result3)).toBeTruthy()
    expect(Array.isArray(result3[0])).toBeTruthy()
    expect(result3.length).toMatchInlineSnapshot('1')
    expect(result3[0].length).toMatchInlineSnapshot('2')
    expect(result3[0][0][Datastore.KEY].id).toMatchInlineSnapshot('"2"')
    expect(result3[0][1]?.[Datastore.KEY]?.id).toMatchInlineSnapshot('"3"')

    const result4 = await kvStore.get([entity.key, entity.key])
    // getMulti returns a Array but collapses duplicate keys
    // expect(Array.isArray(result)).toBeTruthy();
    // Firestore in Datastore returns the entity once
    // Datastore Emulator returns the Entity twice
    expect(result4.length).toMatchInlineSnapshot('1')
    expect(result4[0].length).toMatchInlineSnapshot('1')
    expect(result4[0][0][Datastore.KEY].id).toMatchInlineSnapshot('"2"')

    // get returns a Array but omits unknown keys
    const result5 = await kvStore.get([entity.key, kvStore.key(['YodelNeverThere', 3])])
    expect(Array.isArray(result5)).toBeTruthy()
    expect(result5.length).toMatchInlineSnapshot('1')
    expect(result5[0].length).toMatchInlineSnapshot('1')
    expect(result5[0][0][Datastore.KEY].id).toMatchInlineSnapshot('"2"')

    // getMulti returns a empty Array for an empty array
    await expect(() => kvStore.get([])).rejects.toThrowErrorMatchingInlineSnapshot(
      '"At least one Key object is required."'
    )
  })
})

test('get name', async (t) => {
  const kvStore = getDatastore()
  const entity = {
    key: kvStore.key(['testYodel', 'two']),
    data: { foo: 'bar' },
  }
  await kvStore.save([entity])
  const result = await kvStore.get(entity.key)
  expect(result[0][Datastore.KEY]).toMatchInlineSnapshot(`
    Key {
      "kind": "testYodel",
      "name": "two",
      "namespace": "test",
      "path": [
        "testYodel",
        "two",
      ],
    }
  `)
  expect(result[0][KEY]).toMatchInlineSnapshot('undefined')
  expect(result[0]).toMatchInlineSnapshot(`
    {
      "foo": "bar",
      Symbol(KEY): Key {
        "kind": "testYodel",
        "name": "two",
        "namespace": "test",
        "path": [
          "testYodel",
          "two",
        ],
      },
    }
  `)
  expect(result[0]?.foo).toBe('bar')
})

describe('Writing', () => {
  test('save', async () => {
    const kvStore = getDatastore()
    const entity = { key: kvStore.key(['testYodel', 2]), data: { foo: 'bar', date: new Date() } }
    const entity2 = {
      key: kvStore.key(['testYodel', 3]),
      data: { foo: 'bar' },
    }
    const commitResponse = await kvStore.save([entity, entity2])
    expect(Array.isArray(commitResponse)).toBeTruthy()
    expect(commitResponse[0].indexUpdates).toMatch(/\d+/)
    expect(commitResponse[0].mutationResults[0].conflictDetected).toMatchInlineSnapshot('false')
    expect(commitResponse[0].mutationResults[0].key).toMatchInlineSnapshot('null')
    expect(commitResponse[0].mutationResults[0].version).toMatch(/\d+/)
    expect(commitResponse[0].mutationResults[0].createTime.nanos).toMatch(/\d+/)
    expect(commitResponse[0].mutationResults[0].createTime.seconds).toMatch(/\d+/)
    expect(commitResponse[0].mutationResults[0].updateTime.nanos).toMatch(/\d+/)
    expect(commitResponse[0].mutationResults[0].updateTime.seconds).toMatch(/\d+/)

    expect(entity.data.foo).toMatchInlineSnapshot('"bar"')
    // Key.id is still a number (but not when reading)
    expect(entity.key).toMatchInlineSnapshot(`
    Key {
      "id": 2,
      "kind": "testYodel",
      "namespace": "test",
      "path": [
        "testYodel",
        2,
      ],
    }
  `)

    // save can be called with an entity or an array. Both have the same result.
    const commitResponse2 = await kvStore.save(entity)
    expect(Array.isArray(commitResponse2)).toBeTruthy()
    expect(commitResponse2[0].indexUpdates).toMatch(/\d+/)
    expect(commitResponse2[0].mutationResults[0].conflictDetected).toMatchInlineSnapshot('false')
    expect(commitResponse2[0].mutationResults[0].key).toMatchInlineSnapshot('null')
    expect(commitResponse2[0].mutationResults[0].version).toMatch(/\d+/)
    expect(commitResponse2[0].mutationResults[0].createTime.nanos).toMatch(/\d+/)
    expect(commitResponse2[0].mutationResults[0].createTime.seconds).toMatch(/\d+/)
    expect(commitResponse2[0].mutationResults[0].updateTime.nanos).toMatch(/\d+/)
    expect(commitResponse2[0].mutationResults[0].updateTime.seconds).toMatch(/\d+/)
  })
})

describe('query', async () => {
  test.skip('raw', async () => {
    const kvStore = getDatastore()
    const entity = {
      key: kvStore.key(['testYodel', '3']),
      data: { foo: 'bar', baz: 'baz' },
    }

    await kvStore.save([entity])
    const query = kvStore.datastore.createQuery('testYodel')
    query.limit(1)
    const [entities, runQueryInfo] = await kvStore.datastore.runQuery(query)
    expect(entities.length).toMatchInlineSnapshot('1')
    expect(entities[0].foo).toMatchInlineSnapshot('"bar"')
    expect(entities[0][Datastore.KEY]).toMatchInlineSnapshot(`
      Key {
        "id": "2",
        "kind": "testYodel",
        "namespace": "test",
        "path": [
          "testYodel",
          "2",
        ],
      }
    `)
  })

  test.skip('query', async () => {
    const kvStore = getDatastore()
    const entity = {
      key: kvStore.key(['testYodel', '3']),
      data: { foo: 'bar', baz: 'baz' },
    }

    await kvStore.save([entity])
    const query = kvStore.createQuery('testYodel')
    query.limit(1)
    const [entities, runQueryInfo] = await kvStore.runQuery(query)
    expect(entities.length).toMatchInlineSnapshot('0')
    expect(entities[0].foo).toMatchInlineSnapshot('"bar"')
    expect(entities[0][Datastore.KEY]).toMatchInlineSnapshot(`
      Key {
        "id": "2",
        "kind": "testYodel",
        "namespace": "test",
        "path": [
          "testYodel",
          "2",
        ],
      }
    `)
    expect(runQueryInfo.endCursor).toMatch(/[a-zA-Z=]+/)
    expect(entities?.[0]?.foo).toBe('bar')
    expect(entities?.[0]?.[Datastore.KEY]?.kind).toBe('testYodel')
    expect(runQueryInfo?.moreResults).toBe('MORE_RESULTS_AFTER_LIMIT')
  })
})

test('save / upsert', async () => {
  // expect.assertions(2);
  const kvStore = getDatastore()
  const entity = {
    key: kvStore.key(['testYodel', 3]),
    data: { foo: 'bar' } as any,
  }
  const result = await kvStore.save([entity])
  // const result2 = await kvStore.upsert([entity]);
  expect(result?.[0]?.mutationResults?.[0]?.conflictDetected).toBe(false)
  expect(entity.data.foo).toBe('bar')
  expect(entity.data[Datastore.KEY]).toMatchInlineSnapshot('undefined')
})

test('update', async (t) => {
  //     expect.assertions(3);
  const kvStore = getDatastore()
  const keyName = `4insert${Math.random()}`
  const entity = {
    key: kvStore.key(['testYodel', keyName]),
    data: { foo: 'bar' },
  }
  // const request = kvStore.update([entity]);
  // await expect(request).rejects.toThrowError(Error);

  await kvStore.save([entity])
  const result = await kvStore.update([entity])
  expect(result?.[0]?.mutationResults?.[0]?.conflictDetected).toBe(false)
  expect(result?.[0]?.mutationResults?.[0]?.key).toBe(null)
  // expect(result?.[0]?.indexUpdates).toBe(2);
})

test('insert / delete', async (t) => {
  // expect.assertions(2);
  const kvStore = getDatastore()
  const testkey = kvStore.key(['testYodel', 4])
  await kvStore.delete([testkey])
  const entity = {
    key: testkey,
    data: { foo: 'bar' } as any,
  }
  const result = await kvStore.insert([entity])

  expect(result?.[0]?.mutationResults?.[0]?.conflictDetected).toBe(false)
  expect(result?.[0]?.mutationResults?.[0]?.version).toMatch(/\d+/)
  expect(entity.data.foo).toBe('bar')
  expect(entity.key.path[0]).toBe('testYodel')
  // expect(result?.[0]?.indexUpdates).toBe(3);

  const result2 = await kvStore.delete([entity.key])
  expect(result2?.[0]?.mutationResults?.[0]?.conflictDetected).toBe(false)
})

// describe("Transactions", () => {
//   it("simple", async () => {
//     expect.assertions(2);
//     const kvStore = getDstore("huwawi3Datastore");
//     const outerResult = await kvStore.runInTransaction<any>(async () => {
//       // write inside the transaction
//       const entity = { key: kvStore.key(["testYodel", 6]), data: { foo: "foobar" } };
//       const innerResult = await kvStore.save([entity]);
//       // save does not return anything within transactions
//       expect(innerResult).toMatchInlineSnapshot(`undefined`);
//       return 123;
//     });
//     expect(outerResult).toMatchInlineSnapshot(`123`);

//     // this fails in the Datastore Emulator
//     const entitiey = await kvStore.get(kvStore.key(["testYodel", 6]));
//     // expect(entitiey).toMatchInlineSnapshot(`
//     //   Object {
//     //     "foo": "foobar",
//     //     Symbol(KEY): Key {
//     //       "id": "6",
//     //       "kind": "testYodel",
//     //       "namespace": "test",
//     //       "path": Array [
//     //         "testYodel",
//     //         "6",
//     //       ],
//     //     },
//     //   }
//     // `);
//   });

//   it("throws", async () => {
//     expect.assertions(1);
//     const kvStore = getDstore("huwawi3Datastore");
//     const request = kvStore.runInTransaction<any>(async () => {
//       throw new DstoreError("TestError", undefined);
//     });
//     await expect(request).rejects.toThrowError(DstoreError);
//   });
// });

// describe('Exceptions', () => {
//   it('simple', async () => {
//     const t = () => {
//       throw new DstoreError('bla', undefined);
//     };
//     expect(t).toThrow(DstoreError);
//   });
// });

describe('roundtrip', () => {
  test('date', async () => {
    const kvStore = getDatastore()
    const entity = {
      key: kvStore.key(['testYodel', 'jsDate']),
      data: { date: new Date(2023, 1, 2, 3, 4, 5, 6) },
    }
    expect(entity).toMatchInlineSnapshot(`
      {
        "data": {
          "date": 2023-02-02T03:04:05.006Z,
        },
        "key": Key {
          "kind": "testYodel",
          "name": "jsDate",
          "namespace": "test",
          "path": [
            "testYodel",
            "jsDate",
          ],
        },
      }
    `)
    const commitResponse = await kvStore.save([entity])

    const result = await kvStore.get([entity.key])
    expect(result).toMatchInlineSnapshot(`
      [
        [
          {
            "date": 2023-02-02T03:04:05.006Z,
            Symbol(KEY): Key {
              "kind": "testYodel",
              "name": "jsDate",
              "namespace": "test",
              "path": [
                "testYodel",
                "jsDate",
              ],
            },
          },
        ],
      ]
    `)
    expect(result[0][0].date).toMatchInlineSnapshot('2023-02-02T03:04:05.006Z')
    expect(result[0][0].date).instanceOf(Date)
    expect(result[0][0].date).toStrictEqual(new Date(2023, 1, 2, 3, 4, 5, 6))
  })
})
