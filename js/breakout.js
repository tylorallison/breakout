import {
    Game,
    UiCanvas,
    Hierarchy,
    XForm,
    UiPanel,
    UiText,
    Sfx,
    Mathf,
    SfxRef,
    GameState,
    StateMgr,
    TextFormat,
    EvtSystem,
    Rect,
    Generator,
    Timer,
    Vect,
    Random,
    Schema,
    Bounds,
    SfxSystem,
    Sprite,
    Sketch,
    Animator,
    Assets,
} from 'https://tylorallison.github.io/gizmo/releases/gizmo.mjs';
/*

*/


/**
 * textFormatTemplate provides a TextFormat template.  This allows for common look-and-feel properties like the font
 * default colors, styles, etc. to be assigned project wide.
 * @param {*} opts - per call overrides for the TextFormat specification
 * @returns - a TextFormat specification with project options and per call options specified.
 */
function textFormatTemplate(opts={}) {
    let spec = Object.assign({}, {
        // -- define a common font
        family: 'Fredoka One',
    }, opts);
    return new TextFormat(spec);
}

/**
 * constants used to define colors throughout project
 */
const red = 'rgb(232,59,59)';
const yellow = 'rgb(249,194,43)';
const orange = 'rgb(251,107,29)';
const darkGray = 'rgb(46,34,47)';
const green = 'rgb(22,164,76)';

/**
 * The Ball class extends a basic UI panel (which provides sketch handling and transform/position).
 * We will extend the class to track ball movement and collision state.
 */
class Ball extends UiPanel {

    // SCHEMA --------------------------------------------------------------
    /**
     * define/update the schema for the ball object, each Schema.apply line defines an object property and rules for parsing/handling that property.
     * the definitions here extend the schema from the superclass (UiPanel)
     */
    static {
        // -- bounds of object w/ position and dimension
        Schema.apply(this, 'bounds', { readonly: true, getter: (o,x) => (o.xform) ? new Bounds(o.xform.x+o.xform.minx, o.xform.y+o.xform.miny, o.xform.width, o.xform.height):new Bounds()});
            //let ballBounds = new Bounds(wantx+ball.xform.minx, wanty+ball.xform.miny, ball.xform.width, ball.xform.height);
        // -- angle associated with ball movement
        Schema.apply(this, 'angle', {dflt: 0});
        // -- speed of the ball
        Schema.apply(this, 'speed', {dflt: 0});
        // -- boolean indicating if the ball is currently colliding with the paddle
        Schema.apply(this, 'colliding', {dflt: false});
    }

    // CONSTRUCTOR/DESTRUCTOR ----------------------------------------------
    /**
     * cpre is a pre-constructor function that allows for processing/modification of the object specification.
     * @param {*} spec - the specification is an object map that allows for object key/values to be passed to the constructor.
     *                   the key/value pairs are parsed/processed based on the defined object schema
     */
    cpre(spec) {
        // provide a sketch for the ball which will override the UiPanel class default
        // Generator creates a gizmo data structure from a specification
        // Assets provides provide for access to tagged resources defined in the game definition
        if (!spec.sketch) spec.sketch = Generator.generate(Assets.get('ball'));
        super.cpre(spec);
    }

    /**
     * destroy is called to destroy an gizmo data object
     */
    destroy() {
        // play a sound when the ball is destroyed
        // SfxSystem uses asset tags to identify sound effects to play and starts then asynchronously
        SfxSystem.playSfx(this, 'lost.ball');
        super.destroy();
    }
}

/**
 * The Brick class extends a basic UI panel (which provides sketch handling and transform/position).
 * We will extend the class to keep track of points to award and how many hits are required to destroy the brick.
 */
class Brick extends UiPanel {

    // SCHEMA --------------------------------------------------------------
    /**
     * define/update the schema for the brick object, each Schema.apply line defines an object property and rules for parsing/handling that property.
     * the definitions here extend the schema from the superclass (UiPanel)
     */
    static {
        // -- bounds of object w/ position and dimension
        Schema.apply(this, 'bounds', { readonly: true, getter: (o,x) => (o.xform) ? new Bounds(o.xform.x+o.xform.minx, o.xform.y+o.xform.miny, o.xform.width, o.xform.height):new Bounds()});
        // the points to award for this brick
        Schema.apply(this, 'score', {dflt: 100});
        // the number of hits required to destroy this block
        Schema.apply(this, 'hits', {dflt: 1});
    }

    // CONSTRUCTOR/DESTRUCTOR ----------------------------------------------
    /**
     * cpre is a pre-constructor function that allows for processing/modification of the object specification.
     * @param {*} spec - the specification is an object map that allows for object key/values to be passed to the constructor.
     *                   the key/value pairs are parsed/processed based on the defined object schema
     */
    cpre(spec) {
        // parse hit count
        let hits = spec.hits || 1;
        // update default sketch based on hits
        if (!spec.sketch) spec.sketch = Generator.generate(Assets.get(`brick.${hits}`));
        // update score based on hits
        if (!spec.score) spec.score = hits*100;
        super.cpre(spec);
    }

    // METHODS -------------------------------------------------------------
    /**
     * hit is used to register a collision of the ball with a brick
     */
    hit() {
        // bricks can take multiple hits
        this.hits--;
        // if hits reaches zero, brick gets destroyed
        if (this.hits <= 0) {
            SfxSystem.playSfx(this, 'brick.destroyed');
            this.destroy();
        // otherwise, update brick sketch
        } else {
            SfxSystem.playSfx(this, 'brick.hit');
            this.sketch = Generator.generate(Assets.get(`brick.${this.hits}`));
        }
    }
}

/**
 * The Wall class extends a basic UI panel (which provides sketch handling and transform/position).
 * We will extend the class to handle ball collisions
 */
class Wall extends UiPanel {
    // STATIC VARIABLES ----------------------------------------------------
    // how long does the wall "light up" when hit by a ball (in ms)
    static hitTTL = 300;

