const syrup = require('stf-syrup')
const logger = require('../../util/logger')
const wireutil = require('../../wire/util')
const wire = require('../../wire')
const promiseRetry = require('promise-retry')
const lifecycle = require('../../util/lifecycle')

  module.exports = function(options) {
  // Show serial number in logs
  logger.setGlobalIdentifier(options.serial)

    return syrup.serial()
    .dependency(require('./plugins/logger'))
    .define(function(options) {
      var log = logger.createLogger('device')
      log.info('Preparing device')
      return syrup.serial()
        .dependency(require('./plugins/heartbeat'))
        .dependency(require('./plugins/solo'))
        .dependency(require('./support/push'))
        .dependency(require('./support/sub'))
        .dependency(require('./plugins/group'))
        .dependency(require('./support/storage'))
        .dependency(require('./plugins/devicelog'))
        .dependency(require('./plugins/wda'))
        .dependency(require('./plugins/screen/stream'))
        .dependency(require('./plugins/connect'))
        .define(function(options, heatbeat, solo, push, sub,
         storage, devicelog, stream, wda, connect) {
          if (process.send) {
            process.send('ready')
          }

          promiseRetry({
            retries: 15,
            maxTimeout: 15 * 1000,
            factor: 1
          }, function(retry, number) {
            log.important(`Trying to connet to WDA , TRY : ${number}`)
            return wda.connect(options.wdaServerPort)
              .catch(retry)
          })
            .then(function(value) {
              solo.poke()
            }, function(err) {
              push.send([
                wireutil.global,
                wireutil.envelope(new wire.DeviceAbsentMessage(
                  options.serial
                ))
              ])
              lifecycle.fatal()
            })
        })
        .consume(options)
    })
    .consume(options)
    .catch(function(err) {
      lifecycle.fatal()
    })
}