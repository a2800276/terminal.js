terminal.js
===========

Javascript handling for terminal io. Presently implements the DEC/ANSI
terminal statemachine described
[here](http://vt100.net/emu/dec_ansi_parser) You'll need to understand
the statemachine descirbed there to use this code.  As most of this
terminal stuff is not exactly mainstream knowledge, you'll probably also
want to read the VT100 Userguide available
[here](http://vt100.net/docs/vt100-ug/)

Using
=====

    // provide a callback that handles the SM's actions,
    // see below for details.
    var callback = {...}
    
    // create a Statemachine
    var term_sm = new Statemachine(callbacks)

    // get data from somewhere
    while (var bla = readTerminalData()) {
      // call execute
      term_sm.execute(bla)
    }

Callback / Actions
=============================

The statemachine is provided a callback by the user. This callback gets
executed whenever an action occurs within the statemachine. Each call
passes in an object:

    
    { 
      "what"       : // the action, see below,
      which        : // the current character,
      intermediate : // collected intermediate chars,
      params       : // the collected params
    }

Actions
-------

The "what" field of the object passed to the callback describes what
action is currently being executed. Available actions are:

    |print | |
    |execute | | 
    |esc | | 
    |csi | |
    |dcs_hook| |
    |dcs_put| |
    |dcs_unhook| |
    |ocs_start||
    |ocs_put| | 
    |ocs_end| |

These are still fairly lowlevel and require an in depth understanding of
temrinal arcana. A.k.a. this is most likely not what you'll want to
implement.

`vtcallback.js` provides a default callback that interprets the esc, csi,
etc. calls to some degree and forwards them to a terminal
implementation, described below.

Have a look at `test.js` to get an idea of how to set things up.


Terminal Interface 
==================

A terminal will be connected to the the callbacks an supported the
following interface:


    | print          | print a character to the current current cursor position |
    | newline        | newline                                                  |
    | carriagereturn | carriagereturn                                           |
    | cursorMode     | cursorMode,  "Application" or "Cursor"                   |
    | vt52           | vt52                                                     |
    | setColumns     | setColumns,  132 or 80                                   |
    | setScrolling   | setScrolling, "Smooth" or "Jump"                         |
    | setScreenMode  | setScreenMode, "Reverse" or "Normal"                     |
    | setOriginMode  | setOriginMode,  "Relative" or "Absolute"                 |
    | wraparound     | wraparound                                               |
    | autorepeat     | autorepeat, bool                                         |
    | setLFMode      | setLFMode, "NL" or "LF"                                  |
    | keypadMode     | keypadMode, "Application" or "Numeric"                   |
    | setTopAndBottomMargin | This sequence sets the top and bottom margins to define the scrolling region. s. DECSTBM |
    | setSGR         |setSGR, Select Graphic Rendition, see SGR for params      |
    | setCursor      |setCursor                                                 |
    | erase          |clear screen, see ED for params                           |
    | eraseLine      |eraseLine, clear line, see EL for params                  |
    | cursorForward  |move cursor forward                                       |
    | cursorBack     |move cursor backward                                      |
    | cursorDown     |move cursor down                                          |
    | cursorUp       |move cursor up                                            |
    | clearTab       |clear tab, see TABC for params                            |
    | setLED         |set LEDs, see LEDS for params                             |


`vtcallbacks.js` provides a default terminal implementation that does
nothing but print everything provided to `print` to stdout and renders
control codes.

    


TODO
====

more or less everything. Please be aware that this code is very likely
to change or possibly be abandoned :)

Any help would be greatly appreciated.

Concerning the statemachine itself, the implementation is quite
complete. Most likely, some work will need to go into multibyte
characters as the sm doesn't really take utf8 into account.


LICENSE
=======

MIT License (c) Tim Becker 2011