    // SCHEMA --------------------------------------------------------------
    /**
     * define/update the schema for the brick object, each Schema.apply line defines an object property and rules for parsing/handling that property.
     * the definitions here extend the schema from the superclass (UiPanel)
     */
    static {
        // -- bounds of object w/ position and dimension
        Schema.apply(this, 'bounds', { readonly: true, getter: (o,x) => (o.xform) ? new Bounds(o.xform.x+o.xform.minx, o.xform.y+o.xform.miny, o.xform.width, o.xform.height):new Bounds()});
        // the wall state, one of 'idle' or 'hit'
        Schema.apply(this, 'state', {dflt: 'idle'});
    }

    // CONSTRUCTOR/DESTRUCTOR ----------------------------------------------
    /**
     * cpre is a pre-constructor function that allows for processing/modification of the object specification
     * @param {*} spec - the specification is an object map that allows for object key/values to be passed to the constructor.
     *                   the key/value pairs are parsed/processed based on the defined object schema
     */
    cpre(spec) {
        // parse xform
        let xform = spec.xform;
        // determine wall sketch tag based on dimensions from xform
        let sketchTag = (xform && xform.width>xform.height) ? 'wall.h' : 'wall.v';
        // update default sketch based on computed tag
        if (!spec.sketch) spec.sketch = Generator.generate(Assets.get(sketchTag));
        super.cpre(spec);
    }

    // METHODS -------------------------------------------------------------
    /**
     * register a hit of the ball with this wall
     */
    hit() {
        SfxSystem.playSfx(this, 'wall.hit');
        if (this.state === 'idle') {
            // update wall state to indicate it has been hit
            // NOTE: the sketch asset used for this class is an Animator sketch class.  Animator classes track linked gizmo state 
            //       to automatically switch sketches to match gizmo (in this case wall) state.
            this.state = 'hit';
            // create a timer that will transition the state back to 'idle' after the timer completes.
            new Timer({ttl: this.constructor.hitTTL, cb: () => this.state = 'idle'});
        }
    }

}

/**
 * The Paddle class extends a basic UI panel (which provides sketch handling and transform/position).
 * We will extend the class to handle ball collisions and position updates
 */
class Paddle extends UiPanel {

    // SCHEMA --------------------------------------------------------------
    /**
     * define/update the schema for the brick object, each Schema.apply line defines an object property and rules for parsing/handling that property.
     * the definitions here extend the schema from the superclass (UiPanel)
     */
    static {
        // -- bounds of object w/ position and dimension
        Schema.apply(this, 'bounds', { readonly: true, getter: (o,x) => (o.xform) ? new Bounds(o.xform.x+o.xform.minx, o.xform.y+o.xform.miny, o.xform.width, o.xform.height) : new Bounds()});
        // -- percent of play space each edge takes up
        Schema.apply(this, 'edgeWidthPct', { dflt: 1/24 });
        // the wall state, one of 'idle' or 'hit'
        // -- 'setter' function is called whenever the property is set and is given the (object, object specification, value) and must return the value
        //    to be stored.  This is called prior to storing the value and allows for filtering/modifying values before they are saved.  Here, we clamp
        //    the value to be between 0 and 1.
        // -- 'onSet' function is called after a value has been set and stored and is passed (object, old value, new value).  This is useful if there
        //    are side effects you want to apply when a value is set that are dependent on the stored value.  Here, we modify the paddle's transform (xform)
        //    based on linear interpretation of the paddle value.
        Schema.apply(this, 'value', {dflt: .5, setter: (o,x,v) => Mathf.clamp(v, 0, 1), onSet: (o,ov,nv) => {
            if (o.xform && o.xform.parent) {
                let edgeWidth = o.xform.parent.width * o.edgeWidthPct;
                let left = o.xform.parent.minx+edgeWidth;
                let right = o.xform.parent.maxx-edgeWidth;
                o.xform.x = Mathf.lerp(0, 1, left + o.xform.width/2, right-o.xform.width/2, nv);
            }
        }});
    }

    // CONSTRUCTOR ---------------------------------------------------------
    /**
     * cpre is a pre-constructor function that allows for processing/modification of the object specification
     * @param {*} spec - the specification is an object map that allows for object key/values to be passed to the constructor.
     *                   the key/value pairs are parsed/processed based on the defined object schema
     */
    cpre(spec) {
        // update default sketch for paddle
        if (!spec.sketch) spec.sketch = Generator.generate(Assets.get('paddle'));
        super.cpre(spec);
    }

}

/**
 * The TitleState class extends the gizmo game state class, which provides for integration with the game's state manager.
 * The state manager performs state transitions based on triggered events.
 * The TitleState is providing the UI elements and user interaction handling for the main title screen.
 */
class TitleState extends GameState {

