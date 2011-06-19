// vt100 (or similiar) statemachine.
// please have a look at (http://vt100.net/emu/dec_ansi_parser) to follow along.


// utilities to save typing
noop = function(){}
between = function(val, min, max) {
  return (val >= min) && (val <=max)
}

//
// Every state in the SM has it's own class that defines it's behaviour
// There are are a number of `events` that happen to the State:
//   entry : when the state is first entered
//   exit  : when a transition to another state occurs
//   characters : the actual data being send to the terminal is received
//
// There are also transition events that occur after the exit of the current
// state an before the entry of the next event.
//
// State objects handle calling their own exit and transition event
// actions, the SM itself handles calling entry actions.
//
// Any event may be associated with some action.
// When an action occurs, the statemachine calls a callback, which
// recieves an object of the following form:
//  { 
//    "what"       : // the action, see below,
//    which        : // the current character,
//    intermediate : // collected intermediate chars,
//    params       : // the collected params
//  }
//
// What may be one of:
//  |print | |
//  |execute | | 
//  |esc | | 
//  |csi | |
//  |dcs_hook| |
//  |dcs_put| |
//  |dcs_unhook| |
//  |ocs_start||
//  |ocs_put| | 
//  |ocs_end| |
// 
//
State = {
  Anywhere           : {name: "Anywhere",           entry:noop},
  Ground             : {name: "Ground",             entry:noop},
  Escape             : {name: "Escape",             entry:noop},
  EscapeIntermediate : {name: "EscapeIntermediate", entry:noop},
  CSIEntry           : {name: "CSIEntry",           entry:noop},
  CSIParam           : {name: "CSIParam",           entry:noop},
  CSIIntermediate    : {name: "CSIIntermediate",    entry:noop},
  CSIIgnore          : {name: "CSIIgnore",          entry:noop},
  DCSEntry           : {name: "DCSEntry",           entry:noop},
  DCSParam           : {name: "DCSParam",           entry:noop},
  DCSIntermediate    : {name: "DCSIntermediate",    entry:noop},
  DCSPassthrough     : {name: "DCSPassthrough",     entry:noop},
  DCSIgnore          : {name: "DCSIgnore",          entry:noop},
  OSCString          : {name: "OSCString",          entry:noop},
  SOS_PM_APCString   : {name: "SOS_PM_APCString",   entry:noop},
}

State.Anywhere.execute = function(ctx) {

  if (
         between(ctx.c, 0x80, 0x8f)
      || between(ctx.c, 0x91, 0x97)
     )
  {
    ctx.execute()
    return State.Ground
  }
  switch (ctx.c) {
    case 0x18:
    case 0x1A:
    case 0x99:
    case 0x0A:
      ctx.execute()
      return State.Ground
    case 0x9c:
      return State.Ground
    case 0x1b:
      return State.Escape
    case 0x98:
    case 0x9E:
    case 0x9F:
      return State.SOS_PM_APCString
    case 0x90:
      return State.DCSEntry
    case 0x9D:
      return State.DCSEntry
    case 0x9B:
      return State.CSIEntry
  }
  log (ctx.c.toString(16))
  log (ctx.sm.state)
  throw new Error("impossible");
}

State.Ground.execute = function(ctx) {

  if (   between(ctx.c, 0x00, 0x17)
      || between(ctx.c, 0x1C, 0x1F)
      || ctx.c === 0x19
  ) {
    ctx.execute()
    return State.Ground;
  } else if (between(ctx.c, 0x20, 0x7F)) { // does not handle utf8!
    ctx.print  ()
    return State.Ground;
  }
  return null
}

