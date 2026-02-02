import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseAPIBlueprint } from './apib-parser.js';

describe('API Blueprint Parser', () => {
  it('should parse a basic API Blueprint document', async () => {
    const apibContent = `
FORMAT: 1A
HOST: https://api.example.com

# My API
This is my API description.

## GET /users
Get a list of users

+ Response 200 (application/json)
    + Body

            [
              {
                "id": 1,
                "name": "John Doe"
              }
            ]

## POST /users
Create a new user

+ Request (application/json)
    + Body

            {
              "name": "John Doe"
            }

+ Response 201 (application/json)
    + Body

            {
              "id": 1,
              "name": "John Doe"
            }
`;

    const schema = await parseAPIBlueprint(apibContent);

    assert.strictEqual(schema.name, 'My API');
    assert.strictEqual(schema.baseUrl, 'https://api.example.com');
    assert.strictEqual(schema.endpoints.length, 2);

    // Check GET endpoint
    const getEndpoint = schema.endpoints.find((e: any) => e.method === 'GET');
    assert.ok(getEndpoint);
    assert.strictEqual(getEndpoint.path, '/users');
    assert.strictEqual(getEndpoint.description, 'Get a list of users');

    // Check POST endpoint
    const postEndpoint = schema.endpoints.find((e: any) => e.method === 'POST');
    assert.ok(postEndpoint);
    assert.strictEqual(postEndpoint.path, '/users');
    assert.strictEqual(postEndpoint.description, 'Create a new user');
  });
});
