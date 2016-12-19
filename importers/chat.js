const Bluebird = require('bluebird')
const uuid = require('uuid')

const isDuplicate = (msg, lastMsg) => {
  if (!lastMsg) {
    return false
  }
  return msg.type === lastMsg.type && msg.sent.toString() === lastMsg.sent.toString()
}

module.exports = ({ pg, pgp, mongo, mappings }) => {
  console.log(' - chat')

  // broadcasts are sent by players to the entire game
  const persistBroadcast = (msg) => {
    const sender = mappings.characters[msg.sender_id.toString()]

    if (!sender) {
      return
    }

    const row = {
      sent_at: msg.sent,
      sender_id: sender,
      style: msg.volume,
      message: msg.text
    }
    const sql = pgp.helpers.insert(row, null, 'broadcasts')
    return pg.none(sql)
  }

  // broadcasts are sent by players to the entire game
  const persistSettlementBroadcast = (msg) => {
    const sender = mappings.characters[msg.sender_id.toString()]
    const settlement = mappings.settlements[msg.settlement_id.toString()]

    if (!sender || !settlement) {
      return
    }

    const row = {
      sent_at: msg.sent,
      sender_id: sender,
      style: msg.volume,
      message: msg.text,
      settlement_id: settlement
    }
    const sql = pgp.helpers.insert(row, null, 'settlement_broadcasts')
    return pg.none(sql)
  }

  // alerts are sent to all players by the game itself
  const persistAlert = (msg) => {
    const row = {
      sent_at: msg.sent,
      style: 'announcement',
      message: msg.text
    }
    const sql = pgp.helpers.insert(row, null, 'alerts')
    return pg.none(sql)
  }

  const persistSocial = (msg, xref) => {
    const sender = mappings.characters[msg.sender_id.toString()]
    const recipient = mappings.characters[msg.recipient_id.toString()]

    if (!sender || !recipient) {
      return
    }

    if (!msg.text || !msg.text.length) {
      return
    }

    const row = {
      sent_at: msg.sent,
      character_id: recipient,
      sender_id: sender,
      style: msg.volume || 'say',
      message: msg.text,
      cross_reference: xref
    }
    const sql = pgp.helpers.insert(row, null, 'messages')
    return pg.none(sql)
  }

  const persistInfo = (msg, xref) => {
    const character = mappings.characters[msg.recipient_id.toString()]

    if (!character) {
      return
    }

    const row = {
      sent_at: msg.sent,
      character_id: character,
      kind: msg.type,
      data: msg,
      cross_reference: xref
    }
    const sql = pgp.helpers.insert(row, null, 'infos')
    return pg.none(sql)
  }

  const MessageHandler = () => {
    let lastMessage = null
    let xref = uuid.v4()
    let counter = 0

    return (msg) => {
      counter += 1
      if (counter % 1000 === 0) {
        console.log(`Counter: ${counter}`)
      }
      return Bluebird.resolve()
        .then(() => {
          switch (msg.type) {
            case 'announcement':
              // skip duplicate messages
              if (isDuplicate(msg, lastMessage)) {
                return
              }
              return persistAlert(msg)
            case 'social':
              switch (msg.volume) {
                case 'ooc':
                  // skip duplicate messages
                  if (isDuplicate(msg, lastMessage)) {
                    return
                  }
                  return persistBroadcast(msg)
                case 'settlement':
                  // skip duplicate messages
                  if (isDuplicate(msg, lastMessage)) {
                    return
                  }
                  return persistSettlementBroadcast(msg)
                default:
                  // refresh xref for new messages
                  if (!isDuplicate(msg, lastMessage)) {
                    xref = uuid.v4()
                  }
                  return persistSocial(msg, xref)
              }
            default:
              // refresh xref for new messages
              if (!isDuplicate(msg, lastMessage)) {
                xref = uuid.v4()
              }
              return persistInfo(msg, xref)
          }
        })
        .then(() => {
          lastMessage = msg
        })
        .catch((err) => {
          // for debugging
          console.error(JSON.stringify(msg, null, 2))
          throw err
        })
    }
  }

  const handler = MessageHandler()
  const col = mongo.collection('chat_messages')
  return new Bluebird((resolve, reject) => {
    const cursor = col.find().sort({ sent: -1 })

    const next = () => {
      cursor.nextObject((err, msg) => {
        if (err) {
          reject(err)
        } else if (!msg) {
          resolve()
        } else {
          handler(msg)
            .then(() => {
              process.nextTick(() => {
                next()
              })
            })
            .catch(reject)
        }
      })
    }
    next()
  })
}