State.Escape.entry   = function(ctx) {ctx.clear()}
State.Escape.execute = function(ctx) {
  if (   between(ctx.c, 0x00, 0x17)
      || between(ctx.c, 0x1C, 0x1F)
      || ctx.c === 0x19
     ) 
  {
    ctx.execute()
    return State.Escape;
  } else if (between(ctx.c, 0x20, 0x2F)) {
    ctx.collect(ctx.c)
    return State.EscapeIntermediate
  } else if (
         between(ctx.c, 0x30, 0x4F)
      || between(ctx.c, 0x51, 0x57)
      || between(ctx.c, 0x60, 0x7E)
      || 0x59 === ctx.c
      || 0x5A === ctx.c
      || 0x5C === ctx.c
      ) 
  {
    ctx.escape_dispatch()
    return State.Ground
  }

  switch (ctx.c) {
    case 0x5B: // [
      return State.CSIEntry
    case 0x5D: // ]
      return State.OSCString
    case 0x50: // P
      return State.DSCEntry
    case 0x58:
    case 0x5E:
    case 0x5F:
      return State.SOS_PM_APCString
    case 0x7F:
      // DEL ignore
      return State.Escape
    default:
      return null 
  }

}

State.EscapeIntermediate.execute = function(ctx) {
  if (   
         between(ctx.c, 0x00, 0x17)
      || between(ctx.c, 0x1C, 0x1F)
      || ctx.c === 0x19
     ) 
  {
    ctx.execute()
    return State.EscapeIntermediate;
  } else if (between(ctx.c, 0x20, 0x2f)) {
    ctx.collect(ctx.c)
  } else if (0x7F === ctx.c) {
    //ignore
    return State.EscapeIntermediate;
  } else if (between(ctx.c, 0x30, 0x7E)) {
    ctx.escape_dispatch(ctx.c)
    return State.Ground
  }
}

State.CSIEntry.clear = function(ctx) {ctx.clear()}
State.CSIEntry.execute = function(ctx) {
 if (   
           between(ctx.c, 0x00, 0x17)
        || between(ctx.c, 0x1C, 0x1F)
        || ctx.c === 0x19
       ) 
    {
      ctx.execute()
      return State.CSIEntry;
    } else if (between(ctx.c, 0x40, 0x7E)) {
      ctx.csi_dispatch(ctx.c)
      return State.Ground
    } else if (between(ctx.c, 0x30, 0x39) || (0x3B === ctx.c) ){
      ctx.param(ctx.c)
      return State.CSIParam
    } else if (between(ctx.c, 0x3C, 0x3F)) {
      ctx.collect(ctx.c)
      return State.CSIParam
    } else if (0x3A === ctx.c) { //:
      return State.CSIIgnore
    } else if (between(ctx.c, 0x20, 0x2f)) {
      ctx.collect(ctx.c)
      return State.CSIIntermediate
    } else {
      return null
    }
}

State.CSIParam.execute = function(ctx) {
  if (   
         between(ctx.c, 0x00, 0x17)
      || between(ctx.c, 0x1C, 0x1F)
      || ctx.c === 0x19
     ) 
  {
    ctx.execute()
    return State.CSIParam;
  } else if ( between(ctx.c, 0x30, 0x39) || (0x3B === ctx.c) ) {
    ctx.param(ctx.c)
    return State.CSIParam
  } else if (0x7E === ctx.c) {
    //ignore
    return State.CSIParam;
  } else if (between(ctx.c, 0x40, 0x7e)) {
    ctx.csi_dispatch(ctx.c)
    return State.Ground
  } else if (between (ctx.c, 0x20, 0x2F)) {
    ctx.collect(ctx.c)
    return State.CSIIntermediate
  } else if ( (0x3A === ctx.c) || between(ctx.c, 0x3c, 0x3f) ) {
    return State.CSIIgnore
  } else {
    return null 
  }
}

State.CSIIntermediate.execute = function(ctx) {
  if (   
         between(ctx.c, 0x00, 0x17)
      || between(ctx.c, 0x1C, 0x1F)
      || ctx.c === 0x19
     ) 
  {
    ctx.execute()
    return State.CSIIntermediate;
  } else if (between(ctx.c, 0x20, 0x2F) ) {
    ctx.collect()
    return State.CSIIntermediate;
  } else if (0x7F === ctx.c) {
    //ignore
    return State.CSIIntermediate;
  } else if (between(ctx.c, 0x40, 0x7E)) {
    ctx.csi_dispatch()
    return State.Ground
  } else if (between(ctx.c, 0x30, 0x3f)) {
    return State.CSIIgnore
  } 
  return null
}