    // METHODS -------------------------------------------------------------
    /**
     * prepare is an asynchronous function used to setup the game state.
     */
    async prepare() {
        // The main UI is created by nesting UI elements under a top-level canvas.
        // Each UI element has a transform (xform) that defines the position of the element with respect to the parent.
        // Sensible defaults are used for each UI class, so all options are not required for every instantiation.
        this.cvs = new UiCanvas({
            children: [
                // A panel is used to render a sketch to the UI
                new UiPanel({
                    // tags can be specified so that the UI elements can be looked up
                    tag: 'mainPanel',
                    // lookup the background asset 'bg' to use as the sketch
                    sketch: Generator.generate(this.assets.get('bg')),
                    // here, the main panel's transform is being defined to be a percent of the parent's size
                    // 'grip' is shorthand for specifying 'left', 'right', 'top', 'bottom' all being the same value, or 15% of the parent's size
                    // 'gripOffsetForceRatio' is used to force a specific aspect ratio (width/height).  this will cause the panel to shrink either the
                    //   horizontal or vertical space to maintain this ratio
                    xform: new XForm({ grip: .15, gripOffsetForceRatio: 480/640 }),
                    children: [
                        // a text UI element for the main title
                        new UiText({
                            text: 'Gizmo Breakout',
                            // NOTE: the use of the textFormatTemplate defined above, providing global look-and-feel across all text elements
                            fmt: textFormatTemplate({ color: red }),
                            xform: new XForm({ left: .15, right: .15, top: .3, bottom: .5}),
                        }),
                        // a text UI element for the player instructions
                        new UiText({
                            text: '-- press a key or click to play --',
                            fmt: textFormatTemplate({ color: yellow }),
                            xform: new XForm({ left: .1, right: .1, top: .5, bottom: .4}),
                        }),
                    ],
                }),
            ]
        });
        // set up event listeners for user interactions
        // -- a 'key.down' event is triggered whenever the player presses a key.
        //    a gizmo context variable is associated with every gizmo object.  this context acts as a global event emitter and can be used to listen
        //    for events across all game objects.  Thie 'EvtSystem.listen' sets up a listener function, which is defined here to call
        //    'StateMgr.start', which causes the state manager to transition to the 'play' state.
        EvtSystem.listen(this.gctx, this, 'key.down', () => StateMgr.start('play'));
        // -- the 'mouse.clicked' event is triggered when the mouse is clicked.  Note, in this case the canvas is the event emitter (not the gizmo context).
        //    by default, mouse events will be triggered for each UI element that the mouse is over.  The gizmo context acts as a collector for all those events, 
        //    and could register multiple events for a single click.
        EvtSystem.listen(this.cvs, this, 'mouse.clicked', () => StateMgr.start('play'));
    }

    /**
     * Stop is called by the state manager when a state is transitioning from started to an inactive state.
     * Event handlers should be disabled here.
     */
    async stop() {
        SfxSystem.playSfx(this, 'blip');
        await super.stop();
        // disable the 'key.down and 'mouse.clicked' handlers
        EvtSystem.ignore(this.gctx, this, 'key.down');
        EvtSystem.ignore(this.cvs, this, 'mouse.clicked');
        // destroy the canvas
        this.cvs.destroy();
    }
}

/**
 * The GameOverState class extends the gizmo game state class, which provides for integration with the game's state manager.
 * The state manager performs state transitions based on triggered events.
 * The GameOverState is providing the UI elements and user interaction handling for the game over screen.
 */
class GameOverState extends GameState {

    // METHODS -------------------------------------------------------------
    /**
     * prepare is an asynchronous function used to setup the game state.
     */
    async prepare(data={}) {
        let score = data.score || 0;
        this.cvs = new UiCanvas({ children: [
            new UiPanel({
                sketch: Generator.generate(this.assets.get('bg')),
                xform: new XForm({ grip: .15, gripOffsetForceRatio: 480/640 }),
                children: [
                    new UiText({
                        text: 'Game Over',
                        fmt: textFormatTemplate({ color: red }),
                        xform: new XForm({ left: .15, right: .15, top: .3, bottom: .5}),
                    }),
                    new UiText({
                        text: '-- press a key or click to continue --',
                        fmt: textFormatTemplate({ color: yellow }),
                        xform: new XForm({ left: .1, right: .1, top: .5, bottom: .4}),
                    }),
                    new UiText({
                        text: `score: ${score}`,
                        fmt: textFormatTemplate({ color: orange }),
                        xform: new XForm({ left: .1, right: .1, top: .65, bottom: .3}),
                    }),
                ],
            }),
        ]});
        EvtSystem.listen(this.gctx, this, 'key.down', () => StateMgr.start('title'));
        EvtSystem.listen(this.cvs, this, 'mouse.clicked', () => StateMgr.start('title'));
    }

    /**
     * Stop is called by the state manager when a state is transitioning from started to an inactive state.
     * Event handlers should be disabled here.
     */
    async stop() {
        SfxSystem.playSfx(this, 'blip');
        await super.stop();
        EvtSystem.ignore(this.gctx, this, 'key.down');
        EvtSystem.ignore(this.cvs, this, 'mouse.clicked');
        this.cvs.destroy();
    }
}

/**
 * The WinState class extends the gizmo game state class, which provides for integration with the game's state manager.
 * The state manager performs state transitions based on triggered events.
 * The WinState is providing the UI elements and user interaction handling for the game won screen.
 */
class WinState extends GameState {

    // METHODS -------------------------------------------------------------
    /**
     * prepare is an asynchronous function used to setup the game state.
     */
    async prepare(data={}) {
        let score = data.score || 0;
        this.cvs = new UiCanvas({ children: [
            new UiPanel({
                sketch: Generator.generate(this.assets.get('bg')),
                xform: new XForm({ grip: .15, gripOffsetForceRatio: 480/640 }),
                children: [
                    new UiText({
                        text: `You're a Winner!`,
                        fmt: textFormatTemplate({ color: green }),
                        xform: new XForm({ left: .15, right: .15, top: .3, bottom: .5}),
                    }),
                    new UiText({
                        text: '-- press a key or click to continue --',
                        fmt: textFormatTemplate({ color: yellow }),
                        xform: new XForm({ left: .1, right: .1, top: .5, bottom: .4}),
                    }),
                    new UiText({
                        text: `score: ${score}`,
                        fmt: textFormatTemplate({ color: orange }),
                        xform: new XForm({ left: .1, right: .1, top: .65, bottom: .3}),
                    }),
                ],
            }),
        ]});
        EvtSystem.listen(this.gctx, this, 'key.down', () => StateMgr.start('title'));
        EvtSystem.listen(this.cvs, this, 'mouse.clicked', () => StateMgr.start('title'));
    }

