const Bluebird = require('bluebird')

const FIND_TILE_SQL = 'SELECT id FROM tiles WHERE x = $<x> AND y = $<y> AND z = $<z>;'

module.exports = ({ pg, pgp, mongo }) => {
  console.log(' - creatures')
  return Bluebird.resolve()
    .then(() => {
      const characters = mongo.collection('characters')
      return characters.find({ creature: {$exists: true} }).toArray()
    })
    .each((creature) => {
      return pg.one(FIND_TILE_SQL, creature)
        .then((tile) => {
          const row = {
            tile_id: tile.id,
            kind: creature.creature,
            hp: creature.hp,
            hp_max: creature.hp_max
          }
          const sql = pgp.helpers.insert(row, null, 'creatures')
          return pg.none(sql)
        })
    })
}
