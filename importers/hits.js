const Bluebird = require('bluebird')

module.exports = ({ pg, pgp, mongo, mappings }) => {
  console.log(' - hits')
  return Bluebird.resolve()
    .then(() => {
      const col = mongo.collection('hits')
      return col.find().toArray()
    })
    .each((hit) => {
      const character = mappings.characters[hit.character]
      if (!character) {
        return
      }

      const row = {
        ip: hit.ip,
        hitdate: new Date(Date.parse(hit.date)),
        character_id: character,
        counter: hit.hits,
        created_at: hit.last_access,
        updated_at: hit.last_access
      }
      const sql = pgp.helpers.insert(row, null, 'hits')
      return pg.none(sql)
    })
}