    /**
     * Stop is called by the state manager when a state is transitioning from started to an inactive state.
     * Event handlers should be disabled here.
     */
    async stop() {
        SfxSystem.playSfx(this, 'blip');
        await super.stop();
        EvtSystem.ignore(this.gctx, this, 'key.down');
        EvtSystem.ignore(this.cvs, this, 'mouse.clicked');
        this.cvs.destroy();
    }
}

/**
 * The PlayState class extends the gizmo game state class, which provides for integration with the game's state manager.
 * The state manager performs state transitions based on triggered events.
 * The PlayState is providing the UI elements and user interaction handling for the main game play screen.
 */
class PlayState extends GameState {

    // STATIC VARIABLES ----------------------------------------------------
    // The game is layed out with a fixed aspect ration of 3/4.
    // Game art is drawn to fit a grid of 24x32.  Game title takes up top two rows of grid, leaving playground of 24x30.
    // Calculate scale of objects based on this grid.
    // -- paddle is 3x1
    static paddleWidthPct = 3/24;
    static paddleHeightPct = 1/30;
    static paddleYPct = 26/30;
    // -- ball is 1x1
    static ballRadiusPct = 1/48;
    static ballSpawnBufferPct = .1;
    static ballSpawnYPct = 15/30;
    // -- area for bricks is 18x11, leaving 3 tiles around edge
    static brickLeftPct = 3/24;
    static brickRightPct = 3/24;
    static brickTopPct = 3/30;
    static brickBottomPct = 16/30;
    // -- walls or 1 tile around playground
    static wallWidthPct = 1/24;
    static wallHeightPct = 1/30;
    // -- speed for paddle/ball
    static paddleSpeed = .001;
    static ballSpeed = .24;
    // -- level data is defined by an array interpreted as rows and columns
    // -- this makes each brick 2x1
    static maxRows = 11;
    static maxCols = 9;
    // define three different levels for the game
    // each entry in the array represents a brick space in game.
    // 0 - for no brick
    // 1,2,3 - for a brick that requires that number of hits to break
    static levels = [
        [
            1,0,0,0,0,0,0,0,1,
            0,0,0,0,0,0,0,0,0,
            0,0,0,0,0,0,0,0,0,
            0,0,0,0,0,0,0,0,0,
            0,0,0,0,0,0,0,0,0,
            1,1,2,0,3,0,2,1,1,
            0,0,0,0,0,0,0,0,0,
            0,0,0,0,0,0,0,0,0,
            0,0,0,0,0,0,0,0,0,
            0,0,0,0,0,0,0,0,0,
            1,0,0,0,0,0,0,0,1,
        ],
        [
            0,0,0,0,0,0,0,0,0,
            0,0,0,0,0,0,0,0,0,
            0,0,0,0,0,0,0,0,0,
            0,1,1,1,1,1,1,1,0,
            1,0,1,1,1,1,1,0,1,
            0,2,2,3,1,3,2,2,0,
            0,0,0,0,0,0,0,0,0,
            0,0,0,0,0,0,0,0,0,
            0,0,0,0,0,0,0,0,0,
            0,0,0,0,0,0,0,0,0,
            0,0,0,0,0,0,0,0,0,
        ],
        [
            0,0,0,0,0,0,0,0,0,
            0,2,2,3,1,3,2,2,0,
            1,0,1,0,1,0,1,0,1,
            0,1,1,1,1,1,1,1,0,
            1,0,1,0,1,0,1,0,1,
            0,2,2,3,1,3,2,2,0,
            0,0,0,0,0,0,0,0,0,
            0,0,0,0,0,0,0,0,0,
            0,0,0,0,0,0,0,0,0,
            0,0,0,0,0,0,0,0,0,
            0,0,0,0,0,0,0,0,0,
        ],
    ];

