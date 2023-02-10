# Gizmo Breakout - A Breakout game demo written using the Gizmo engine.

## Goal

The goal of this project is show how the [Gizmo](https://github.com/tylorallison/gizmo) library can be used to create a fully functional 
vanilla javascript game.  Not too many bells and whistles with this project, but stills shows off UI and asset management, a robust event 
system, and some basic handlers for user interaction.  There are two versions of the game published, both with the same functionality, 
but each utilizing the Gizmo library differently.  One uses ES modules to pull in classes defined in Gizmo.  One uses immediately invoked 
function expresssion (IIFE), a more browser friendly variety.

## Usage

This game is hosted in github pages here [Gizmo Breakout (modules)](https://tylorallison.github.io/breakout) or 
[Gizmo Breakout (iife)](https://tylorallison.github.io/breakout/index-iife.html).

To run locally, you will need a web server to host the local directory of files.  For vscode users, try using the [Live Server Extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer).  You could also use a simple python oneliner: **python3 -m http.server 8000**


Once running, use the left/right arrows or mouse to move the paddle.  Try to break the bricks by bouncing the ball to hit them.  Can you make it through all the levels?