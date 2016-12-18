# shintolin4-import

This tool is a one-off for migrate data from Shintolin V3's MongoDB-based database into Shintolin V4's PostgreSQL-based database.

## TODO

* [ ] characters.last_action
* [ ] Settlements
* [ ] Settlement Membership
* [ ] Settlement Voting
* [ ] Tile -> Settlement Mapping
* [ ] Hits
* [ ] Chat Messages / Broadcasts / etc.

## Usage

Specify the following values in a `.env` file:

* MONGODB_URL
* POSTGRES_URL

```javascript
$ npm install
$ npm start
```

## License

MIT
