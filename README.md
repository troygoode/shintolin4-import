# shintolin4-import

This tool is a one-off for migrate data from Shintolin V3's MongoDB-based database into Shintolin V4's PostgreSQL-based database.

## Mongo Restore

```bash
$ mongorestore -h mongo <FILENAME>
```

## Usage

Specify the following values in a `.env` file:

* `MONGODB_URL`
* `POSTGRES_URL`

```javascript
$ yarn install
$ yarn start
```

## License

MIT
