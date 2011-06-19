var Statemachine = require("./vt100.js").TerminalSM,
    Callback     = require("./vtcallback.js").Callback

// this _would_ take a Terminal paramter in a proper
// implementation. With no parameter, it uses a dummy
// terminal to dump the calls to the screen.

var cb = new Callback(),
    sm = new Statemachine(cb.callback())


var tty = require("tty")

tty.setRawMode(true)

var vim = tty.open("/usr/bin/vim")

var vimfd  = vim [0],
    vimpid = vim [1]

process.stdin.pipe(vimfd)
process.stdin.resume()
vimfd.on("data", function(data) {
  sm.execute(data)
})

vimpid.on("exit", function() {
  console.log("done")
  process.exit()
})