State.CSIIgnore.execute = function(ctx) {
  if (   
         between(ctx.c, 0x00, 0x17)
      || between(ctx.c, 0x1C, 0x1F)
      || ctx.c === 0x19
     ) 
  {
    ctx.execute()
    return State.CSIIgnore;
  } else if ( (0x7f === ctx.c) || between(ctx.c, 0x20, 0x3F) ) {
    //ignore
    return State.CSIIgnore
  } else if (between(ctx.c, 0x40, 0x7e) ) {
    return State.Ground
  }
  return null
}

State.DCSEntry.entry = function(ctx){ctx.clear()}
State.DCSEntry.execute = function (ctx) {
  if (   
         between(ctx.c, 0x00, 0x17)
      || between(ctx.c, 0x1C, 0x1F)
      || ctx.c === 0x19
      || ctx.c === 0x7F
     ) 
  {
    //ignore
    return State.DCSEntry;
  } else if (between(ctx.c, 0x40, x7e)) {
    return State.DCSPassthrough
  } else if ( (0x3B === ctx.c) || between(ctx.c, 0x30, 0x39)) {
    ctx.param()
    return State.DCSParam
  } else if (between(ctx.c, 0x3c, 0x3f)) {
    ctx.collect()
    return State.DCSParam
  } else if (0x3a === ctx.c) {
    return State.DCSIgnore
  } else if (between(ctx.c, 0x20, 0x2f)) {
    ctx.collect()
    return State.DCSIntermediate
  }
  return null
}

State.DCSParam.execute = function(ctx) {
  if (   
         between(ctx.c, 0x00, 0x17)
      || between(ctx.c, 0x1C, 0x1F)
      || ctx.c === 0x19
      || ctx.c === 0x7F
     ) 
  {
    //ignore
    return State.DCSParam;
  } else if ((0x3B === ctx.c) || between(ctx.c, 0x30, 0x39) ) {
    ctx.param()
    return State.DCSParam
  } else if ((0x3A === ctx.c) || between(ctx.c, 0x3c, 0x3f) ) {
    return State.DCSIgnore
  } else if (between(ctx.c, 0x20, 0x2f) ) {
    ctx.collect(ctx.c)
    return State.DCSIntermediate
  } else if (between(ctx.c, 0x40, 0x7e) ) {
    return State.DCSPassthrough
  } 
  return null
}

State.DCSIntermediate.execute = function(ctx) {
  if (   
         between(ctx.c, 0x00, 0x17)
      || between(ctx.c, 0x1C, 0x1F)
      || ctx.c === 0x19
      || ctx.c === 0x7F
     ) 
  {
    //ignore
    return State.DCSIntermediate;
  } else if (between(ctx.c, 0x20, 0x2f) ) {
    ctx.collect()
  } else if (between(ctx.c, 0x30, 0x3F) ) {
    return State.DCSIgnore
  } else if (between(ctx.c, 0x40, 0x7e) ){
    return State.DCSPassthrough
  } 
  return null
}

State.DCSPassthrough.entry = function(ctx){ctx.hook()}
State.DCSPassthrough.exit  = function(ctx){ctx.unhook()}
State.DCSPassthrough.execute = function(ctx){
  if (
      0x19 === ctx.c 
      || between(ctx.c, 0x00, 0x17)
      || between(ctx.c, 0x1c, 0x1f)
      || between(ctx.c, 0x20, 0x7e) 
     )
  {
    put(ctx.c)
    return State.DCSPassthrough
  } else if (0x7f === ctx.c) {
    //ignore
    return State.DCSPassthrough
  }

  State.DCSPassthrough.exit()
  
  if (0x9c === ctx.c){
      return State.Ground
  }
  return null
}

State.DCSIgnore.execute = function(ctx) {
  if (
         0x19 === ctx.c 
      || between(ctx.c, 0x00, 0x17)
      || between(ctx.c, 0x1c, 0x1f)
     )
  {
    //ignore
    return State.DCSIgnore
  } 
  if (0x9c === ctx.c) {
    return State.Ground
  }
  return null
}