    // METHODS -------------------------------------------------------------
    /**
     * prepare is an asynchronous function used to setup the game state.
     */
    async prepare() {
        // local state variables keeping track of score, # of lives left, and current level
        this.score = 0;
        this.lives = 3;
        this.level = 0;
        this.gameover = false;
        // local state tracking balls, bricks, walls elements
        this.balls = [];
        this.bricks = [];
        this.walls = [];
        // the main game play UI
        this.cvs = new UiCanvas({ children: [
            new UiPanel({
                tag: 'background',
                sketch: Sketch.zero,
                xform: new XForm({ grip: .15, gripOffsetForceRatio: 480/640 }),
                mask: true,
                children: [
                    // title text
                    new UiText({
                        text: 'Gizmo Breakout',
                        fmt: textFormatTemplate({ color: red }),
                        xform: new XForm({ left: .15, right: .15, top: .015, bottom: .935}),
                    }),
                    // panel for the playground
                    new UiPanel({
                        tag: 'playground',
                        sketch: Generator.generate(this.assets.get('bg')),
                        xform: new XForm({ origx: 0, origy: 0, left: 0/24, right: 0/24, top: 2/32, bottom: 0}),
                        children: [
                            // playground includes the paddle, other elements will be spawned
                            new Paddle({
                                tag: 'paddle',
                                xform: new XForm({ left: 0, right: 1, top: 0, bottom: 1, fixedWidth: 50, fixedHeight: 15, y: 200 }),
                            }),
                        ],
                    }),
                    // the timer
                    new UiText({
                        tag: 'timer',
                        text: '3',
                        visible: false,
                        fmt: textFormatTemplate({ color: red }),
                        xform: new XForm({ grip: .4}),
                    }),
                    // bottom row of text elements showing lives, score and level
                    new UiText({
                        tag: 'lives',
                        text: `lives: ${this.lives}`,
                        alignx: 0,
                        fmt: textFormatTemplate({ color: orange }),
                        xform: new XForm({ left: .1, right: .5, top: .935, bottom: 0.025}),
                    }),
                    new UiText({
                        tag: 'score',
                        text: `score: ${this.score}`,
                        fmt: textFormatTemplate({ color: orange }),
                        xform: new XForm({ left: .2, right: .2, top: .925, bottom: 0.025}),
                    }),
                    new UiText({
                        tag: 'level',
                        text: `level: ${this.level+1}`,
                        alignx: 1,
                        fmt: textFormatTemplate({ color: orange }),
                        xform: new XForm({ right: .1, left: .5, top: .935, bottom: 0.025}),
                    }),
                ],
            }),
        ]});

        // retrieve UI elements based on finding element w/ specified tag
        this.background = Hierarchy.find(this.cvs, (v) => v.tag === 'background');
        this.playground = Hierarchy.find(this.cvs, (v) => v.tag === 'playground');
        this.paddle = Hierarchy.find(this.cvs, (v) => v.tag === 'paddle');
        // values based on UI element sizes
        this.scale = this.playground.xform.width/480;
        let edgeWidth = this.constructor.wallWidthPct * this.playground.xform.width;
        let edgeHeight = this.constructor.wallHeightPct * this.playground.xform.width;
        this.leftEdge = edgeWidth;
        this.rightEdge = this.playground.xform.width-edgeWidth;
        this.topEdge = edgeHeight;
        this.bottomEdge = this.playground.xform.height;
        // resize paddle
        this.paddle.xform.fixedWidth = Math.round(this.playground.xform.width * this.constructor.paddleWidthPct);
        this.paddle.xform.fixedHeight = Math.round(this.playground.xform.height * this.constructor.paddleHeightPct);
        this.paddle.xform.y = Math.round(this.playground.xform.height * this.constructor.paddleYPct);
        this.paddle.xform.x = Mathf.lerp(0, 1, this.leftEdge + this.paddle.xform.fixedWidth/2, this.rightEdge-this.paddle.xform.fixedWidth/2, this.paddle.value);
        // bind event handlers
        this.onKeyEvt = this.onKeyEvt.bind(this);
        this.onMouseEvt = this.onMouseEvt.bind(this);
        this.onBallTick = this.onBallTick.bind(this);
        this.onBrickDestroyed = this.onBrickDestroyed.bind(this);
        // setup listeners
        EvtSystem.listen(this.gctx, this, 'key.down', this.onKeyEvt);
        EvtSystem.listen(this.gctx, this, 'key.up', this.onKeyEvt);
        EvtSystem.listen(this.gctx, this, 'mouse.moved', this.onMouseEvt);
        // spawn walls
        this.spawnWalls();
        // spawn level
        this.spawnLevel(this.level);
        // start timer
        this.startTimer();
        this.ballTicker = new Timer({ ttl: 0, loop: true, cb: this.onBallTick });
        this.paddleTicker;
    }

    /**
     * Stop is called by the state manager when a state is transitioning from started to an inactive state.
     * Event handlers should be disabled here.
     */
    async stop() {
        await super.stop();
        // disable event handlers
        EvtSystem.ignore(this.gctx, this, 'key.down');
        EvtSystem.ignore(this.gctx, this, 'key.up');
        EvtSystem.ignore(this.gctx, this, 'mouse.moved');
        // destroy the UI
        this.cvs.destroy();
        // stop any timers
        this.ballTicker.destroy();
        if (this.paddleTicker) this.paddleTicker.destroy();
    }

    // EVENT HANDLERS ------------------------------------------------------
    /**
     * onKeyEvt is called whenever a key is pressed by the user
     * @param {*} evt - An instance of the Evt class which includes information about the event, including tag, actor, and event specific details
     */
    onKeyEvt(evt) {
        // only act when the left or right arrow keys are pressed
        if (evt.key !== 'ArrowLeft' && evt.key !== 'ArrowRight') return;
        // when an arrow key is pressed down, move the paddle
        if (evt.tag === 'key.down') {
            if (this.paddleTicker) this.paddleTicker.destroy();
            // set up a timer to handle updates to the paddle value.  The timer is setup to tick every frame (ttl: 0) and is set to loop
            // which means it will trigger until it is explicitly stopped/destroyed.  The callback function uses the elapsed time from 
            // the timer event to calculate the delta to the paddle value
            this.paddleTicker = new Timer({ttl: 0, loop: true, cb: (data) => {
                let delta = ((evt.key === 'ArrowLeft') ? -this.constructor.paddleSpeed : this.constructor.paddleSpeed) * data.elapsed;
                this.paddle.value = this.paddle.value + delta;
            }});
        // when an arrow key is released (and no other arrow key is pressed, stop the paddle)
        } else {
            // standard game systems are stored under the gizmo context->game>systems for every gizmo object
            let keySys = this.gctx.game.systems.get('keys');
            // the key system tracks which keys are currently pressed
            // don't kill the timer on key up if one of the arrow keys is still being pressed
            if (!keySys.pressed.has('ArrowLeft') && !keySys.pressed.has('ArrowRight') && this.paddleTicker) this.paddleTicker.destroy();
        }
    }

    /**
     * onMouseEvt is called whenever the mouse is moved
     * @param {*} evt - An instance of the Evt class which includes information about the event, including tag, actor, and event specific details
     */
    onMouseEvt(evt) {
        // all UI elements track whether or not the mouse is currently over the element.  Skip calculations if the mouse isn't over the playground.
        if (!this.playground.mouseOver) return;
        // get mouse position local to playground
        let localPos = this.playground.xform.getLocal(new Vect(evt.x, evt.y));
        // translate local position to paddle value
        let value = Mathf.clamp(Mathf.lerp( this.paddle.xform.width/2, this.playground.xform.width-this.paddle.xform.width/2, 0, 1, localPos.x), 0, 1);
        this.paddle.value = value;
    }

