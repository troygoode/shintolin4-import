const Bluebird = require('bluebird')

module.exports = ({ pg, pgp, mongo }) => {
  console.log(' - hits')
  return Bluebird.resolve()
}
