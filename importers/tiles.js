const Bluebird = require('bluebird')

module.exports = ({ pg, pgp, mongo }) => {
  console.log(' - tiles')
  const importTileItems = (tile) => {
    if (!tile.items || !tile.items.length) {
      return
    }

    return pg.one('SELECT id FROM tiles WHERE x = $<x> AND y = $<y> AND z = $<z>;', tile)
      .then(({id}) => {
        return tile.items
          .map((t) => {
            return {
              tile_id: id,
              item: t.item,
              quantity: t.count
            }
          })
          .filter((t) => t.count > 0)
      })
      .each((row) => {
        const sql = pgp.helpers.insert(row, null, 'tiles_items')
        return pg.none(sql)
          .catch((err) => {
            if (err.constraint === 'tiles_items_idx_unique') {
              // eat the error
            } else {
              throw err
            }
          })
      })
  }

  return Bluebird.resolve()
    .then(() => {
      const tiles = mongo.collection('tiles')
      return tiles.find({}).toArray()
    })
    .each((tile) => {
      const row = {
        region: tile.region,
        terrain: tile.terrain,

        x: tile.x,
        y: tile.y,
        z: tile.z,

        building: tile.building,
        building_hp: tile.hp,

        searches: tile.searches || 0,
        signage: tile.message
      }

      if (!row.building || !row.building.length) {
        delete row.building
        delete row.building_hp
      }

      if (row.building && row.building.length && !row.building_hp) {
        // caves, ruins, etc
        row.building_hp = 2147483647 // max integer
      }

      if (!row.signage || !row.signage.length) {
        delete row.signage
      }

      const sql = pgp.helpers.insert(row, null, 'tiles')
      return pg.none(sql)
        .catch((err) => {
          console.log(err)
          throw err
        })
        .then(() => {
          return importTileItems(tile)
        })
    })
}