    /**
     * onBallTick is the callback function to the ball timer.  This is the heart of gameplay where ball movement and collisions are handled
     * @param {*} data - An object storing timer state, including elapsed time.
     */
    onBallTick(data) {
        // iterate through each ball
        for (const ball of this.balls) {
            // calculate wanted position based on speed/angle
            let dx = Math.cos(ball.angle) * ball.speed * data.elapsed;
            let dy = Math.sin(ball.angle) * ball.speed * data.elapsed;
            let wantx = ball.xform.x + dx;
            let wanty = ball.xform.y + dy;
            // detect collisions
            let radius = ball.xform.width/2;
            let collided = false;
            let wantAngle = ball.angle;
            // -- paddle
            let ballBounds = new Bounds(wantx+ball.xform.minx, wanty+ball.xform.miny, ball.xform.width, ball.xform.height);
            if (ballBounds.overlaps(this.paddle.bounds)) {
                if (!ball.colliding) {
                    collided = 'paddle';
                    ball.colliding = true;
                    let intersection = ballBounds.intersects(this.paddle.bounds);
                    if (intersection) {
                        SfxSystem.playSfx(this, 'paddle.hit');
                        if (intersection.width >= intersection.height) {
                            // *tilt* paddle based on distance from center
                            let tilt = Mathf.lerp(this.paddle.bounds.minx, this.paddle.bounds.maxx, Math.PI*1.3, Math.PI*1.7, intersection.midx);
                            let nx = Math.cos(tilt);
                            let ny = Math.sin(tilt);
                            let dot = nx*dx+ny*dy
                            let vnewx = dx - 2 * dot * nx;
                            let vnewy = dy - 2 * dot * ny;
                            wantAngle = Math.atan2(vnewy, vnewx);
                        } else {
                            wantAngle = Math.PI-ball.angle;
                        }
                    }
                }
            } else {
                ball.colliding = false;
            }
            // -- left side
            if (wantx - radius <= this.leftEdge) {
                for (const wall of this.walls) {
                    if (wall.bounds.overlaps(ballBounds)) wall.hit();
                }
                wantAngle = Math.PI-ball.angle;
                collided = 'left';
            // -- right side
            } else if (wantx + radius >= this.rightEdge) {
                for (const wall of this.walls) {
                    if (wall.bounds.overlaps(ballBounds)) wall.hit();
                }
                wantAngle = Math.PI-ball.angle;
                collided = 'right';
            }
            // -- top side
            if (wanty - radius <= this.topEdge) {
                for (const wall of this.walls) {
                    if (wall.bounds.overlaps(ballBounds)) wall.hit();
                }
                wantAngle = Math.PI*2-ball.angle;
                collided = 'top';
            // -- bottom side
            } else if (wanty + radius >= this.bottomEdge) {
                this.lostBall(ball);
                return;
            }
            // -- bricks
            for (const brick of this.bricks) {
                let intersection = ballBounds.intersects(brick.bounds);
                if (intersection) {
                    collided = 'brick';
                    if (intersection.width >= intersection.height) {
                        wantAngle = Math.PI*2-ball.angle;
                    } else {
                        wantAngle = Math.PI-ball.angle;
                    }
                    brick.hit();
                }
            }
            if (collided) {
                // angle normalization and sanity checks (avoid severe horizontal angles)
                wantAngle = (wantAngle+Math.PI*2) % (Math.PI*2);
                if (wantAngle>=0 && wantAngle < Math.PI/18) wantAngle = Math.PI/18;
                if (wantAngle<=Math.PI*2 && wantAngle > Math.PI*2-Math.PI/18) wantAngle = Math.PI*2-Math.PI/18;
                if (wantAngle<=Math.PI && wantAngle > Math.PI-Math.PI/18) wantAngle = Math.PI-Math.PI/18;
                if (wantAngle>Math.PI && wantAngle < Math.PI+Math.PI/18) wantAngle = Math.PI+Math.PI/18;
                ball.angle = wantAngle;
            } else {
                ball.xform.x += dx;
                ball.xform.y += dy;
            }
        }
    }

    /**
     * onBrickDestroyed is called whenever a brick has been destroyed.
     * @param {*} evt - An instance of the Evt class which includes information about the event, including tag, actor, and event specific details
     */
    onBrickDestroyed(evt) {
        if (this.gameover) return;
        let brick = evt.actor;
        // remove brick from list of tracked bricks
        let idx = this.bricks.indexOf(brick);
        if (idx !== -1) {
            this.bricks.splice(idx, 1);
            this.incrementScore(brick.score);
        }
        // when a brick is destroyed, check to see if there are any bricks left
        if (this.bricks.length === 0) {
            this.handleLevelComplete();
        }
    }

    // OTHER METHODS -------------------------------------------------------
    /**
     * startTimer starts and manages the on-screen timer which counts down prior to spawning the ball
     */
    startTimer() {
        // find the UI timer and make it visible
        let uitimer = Hierarchy.find(this.cvs, (v) => v.tag === 'timer');
        uitimer.visible = true;
        // keep track of number of ticks on the timer
        let tick = 3;
        // update the UI text for the timer
        uitimer.text = tick.toString();
        // create the tick timer, to tick off every second, the timer loops and is stopped by the callback based on the number of ticks
        let timer;
        timer = new Timer({ttl: 1000, loop: true, cb: (data) => {
            tick--;
            // timer has ticks left...
            if (tick > 0) {
                SfxSystem.playSfx(this, 'blip');
                uitimer.text = tick.toString();
            // when ticks hits zero, spawn the ball, stop the timer
            } else {
                SfxSystem.playSfx(this, 'spawn.ball');
                timer.destroy();
                uitimer.visible = false;
                this.spawnBall();
            }
        }});
    }