State.OSCString.entry    = function(ctx) {ctx.osc_start()}
State.OSCString.exit     = function(ctx) {ctx.osc_end()}
State.OSCString.execute  = function(ctx) {
  if (
         0x19 === ctx.c 
      || between(ctx.c, 0x00, 0x17)
      || between(ctx.c, 0x1c, 0x1f)
     )
  {
    //ignore
    return State.OSCString
  } else if (between(ctx.c, 0x20, 0x7f) ) {
    ctx.osc_put()
    return State.OSCString
  } 
  
  State.OSCString.exit(ctx)
  
  if (0x9c === ctx.c) {
    return State.Ground
  }
  return null
}

State.SOS_PM_APCString.execute = function(ctx) {
  if (     between(ctx.c, 0x00, 0x17)
        || between(ctx.c, 0x1C, 0x1F)
        || between(ctx.c, 0x20, 0x7F) 
       ) {
      //ignore ...
      return State.SOS_PM_APCString;
    } else if (0x9c === ctx.c) {
      return State.Ground
    }
  return null
}











// 
// Context is responsible for keeping track of state
// and collecting intermediate characters, params, etc.
// Furthermore it calls the callback method at the approriate time.
//

function Context (callback) {
  this.cb = callback
  this.clear()
}

function dummy (c) {
  return function() {
    console.log(c + ": 0x" + this.c.toString(16) + "("+this.sm.state.name+")")
  }
}


function clear () {
  this.intermediate = []
  this.params       = [0]
}

function collect () {
  this.intermediate.push(this.c)
}
function params () {
  var SEMI = 0x3B
  if (SEMI === this.c) {
    this.params.push(0)
  } else {
    var val  = this.params.pop()
        val *= 10
        val += this.c - 0x30
    this.params.push(val)
  }
}
  
function doCallback (self, what) {
 self.cb({
        "what"         : what
      , which          : self.c  
      , intermediate   : self.intermediate
      , params         : self.params
     })

}


function print () {
  doCallback(this, "print") 
}

function execute () {
  doCallback(this, "execute")
}

function escape_dispatch () {
  doCallback(this, "esc")
}
function csi_dispatch () {
  doCallback(this, "csi")
}

function hook () {
  doCallback(this, "dcs_hook")
}

function put () {
  doCallback(this, "dcs_put")
}

function unhook () {
  doCallback(this, "dcs_unhook")
}

function osc_start () {
  doCallbaack(this, "ocs_start")
}
function osc_put () {
  doCallbaack(this, "ocs_put")
}
function osc_end () {
  doCallbaack(this, "ocs_end")
}



Context.prototype = {
    print           : print 
  , execute         : execute 
  , clear           : clear 
  , collect         : collect 
  , param           : params 
  , escape_dispatch : escape_dispatch 
  , csi_dispatch    : csi_dispatch 
  , hook            : hook 
  , put             : put
  , unhook          : unhook 
  , osc_start       : osc_start 
  , osc_put         : osc_put 
  , osc_end         : osc_end 
}


var log = function (msg) {
  console.log(msg)
  process.stdout.flush()
}

function Statemachine (cb) {
  this.context    = new Context(cb)
  this.context.sm = this
  this.state      = State.Ground

  this.execute = function(str) {
    for (var i = 0; i!= str.length; ++i) {
      this.context.c = str.charCodeAt ? str.charCodeAt(i) : str[i]
      var nstate = this.state
      //log(this.state)
      nstate = this.state.execute(this.context)
      if (!nstate) {
        nstate = State.Anywhere.execute(this.context)
      }
      if (nstate != this.state) {
        this.state = nstate
        this.state.entry(this.context)
      }
    }
  }
}

/**
function callback (cb_data) {
  switch (cb_data.what) {
    case "print":
      process.stdout.write(String.fromCharCode(cb_data.which))
      break
    default:
      console.log()
      console.log(JSON.stringify(cb_data))
  }
}


var callback1 = require('./vtcallback.js'),
    cb       = new callback1.Callback().callback()
var stdin = process.openStdin(),
    sm    = new Statemachine(cb)

stdin.on('data', function(data) {
  sm.execute(data)
})

stdin.on('end', function() {
  console.log("done")
  process.stdout.flush()
})
*/

exports.TerminalSM=Statemachine

