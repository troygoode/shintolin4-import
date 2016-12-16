const Bluebird = require('bluebird')
const randomString = require('randomstring')

const FIND_TILE_SQL = 'SELECT id FROM tiles WHERE x = $<x> AND y = $<y> AND z = $<z>;'

module.exports = ({ pg, pgp, mongo }) => {
  console.log(' - characters')

  const createCharacter = ({ character, characterId, userId, tileId }) => {
    return Bluebird.resolve()
      .then(() => {
        // users_characters
        const row = {
          user_id: userId,
          character_id: characterId
        }
        const sql = pgp.helpers.insert(row, null, 'users_characters')
        return pg.none(sql)
      })
      .then(() => {
        // characters_skills
        if (!character.skills || !character.skills.length) {
          return
        }
        return Bluebird.all(character.skills.map((skill) => {
          const row = {
            character_id: characterId,
            skill
          }
          const sql = pgp.helpers.insert(row, null, 'characters_skills')
          return pg.none(sql)
        }))
      })
      .then(() => {
        // characters_items
        if (!character.items || !character.items.length) {
          return
        }
        return Bluebird.all(character.items.map((i) => {
          const row = {
            character_id: characterId,
            item: i.item,
            quantity: i.count
          }
          const sql = pgp.helpers.insert(row, null, 'characters_items')
          return pg.none(sql)
            .catch((err) => {
              if (err.constraint === 'characters_items_idx_unique') {
                // eat the error
              } else {
                throw err
              }
            })
        }))
      })
      .then(() => {
        // locations
        const row = {
          character_id: characterId,
          tile_id: tileId
        }
        const sql = pgp.helpers.insert(row, null, 'locations')
        return pg.none(sql)
      })
      .then(() => {
        // stats
        // TODO
      })
      .then(() => {
        // profiles
        // TODO
      })
  }

  return Bluebird.resolve()
    .then(() => {
      const characters = mongo.collection('characters')
      return characters.find({ creature: {$exists: false} }).toArray()
    })
    .each((character) => {
      const row = {
        email: character.email,
        password: character.password,
        banned: !!character.banned,
        created_at: new Date(character.created),
        updated_at: new Date(character.created)
      }
      const sql = pgp.helpers.insert(row, null, 'users')
      return pg.none(sql)
        .then(() => {
          return pg.one('SELECT id FROM users WHERE email = $<email>;', character)
        })
        .then(({id: userId}) => {
          return pg.one(FIND_TILE_SQL, character)
            .then(({id: tileId}) => {
              const row = {
                name: character.name
              }
              const sql = pgp.helpers.insert(row, null, 'characters')
              return pg.none(sql)
                .catch((err) => {
                  if (err.constraint === 'characters_name_idx_unique') {
                    row.name = randomString.generate(8)
                    console.log(`Name conflict! New name: ${row.name}`)
                    const sql = pgp.helpers.insert(row, null, 'characters')
                    return pg.none(sql)
                  } else {
                    throw err
                  }
                })
                .then(() => {
                  return pg.one('SELECT id FROM characters WHERE name = $<name>;', row)
                })
                .then(({id: characterId}) => {
                  return createCharacter({
                    character,
                    characterId,
                    userId,
                    tileId
                  })
                })
            })
        })
    })
}
