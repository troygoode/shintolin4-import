const Bluebird = require('bluebird')

module.exports = ({ pg, pgp, mongo }) => {
  console.log(' - chat')
  return Bluebird.resolve()
}
