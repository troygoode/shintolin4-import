const Bluebird = require('bluebird')
const randomString = require('randomstring')

const FIND_TILE_SQL = 'SELECT id FROM tiles WHERE x = $<x> AND y = $<y> AND z = $<z>;'
const FIND_SETTLEMENT_SQL = 'SELECT id FROM settlements WHERE name = $<name>;'

const nullifyEmptyString = (s) => {
  return s && s.length ? s : null
}

module.exports = ({ pg, pgp, mongo, mappings }) => {
  console.log(' - settlements')

  const findCharacter = (mongoId) => {
    if (!mongoId) {
      return null
    }
    return mappings.characters[mongoId.toString()]
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
            settlement_joined_at = $<joined>,
            settlement_vote_id = $<votingForId>
          WHERE
            character_id = $<cId>;
        `
        return Bluebird.resolve(settlement.members || [])
          .each((member) => {
            return Bluebird.all([
              findCharacter(member._id),
              member.voting_for ? findCharacter(member.voting_for._id) : null
            ])
            .then(([cId, votingForId]) => {
              return pg.none(UPDATE_JOIN, {
                cId,
                settlementId,
                votingForId,
                joined: member.joined
              })
            })
          })
      })
      .tap((settlementId) => {
        // tile mapping
        const UPDATE_MAPPING = `
          UPDATE tiles
          SET settlement_id = $<settlementId>
          WHERE x = $<x> AND y = $<y> AND z = $<z>;
        `
        return Bluebird.resolve()
          .then(() => {
            const col = mongo.collection('tiles')
            return col.find({settlement_id: {$exists: true}}).toArray()
          })
          .each((tile) => {
            return pg.none(UPDATE_MAPPING, {
              settlementId,
              x: tile.x,
              y: tile.y,
              z: tile.z
            })
          })
      })
    })
}