    /**
     * spawnBall creates a new ball instance
     */
    spawnBall() {
        // calculate ball properties based on playground dimensions
        let radius = Math.round(this.playground.xform.width * this.constructor.ballRadiusPct);
        let buffer = Math.round(this.playground.xform.width * this.constructor.ballSpawnBufferPct);
        // ball is spawned at random x location, fixed y location
        let x = Random.rangeInt(buffer+radius, this.playground.xform.width-(radius+buffer));
        let y = Math.round(this.playground.xform.height*this.constructor.ballSpawnYPct);
        // angle is a random angle within range pointing down
        let angle = Random.range(Math.PI*.35, Math.PI*.65);
        // speed is scaled based on playground dimensions
        let speed = this.constructor.ballSpeed * this.scale;
        // finally create the ball, add it to the list of tracked balls
        let ball = new Ball({
            xform: new XForm({ left: 0, right: 1, top: 0, bottom: 1, fixedWidth: radius*2, fixedHeight: radius*2, x: x, y: y }),
            speed: speed,
            angle: angle,
        });
        this.balls.push(ball);
        // the ball is finally adopted by the playground.  For UI elements to be rendered, they must be attached to a hierarchy rooted to an active canvas.
        Hierarchy.adopt(this.playground, ball);
    }

    /**
     * spawnWalls creates the wall objects
     */
    spawnWalls(idx) {
        // top
        let width = this.playground.xform.width/6;
        let height = this.playground.xform.height/30;
        for (let i=0; i<6; i++) {
            let x = width*i;
            let y = 0;
            let wall = new Wall({
                xform: new XForm({ origx: 0, origy: 0, left: 0, right: 1, top: 0, bottom: 1, fixedWidth: width, fixedHeight: height, x: x, y: y }),
            });
            this.walls.push(wall);
            // the wall is adopted by the playground.  For UI elements to be rendered, they must be attached to a hierarchy rooted to an active canvas.
            Hierarchy.adopt(this.playground, wall);
        }

        // left/right
        width = this.playground.xform.width/24;
        let offset = this.playground.xform.height/30;
        height = width*4;
        for (let i=0; i<8; i++) {
            let x = 0;
            let y = offset + height*i;
            // left
            let wall = new Wall({
                xform: new XForm({ origx: 0, origy: 0, left: 0, right: 1, top: 0, bottom: 1, fixedWidth: width, fixedHeight: height, x: 0, y: y }),
            });
            this.walls.push(wall);
            Hierarchy.adopt(this.playground, wall);
            // right
            wall = new Wall({
                xform: new XForm({ origx: 0, origy: 0, left: 0, right: 1, top: 0, bottom: 1, fixedWidth: width, fixedHeight: height, x: width*23, y: y }),
            });
            this.walls.push(wall);
            // the wall is adopted by the playground.  For UI elements to be rendered, they must be attached to a hierarchy rooted to an active canvas.
            Hierarchy.adopt(this.playground, wall);
        }
    }

    /**
     * spawnBrick creates a new brick object at given column/row position with specified number of hits allowed
     * @param {*} col -- column index
     * @param {*} row -- row index
     * @param {*} hits -- number of hits brick is allowed
     */
    spawnBrick(col, row, hits) {
        // calculate the overall area for bricks within playground
        let brickArea = new Bounds(
            Math.round(this.playground.xform.width*this.constructor.brickLeftPct),
            Math.round(this.playground.xform.height*this.constructor.brickTopPct),
            Math.round(this.playground.xform.width*((1-this.constructor.brickRightPct)-this.constructor.brickLeftPct)),
            Math.round(this.playground.xform.height*((1-this.constructor.brickBottomPct)-this.constructor.brickTopPct)),
        );
        // calculate individual brick size and position
        let brickWidth = brickArea.width/this.constructor.maxCols;
        let brickHeight = brickArea.height/this.constructor.maxRows;
        let x = brickArea.x+brickWidth*col;
        let y = brickArea.y+brickHeight*row;
        // spawn the brick
        let brick = new Brick({
            sketch: Generator.generate(this.assets.get(`brick.${hits}`)),
            xform: new XForm({ origx: 0, origy: 0, left: 0, right: 1, top: 0, bottom: 1, fixedWidth: brickWidth, fixedHeight: brickHeight, x: x, y: y }),
            score: hits*100,
            hits: hits,
        });
        // listen for bricks being destroyed
        EvtSystem.listen(brick, this, 'gizmo.destroyed', this.onBrickDestroyed)
        this.bricks.push(brick);
        // the brick is adopted by the playground.  For UI elements to be rendered, they must be attached to a hierarchy rooted to an active canvas.
        Hierarchy.adopt(this.playground, brick);
    }

    /**
     * spawnLevel creates the bricks for the given level index
     * @param {*} idx -- index of level to spawn
     */
    spawnLevel(idx) {
        this.level = idx;
        // update UI text
        let uitext = Hierarchy.find(this.cvs, (v) => v.tag === 'level');
        uitext.text = `level: ${this.level+1}`;
        // load new level
        let level = this.constructor.levels[idx];
        for (let i=0; i<this.constructor.maxCols; i++) {
            for (let j=0; j<this.constructor.maxRows; j++) {
                let idx = i+j*this.constructor.maxCols;
                let brickTag = level[idx];
                if (!brickTag) continue;
                this.spawnBrick(i, j, brickTag);
            }
        }
    }
    
    /**
     * handleLevelComplete is called when the last brick of a level is broken.  This will either cause the next level
     * to load or the game won state to be started.
     */
    handleLevelComplete() {
        // destroy current balls
        for (const ball of this.balls) ball.destroy();
        this.balls = [];
        // check if this is the last level...
        if (this.level+1 >= this.constructor.levels.length) {
            // game won
            StateMgr.start('win', {score: this.score});
        // otherwise, spawn next level
        } else {
            new Timer({ttl: 0, cb: () => {
                this.spawnLevel(this.level+1);
                this.startTimer();
            }});
        }
    }

    /**
     * increment the score by the given value
     * @param {*} value -- value of score increment
     */
    incrementScore(value) {
        this.score += value;
        // find and update UI element keeping track of score
        let uitext = Hierarchy.find(this.cvs, (v) => v.tag === 'score');
        let text = `score: ${this.score.toString().padStart(5, "0")}`;
        uitext.text = text;
    }

