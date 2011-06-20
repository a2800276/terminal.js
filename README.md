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

    // hookup callbacks, there is a callback for every `action` (see below) of
    //   the statemachine
    var callback = {...}
    
    // create a Statemachine
    var term_sm = new Statemachine(callbacks)

    // get data from somewhere
    while (var bla = readTerminalData()) {
      // call execute
      term_sm.execute(bla)
    }

Available Callbacks / Actions
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

vtcallback.js provides a default callback that interprets the esc, csi,
etc. calls to some degree and forwards them to a terminal
implementation, described below.

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



    


TODO
====

more or less everything


LICENSE
=======

MIT License (c) Tim Becker 2011
