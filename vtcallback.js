
var C = require('./constants.js').C

function dummy(name) {
  return function () {
    console.log(name + ":" + JSON.stringify(arguments))
  }
}

function print (char) {
  console.log(String.fromCharCode(char))
}
Terminal = function(){}
Terminal.prototype = {
    "print"          : print 
  , newline        : dummy("newline")
  , carriagereturn : dummy("carriagereturn")
  , cursorMode     : dummy("cursorMode") // "Application" or "Cursor"
  , vt52           : dummy("vt52")
  , setColumns     : dummy("setColumns") // 132 or 80
  , setScrolling   : dummy("setScrolling") // "Smooth" or "Jump"
  , setScreenMode  : dummy("setScreenMode") // "Reverse" or "Normal"
  , setOriginMode  : dummy("setOriginMode") // "Relative" or "Absolute"
  , wraparound     : dummy("wraparound") // bool
  , autorepeat     : dummy("autorepeat") // bool
  , setLFMode      : dummy("setLFMode") // "NL" or "LF"
  , keypadMode     : dummy("keypadMode") // "Application" or "Numeric"
  , setTopAndBottomMargin     : dummy("setTopAndBottomMargin") // This sequence sets the top and bottom margins to define the scrolling region. s. DECSTBM
  , setSGR         : dummy("setSGR") // Select Graphic Rendition, see SGR for params
  , setCursor      : dummy("setCursor") // Select Graphic Rendition, see SGR for params
  , erase          : dummy("erase") // clear screen, see ED for params
  , eraseLine      : dummy("eraseLine") // clear line, see EL for params
  , cursorForward  : dummy("cursorForward") // move cursor forward
  , cursorBack     : dummy("cursorBack") // move cursor backward
  , cursorDown     : dummy("cursorDown") // move cursor down
  , cursorUp       : dummy("cursorUp") // move cursor up
  , clearTab       : dummy("clearTab") // clear tab, see TABC for params
  , setLED         : dummy("setLED") // set LEDs, see LEDS for params 

}

function Callback(terminal) {
  this.terminal = terminal || new Terminal()
  this.process = process
  this.callback = function () {
    var self = this
    return function(data) {
      self.process(data)
    }
  }
}

function process (data) {
  var t = this.terminal
  switch (data.what) {
    case "print":
      t.print(data.which)
      break
    case "execute" :
      execute(t, data)
      break
    case "csi" :
      csi(t, data)
      break
    case "esc":
      esc(t, data)
      break
    default:
      error("don't know: "+JSON.stringify(data))
  }
}

function execute (term, data) {
  switch (data.which) {
    case C.NL:
      term.newline()
      break
    case C.CR:
      term.carriagereturn()
      break
    default:
      //ignore
  }
}

function checkIntermediate (data) {
  if ( 0 !== data.intermediate.length) {
    error("unknown intermediate char for '"+String.fromCharCode(data.which)+"' "+JSON.stringify(data.intermediate))
  }
}

function error (msg) {
  console.log("!"+msg)
}

function csi (term, data) {
  switch (data.which) {
    case C.A:
      checkIntermediate(data)
      var param = data.params.shift() || 1
      term.cursorUp(param)
      break

    case C.B:
      checkIntermediate(data)
      var param = data.params.shift() || 1
      term.cursorDown(param)
      break

    case C.C:
      checkIntermediate(data)
      var param = data.params.shift() || 1
      term.cursorForward(param)
      break

    case C.D:
      checkIntermediate(data)
      var param = data.params.shift() || 1
      term.cursorBackward(param)
      break

    case C.h:
      if (       
                  1 === data.intermediate.length 
          && C.QMARK === data.intermediate[0]
         ) 
      {
        mode(term, data.which, data.params)
        return
      } 
      checkIntermediate(data)
      break
    
    case C.f:
    case C.H:
      checkIntermediate(data) 

      var line = data.params.shift() || 1,
          col  = data.params.shift() || 1

      term.setCursor(line, col)
      break

    case C.g:
      checkIntermediate(data) 

      var param = data.params.shift() || 0
      if (-1 === TABC_VALID.indexOf(param) ) {
        error ("invalid tab clear param: "+param)
      }
      term.clearTab(param)
      break

    case C.J:
      checkIntermediate(data)
      var param = data.params.shift() || 0
      if (-1 === ED_VALID.indexOf(param) ) {
        error ("unknown ED "+param)
      }
      term.erase(param)
      break
    
    case C.K:
      checkIntermediate(data)
      var param = data.params.shift() || 0
      if (-1 === EL_VALID.indexOf(param) ) {
        error ("unknown EL "+param)
      }
      term.eraseLine(param)
      break
    
    case C.l:
      if (       
                  1 === data.intermediate.length 
          && C.QMARK === data.intermediate[0]
         ) 
      {
        mode(term, data.which, data.params)
        return
      } 
      checkIntermediate(data)
      break

    case C.m:
      checkIntermediate(data)
      if (0 === data.params.length) {
        term.setSGR(SGR.OFF)
      }
      for (var i in data.params) {
        var param = data.params[i]
        if (-1 === SGR_VALID.indexOf(param)) {
          error("unknown SGR :"+param)
        }
        term.setSGR(param)
      }
      break

    case C.q:
      checkIntermediate(data) 
      if (0 === data.params.length) {
        term.leds(LEDS.OFF)
      }
      for (var i in data.params) {
        var param = data.params[i]
        if (-1 === LEDS_VALID.indexOf(param)) {
          error("unknown LED :"+param)
        }
        term.setLED(param)
      }
      break

    case C.r:
      checkIntermediate(data)
      var t = data.params.shift() || 0,
          b = data.params.shift() || 0

      if (t > b) {
        error ("top > bottom"+t+" "+b)
        return
      }
      term.setTopAndBottomMargin(t,b)
      break
    
    default:
      error ("csi don't know: "+JSON.stringify(data))
  }
}

