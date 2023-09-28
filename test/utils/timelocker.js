const { currentTime, fastForward } = require('./index')();

exports.timelockerSet = async function (timelocker, caller, target, value, sign, callata, eta, fastTime) {
    await timelocker.connect(caller).queueTransaction(target, value, sign, callata, eta);

    await fastForward(fastTime);

    await timelocker.connect(caller).executeTransaction(target, value, sign, callata, eta);
}