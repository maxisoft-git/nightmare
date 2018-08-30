/* eslint-disable no-console */

var ipc = require('electron').ipcRenderer
var sliced = require('sliced')

function send(_event) {
  ipc.send.apply(ipc, arguments)
}

// offer limited access to allow
// .evaluate() and .inject()
// to continue to work as expected.
//
// TODO: this could be avoided by
// rewriting the evaluate to
// use promises instead. But
// for now this fixes the security
// issue in: segmentio/nightmare/#1358
window.__nightmare = {
  resolve: function(value) {
    send('response', value)
  },
  reject: function(err) {
    send('error', error(err))
  }
}

// Listen for error events
window.addEventListener(
  'error',
  function(errorEvent) {
    send('page', 'error', error(errorEvent.error))
  },
  true
)

// prevent 'unload' and 'beforeunload' from being bound
var defaultAddEventListener = window.addEventListener
window.addEventListener = function(type) {
  if (type === 'unload' || type === 'beforeunload') {
    return
  }
  defaultAddEventListener.apply(window, arguments)
}

// prevent 'onunload' and 'onbeforeunload' from being set
Object.defineProperties(window, {
  onunload: {
    enumerable: true,
    writable: false,
    value: null
  },
  onbeforeunload: {
    enumerable: true,
    writable: false,
    value: null
  }
})

// listen for console.log
var defaultLog = console.log
console.log = function() {
  send('console', 'log', sliced(arguments))
  return defaultLog.apply(this, arguments)
}

// listen for console.warn
var defaultWarn = console.warn
console.warn = function() {
  send('console', 'warn', sliced(arguments))
  return defaultWarn.apply(this, arguments)
}

// listen for console.error
var defaultError = console.error
console.error = function() {
  send('console', 'error', sliced(arguments))
  return defaultError.apply(this, arguments)
}

// overwrite the default alert
window.alert = function(message) {
  send('page', 'alert', message)
}

// overwrite the default prompt
window.prompt = function(message, defaultResponse) {
  send('page', 'prompt', message, defaultResponse)
}

// overwrite the default confirm
window.confirm = function(message, defaultResponse) {
  send('page', 'confirm', message, defaultResponse)
}

/**
 * Make errors serializeable
 */

function error(err) {
  if (!(err instanceof Error)) return err
  return {
    code: err.code,
    message: err.message,
    details: err.detail,
    stack: err.stack || ''
  }
}

window.nightmareRunEventLoop = function() {
  return new Promise(function(resolve) {
    setTimeout(() => {
      resolve()
    }, 0)
  })
}

function nightmareWaitForNextFrameHelper(numFrames, resolve) {
  window.requestAnimationFrame(() => {
    if (!numFrames) resolve()
    else nightmareWaitForNextFrameHelper(numFrames - 1, resolve)
  })
}

window.nightmareWaitForNextFrame = function(numFrames) {
  return new Promise(function(resolve) {
    window.nightmareRunEventLoop().then(() => {
      nightmareWaitForNextFrameHelper(numFrames, resolve)
    })
  })
}

var pendingKeyPresses = []

window.nightmareExpectKeyPress = function() {
  return new Promise(function(resolve) {
    pendingKeyPresses.push(resolve)
  })
}

var pendingEventLoopKeyPresses = []

window.nightmareExpectEventLoopKey = function() {
  return new Promise(function(resolve) {
    pendingEventLoopKeyPresses.push(resolve)
  })
}

document.addEventListener(
  'keyup',
  event => {
    if (event.keyCode == 135) {
      event.preventDefault()
      if (pendingEventLoopKeyPresses.length > 0)
        pendingEventLoopKeyPresses.pop()()
    } else {
      if (pendingKeyPresses.length > 0) pendingKeyPresses.pop()()
    }
  },
  true
)