function esc (term, data) {
  switch (data.which) {
    case C.GT:
    case C.EQ:
      mode(term, data.which)
      break
    default:
      error ("esc don't know: "+JSON.stringify(data))
      
  }
}


//MODES
var M = {
    DECCKM  : 1 // cursor
  , DECANM  : 2 // ansi/vt52
  , DECCOLM : 3 // column
  , DECSCLM : 4 // scrolling
  , DECSCNM : 5 // screen
  , DECOM   : 6 // origin
  , DECAWM  : 7 // autowrap
  , DECARM  : 8 // auto rep
  , DECINLM : 9 // interlace
  , LF_NL   : 20
}
// GR
SGR = {
    OFF        : 0
  , BOLD       : 1
  , UNDERSCORE : 4
  , BLINK      : 5
  , REVERSE    : 7
}
SGR_VALID = [SGR.OFF, SGR.BOLD, SGR.UNDERSCORE, SGR.BLINK, SGR.REVERSE]

ED = {
    TO_END     : 0
  , FROM_START : 1
  , ALL        : 2
}
ED_VALID = [ED.TO_END, ED.FROM_START, ED.ALL]

EL = {
    TO_END     : 0
  , FROM_START : 1
  , ALL        : 1
}
EL_VALID = [EL.TO_END, EL.FROM_START, EL.ALL]

TABC = {
    CURRENT : 0
  , ALL     : 3
}
TABC_VALID = [TABC.CURRENT, TABC.ALL]

LEDS = {
    OFF : 0
  , L1  : 1
  , L2  : 2
  , L3  : 3
  , L4  : 4
}
LEDS_VALID = [LEDS.OFF, LEDS.L1, LEDS.L2, LEDS.L3, LEDS.L4]

function mode (term, final, params) {
  if (!params || 0 === params.length) {
           if (C.EQ === final) {
    term.keypadMode("Application")
    } else if (C.GT === final)  {
      term.keypadMode("Numeric")
    } 
    return
  }
  var p = params[0]
  switch (p) {
    case M.DECCKM  : // cursor
      if        (C.h === final) {  
        term.cursorMode("Application")
      } else if (C.l === final) {
        term.cursorMode("Cursor")
      } else {
        error("unknown final DECCKM: "+final)
      }
      break

    case M.DECANM  : // vt52 compat
      if (C.l === final) { if        (C.h === final) { 
         term.setOriginMode("Relative")
      } else if (C.l === final) {
        term.setOriginMode("Absolute")
      } else {
        error("unknown final DECOM "+final)
      }
      break

        term.vt52()
      } else {
        error("unknown final DECANM: "+final)
      }
      break

    case M.DECCOLM : //column
       if        (C.h === final) { 
         term.setColumns(132)
      } else if (C.l === final) {
        term.setColumns(80)
      } else {
        error("unknown final DECCOLM: "+final)
      }
      break

    case M.DECSCLM : // scrolling
        if        (C.h === final) { 
         term.setScrolling("Smooth")
      } else if (C.l === final) {
        term.setScrolling("Jump")
      } else { if        (C.h === final) { 
         term.setOriginMode("Relative")
      } else if (C.l === final) {
        term.setOriginMode("Absolute")
      } else {
        error("unknown final DECOM "+final)
      }
      break

        error("unknown final DECSCLM "+final)
      }
      break

    case M.DECSCNM : //Screen
      if        (C.h === final) { 
         term.setScreenMode("Reverse")
      } else if (C.l === final) {
        term.setScreenMode("Normal")
      } else {
        error("unknown final DECSCNM "+final)
      }
      break

    case M.DECOM   : //origin
      if        (C.h === final) { 
         term.setOriginMode("Relative")
      } else if (C.l === final) {
        term.setOriginMode("Absolute")
      } else {
        error("unknown final DECOM "+final)
      }
      break
    case M.DECAWM  : // wrap
      if        (C.h === final) { 
         term.wraparound(true)
      } else if (C.l === final) {
         term.wraparound(false)
      } else {
        error("unknown final DECAWM "+final)
      }
      break

    case M.DECARM  :
      if        (C.h === final) { 
         term.autorepeat(true)
      } else if (C.l === final) {
         term.autorepeat(false)
      } else {
        error("unknown final DECARM "+final)
      }
      break 

    case M.DECINLM :
      if        (C.h === final) { 
         term.interlace(true)
      } else if (C.l === final) {
         term.interlace(false)
      } else {
        error("unknown final DECINLM "+final)
      }
      break
    case M.LF_NL  :
      if        (C.h === final) { 
         term.setLFMode("NL")
      } else if (C.l === final) {
        term.setLFMode("LF")
      } else {
        error("unknown final DECOM "+final)
      }
      break

    default:
      error("unknown mode: "+p)
  }
}

exports.Callback = Callback
exports.Terminal = Terminal