    /**
     * handle when a ball is lost, triggering either loss of life or game over state
     * @param {*} ball -- the ball that was lost
     */
    lostBall(ball) {
        // remove ball from list of balls
        let idx = this.balls.indexOf(ball);
        if (idx !== -1) this.balls.splice(idx, 1);
        ball.destroy();
        // handle last ball
        if (!this.balls.length) {
            // remove a life
            this.lives--;
            let uitext = Hierarchy.find(this.cvs, (v) => v.tag === 'lives');
            let text = `lives: ${this.lives}`;
            uitext.text = text;
            // if lives remaining, start a new timer to spawn a new ball
            if (this.lives > 0) {
                this.startTimer();
            // otherwise... trigger game over state
            } else {
                this.gameover = true;
                StateMgr.start('gameover', {score: this.score});
            }
        }
    }

}


/**
 * The Breakout class extends the gizmo Game class, which provides the overall framework for managing the game assets, states, and systems.
 */
class Breakout extends Game {
    /**
     * override the Game assetSpecs to define asset specifications for this game
     * -- Each asset specification is a javascript object (or nested objects) that define properties of the asset and potentially
     * -- information on how to load the asset media resources.
     * -- the base game class handles the loading of media resources during game initialization.
     */
    static assetSpecs = [
        // Every asset specification must include information on the class of asset to be created, a tag that can be used to lookup the asset
        // specification, and any asset specific attributes.
        // -- For class information, every class derived from GizmoData has a static 'xspec' method which provides shorthand for creating an 
        //    object specification for that specific class with the provided attributes.
        // -- Tag should be unique across all assets
        // The Rect class is used for rendering rectangles.  Here a dark gray rectangle is used for the game background.
        Rect.xspec({ tag: 'bg', color: darkGray }),
        // The Sfx class is used for defining sound effects.
        // -- volume is used to reduce the volume of this specific sound effect when played.
        // -- audio is used to define the sound effect media.  The 'SfxRef' class is a media reference class that defines that audio data should
        //    be loaded from the specified file.  When assets are loaded by the game, this media reference is replaced in the asset specification 
        //    with the actual data that was loaded.
        Sfx.xspec({ tag: 'spawn.ball', volume: .2, audio: new SfxRef({src: 'spawnBall.wav'}) }),
        Sfx.xspec({ tag: 'lost.ball', volume: .2, audio: new SfxRef({src: 'lostBall.wav'}) }),
        Sfx.xspec({ tag: 'wall.hit', volume: .2, audio: new SfxRef({src: 'wallHit.wav'}) }),
        Sfx.xspec({ tag: 'brick.hit', volume: .2, audio: new SfxRef({src: 'brickHit.wav'}) }),
        Sfx.xspec({ tag: 'brick.destroyed', volume: .2, audio: new SfxRef({src: 'brickDestroyed.wav'}) }),
        Sfx.xspec({ tag: 'paddle.hit', volume: .2, audio: new SfxRef({src: 'paddleHit.wav'}) }),
        Sfx.xspec({ tag: 'blip', volume: .2, audio: new SfxRef({src: 'blip.wav'}) }),
        // The Sprite class is used for rendering a single image to the screen.
        // -- img is used define the HTML image element.  Here 'SheetRef' is another media reference class that defines how to load the HTML
        //    image element from the specified file.  It is treating the source image file as a sprite sheet, and is loading a specific
        //    image from the sheet for this 'brick.1' asset based on specified dimensions and position within the sprite sheet.
        Sprite.xspec({tag: 'brick.1', img: new SheetRef({src: 'bricks.png', width: 32, height: 16, x: 16*3, y: 16*4}) }),
        Sprite.xspec({tag: 'brick.2', img: new SheetRef({src: 'bricks.png', width: 32, height: 16, x: 16*5, y: 16*4}) }),
        Sprite.xspec({tag: 'brick.3', img: new SheetRef({src: 'bricks.png', width: 32, height: 16, x: 16*7, y: 16*4}) }),
        Sprite.xspec({tag: 'ball', img: new SheetRef({src: 'bricks.png', width: 16, height: 16, x: 0, y: 0}) }),
        Sprite.xspec({tag: 'paddle', img: new SheetRef({src: 'bricks.png', width: 48, height: 16, x: 16, y: 0}) }),
        // The Animator class is used for rendering an sketch to the screen based on animation state.  It is a wrapper class to other assets.
        // -- sketches is used define the mapping of animation state tags to asset specifications.
        //    'idle' is associated with a separate sprite.  While a sprite is used here, any other sketch class could also be used.
        //    'hit' is associated with a separate sprite
        //    
        Animator.xspec({tag: 'wall.v', sketches: {
            idle: Sprite.xspec({img: new SheetRef({src: 'bricks.png', width: 16, height: 64, x: 0, y: 16*3}) }),
            hit: Sprite.xspec({img: new SheetRef({src: 'bricks.png', width: 16, height: 64, x: 16, y: 16*3}) }),
        }}),
        Animator.xspec({tag: 'wall.h', sketches: {
            idle: Sprite.xspec({img: new SheetRef({src: 'bricks.png', width: 64, height: 16, x: 0, y: 16*2}) }),
            hit: Sprite.xspec({img: new SheetRef({src: 'bricks.png', width: 64, height: 16, x: 64, y: 16}) }),
        }}),
    ];

    /**
     * As with game states, the prepare method is called when the game starts and is used to setup game specific logic.
     */
    async prepare() {
        // create the game states.  the game state manager automatically starts tracking the game states when they are created.
        new TitleState({ tag: 'title' });
        new PlayState({ tag: 'play' });
        new GameOverState({ tag: 'gameover' });
        new WinState({ tag: 'win' });
        // trigger the game state manager to start the 'title' state
        StateMgr.start('title');
    }
}

/** ========================================================================
 * start the game when page is loaded
 */
window.onload = async function() {
    // start the game
    let game = new Breakout();
    game.start();
}
