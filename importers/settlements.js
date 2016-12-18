const Bluebird = require('bluebird')
const randomString = require('randomstring')

const FIND_TILE_SQL = 'SELECT id FROM tiles WHERE x = $<x> AND y = $<y> AND z = $<z>;'
const FIND_CHAR_SQL = 'SELECT id FROM characters WHERE name ILIKE $<name>;'
const FIND_SETTLEMENT_SQL = 'SELECT id FROM settlements WHERE name = $<name>;'

const nullifyEmptyString = (s) => {
  return s && s.length ? s : null
}

module.exports = ({ pg, pgp, mongo }) => {
  console.log(' - settlements')

  const findCharacter = (mongoId) => {
    return Bluebird.resolve()
      .then(() => {
        const col = mongo.collection('characters')
        return col.findOne({_id: mongoId})
      })
      .then((c) => pg.one(FIND_CHAR_SQL, {name: c.name}))
      .then((c) => c.id)
  }

  return Bluebird.resolve()
    .then(() => {
      const col = mongo.collection('settlements')
      return col.find().toArray()
    })
    .each((settlement) => {
      return Bluebird.all([
        pg.one(FIND_TILE_SQL, {x: settlement.x, y: settlement.y, z: 0}),
        settlement.founder ? findCharacter(settlement.founder._id) : null,
        settlement.leader ? findCharacter(settlement.leader._id) : null,
        settlement.destroyer ? findCharacter(settlement.destroyer._id) : null
      ])
      .then(([tile, founderId, leaderId, destroyerId]) => {
        const row = {
          name: settlement.name,
          motto: nullifyEmptyString(settlement.motto),
          description: nullifyEmptyString(settlement.description),
          website_url: nullifyEmptyString(settlement.website_url),
          image_url: nullifyEmptyString(settlement.image_url),
          favor: settlement.favor || 0,
          is_open: settlement.open,
          destroyed_at: settlement.destroyed,
          hq_id: tile.id,
          founder_id: founderId,
          leader_id: leaderId,
          destroyer_id: destroyerId,
          created_at: settlement.founded
        }
        const sql = pgp.helpers.insert(row, null, 'settlements')
        return pg.none(sql)
          .catch((err) => {
            if (err.constraint === 'settlements_name_idx_unique') {
              row.name = randomString.generate(8)
              console.log(`Name conflict! Old name: ${settlement.name}; New name: ${row.name}`)
              const sql = pgp.helpers.insert(row, null, 'settlements')
              return pg.none(sql)
            } else {
              throw err
            }
          })
          .then(() => {
            return pg.one(FIND_SETTLEMENT_SQL, {name: row.name})
          })
          .then(({id}) => id)
      })
      .tap((settlementId) => {
        // membership
        const UPDATE_JOIN = `
          UPDATE profiles
          SET
            settlement_id = $<settlementId>,
            settlement_joined_at = $<joined>
          WHERE
            character_id = $<cId>;
        `
        return Bluebird.resolve(settlement.members || [])
          .each((member) => {
            return findCharacter(member._id)
              .then((cId) => {
                return pg.none(UPDATE_JOIN, {cId, settlementId, joined: member.joined})
              })
          })
      })
      .then(() => {
        // TODO voting
      })
      .then(() => {
        // TODO tile mapping
      })
    })
}
