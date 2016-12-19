require('dotenv').config()

const Bluebird = require('bluebird')
const MongoDB = require('mongodb')
const pgp = require('pg-promise')({
  promiseLib: Bluebird,
  capSQL: true
})

const tileImporter = require('./importers/tiles')
const creatureImporter = require('./importers/creatures')
const characterImporter = require('./importers/characters')
const settlementImporter = require('./importers/settlements')
const chatImporter = require('./importers/chat')
const hitsImporter = require('./importers/hits')

const pg = pgp(process.env.POSTGRES_URL)
const mappings = {
  characters: {},
  settlements: {}
}
const wrap = (fn) => {
  return (mongo) => {
    return fn({ pg, pgp, mongo, mappings })
  }
}

Bluebird.resolve(MongoDB.MongoClient.connect(process.env.MONGODB_URL))
  .tap(wrap(tileImporter))
  .tap(wrap(creatureImporter))
  .tap(wrap(characterImporter))
  .tap(wrap(settlementImporter))
  .tap(wrap(chatImporter))
  .tap(wrap(hitsImporter))
  .then((mongo) => {
    console.log('SUCCESS')
    mongo.close()
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
