import "./style.css";
import { fromEvent, merge, interval } from "rxjs";
import { map, filter, scan, repeatWhen, takeWhile } from "rxjs/operators";

function main() {
  /**
   * Inside this function you will use the classes and functions from rx.js
   * to add visuals to the svg element in pong.html, animate them, and make them interactive.
   *
   * Study and complete the tasks in observable examples first to get ideas.
   *
   * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
   *
   * You will be marked on your functional programming style
   * as well as the functionality that you implement.
   *
   * Document your code!
   */

  const CONSTANTS = {
    ZERO: 0,
    DEFAULT_LIVES: 5,
    CANVAS_WIDTH: 600,
    CANVAS_HEIGHT: 600,
    SPACE_FROM_EDGE: 5,
    DEFAULT_ENTITY_WIDTH: 50,
    DEFAULT_ENTITY_HEIGHT: 50,
    TICK_RATE: 10,
    CONFUSED_TIMER: 250, // 2.5 seconds when confused
    DEATH_TIMER: 200, // To show on death
    DEFAULT_CONFUSED_TIMER: 0,
    DIFFICULTY_MULTIPLIER: 1.1,

    FROG_MAP_BORDER_MIN: 5,
    FROG_MAP_BORDER_MAX: 545,

    FROG_INITIAL_X: 305,
    FROG_INITIAL_Y: 545,
    FROG_IMAGE: '../src/assets/frog1.png',
    FROG_SPEED: 60,

    SPACE_BETWEEN_UFO: 130,
    UFO_IMAGE: '../src/assets/alien_ufo.png',
    UFO_SPEED: 0.8,

    SPACE_BETWEEN_GHOST: 150,
    GHOST_IMAGE: '../src/assets/ghost.svg',
    GHOST_SPEED: 0.5,

    SPACE_BETWEEN_SNAIL: 100,
    SNAIL_IMAGE: '../src/assets/snail.png',
    SNAIL_SPEED: 3,

    SPACE_BETWEEN_LOGROW1: 90,
    SPACE_BETWEEN_LOGROW2: 120,
    SPACE_BETWEEN_LOGROW3: 80,
    SPACE_BETWEEN_LOGROW4: 200,
    LOG_INITIAL_X: 0,
    LOG_INITIAL_Y: 0,
    LOG_IMAGE: '../src/assets/log.png',
    LOG_SPEED: 0.5,

    RIVER_ZONE_Y: 60,
    RIVER_ZONE_HEIGHT: 240,

    SPACE_BETWEEN_CROWN: 70,
    CROWN_IMAGE: '../src/assets/crown.svg',
  } as const;

  type EntityProperties = Readonly<{
    img: string;
    speed: number;
    width: number;
    height: number;
  }>;

  type Zone = Readonly<{
    id: string,
    x: number;
    y: number;
    width: number;
    height: number;
  }>;

  interface Entity extends EntityProperties {
    id: string;
    x: number;
    y: number;
  }

  type State = Readonly<{
    time: number,
    frog: Entity;
    ufos: Entity[];
    ghosts: Entity[];
    snails: Entity[];
    logRow1: Entity[];
    logRow2: Entity[];
    logRow3: Entity[];
    logRow4: Entity[];
    isConfused: boolean;
    isConfusedTimer: number;
    gameOver: boolean;
    riverZone: Zone;
    crowns: Entity[];
    crownsTaken: Entity[];
    highscore: number;
    lives: number;
    deathTimer: number;
  }>;

  type Key = 'w' | 'a' | 's' | 'd';
  type RKey = 'r';
  type Event = 'keydown';

  // Types of game state transitions
  class Tick { constructor(public readonly elapsed: number) { } }
  class Movement { constructor(public readonly key: Key) { } }
  class Restart { constructor(public readonly key: RKey) { }}


  const frog: Entity = {
    id: "frog",
    x: CONSTANTS.FROG_INITIAL_X,
    y: CONSTANTS.FROG_INITIAL_Y,
    width: CONSTANTS.DEFAULT_ENTITY_WIDTH,
    height: CONSTANTS.DEFAULT_ENTITY_HEIGHT,
    img: CONSTANTS.FROG_IMAGE,
    speed: CONSTANTS.FROG_SPEED,
  };

  const ufo: Entity = {
    id: "ufo", // will be appended with a number
    x: CONSTANTS.ZERO,
    y: CONSTANTS.ZERO,
    width: CONSTANTS.DEFAULT_ENTITY_WIDTH,
    height: CONSTANTS.DEFAULT_ENTITY_HEIGHT,
    img: CONSTANTS.UFO_IMAGE,
    speed: CONSTANTS.UFO_SPEED,
  };

  const ghost: Entity = {
    id: "ghost", // will be appended with a number
    x: CONSTANTS.ZERO,
    y: CONSTANTS.ZERO,
    width: CONSTANTS.DEFAULT_ENTITY_WIDTH,
    height: CONSTANTS.DEFAULT_ENTITY_HEIGHT,
    img: CONSTANTS.GHOST_IMAGE,
    speed: -CONSTANTS.GHOST_SPEED,
  };

  const snail: Entity = {
    id: "snail",
    x: CONSTANTS.ZERO,
    y: CONSTANTS.ZERO,
    width: CONSTANTS.DEFAULT_ENTITY_WIDTH,
    height: CONSTANTS.DEFAULT_ENTITY_HEIGHT,
    img: CONSTANTS.SNAIL_IMAGE,
    speed: -CONSTANTS.SNAIL_SPEED,
  };

  const log: Entity = {
    id: "log",
    x: CONSTANTS.ZERO,
    y: CONSTANTS.ZERO,
    width: CONSTANTS.DEFAULT_ENTITY_WIDTH,
    height: CONSTANTS.DEFAULT_ENTITY_HEIGHT,
    img: CONSTANTS.LOG_IMAGE,
    speed: CONSTANTS.LOG_SPEED,
  };

  const crown: Entity = {
    id: "crown",
    x: CONSTANTS.ZERO,
    y: CONSTANTS.ZERO,
    width: CONSTANTS.DEFAULT_ENTITY_WIDTH,
    height: CONSTANTS.DEFAULT_ENTITY_HEIGHT,
    img: CONSTANTS.CROWN_IMAGE,
    speed: CONSTANTS.ZERO,
  };

  const 
    logRow1: Entity = { ...log, id: "logRow1", width: 150, height: 50, speed: -0.5 },
    logRow2: Entity = { ...log, id: "logRow2", width: 130, height: 50, speed: 1 },
    logRow3: Entity = { ...log, id: "logRow3", width: 110, height: 50, speed: -0.3 },
    logRow4: Entity = { ...log, id: "logRow4", width: 120, height: 50, speed: 0.5 };

  
  // Zone (An area of the map)
  const riverZone: Zone = {
    id: "riverZone",
    x: CONSTANTS.ZERO,
    y: CONSTANTS.RIVER_ZONE_Y,
    width: CONSTANTS.CANVAS_WIDTH,
    height: CONSTANTS.RIVER_ZONE_HEIGHT
  };
  

  ///////////////////////////////////////////////////////////////////////
  // Utility Functions
  ///////////////////////////////////////////////////////////////////////

  // Curried function takes in an entity and returns a function that takes in a 
  // specified number of entities to be created and returns an array of entities.
  const createEntityRow = (entityType: Entity) => {
    // To get the space between different entities.
    const 
      SPACE_BETWEEN_KEY = 'SPACE_BETWEEN_' + entityType.id.toUpperCase() as 
        keyof typeof CONSTANTS,
      SPACE_BETWEEN = CONSTANTS[SPACE_BETWEEN_KEY];

    // Auxliary function gets called recursively.
    // Uses tail recursion optimization.
    const createEntityRowAux = (
      numberOfEntities: number,
      y_pos: number,
      entities: Entity[] = []): Entity[] => {

      if (numberOfEntities === 0) {
        return entities;
      } else {
        const entity = {
          ...entityType,
          id: entityType.id + numberOfEntities,
          x: (numberOfEntities - 1) * (SPACE_BETWEEN as number + entityType.width),
          y: y_pos,
        }
        return createEntityRowAux(numberOfEntities - 1, y_pos, [...entities, entity]);
      }
    }
    return createEntityRowAux;
  }

  const 
    createUfoRow = createEntityRow(ufo),
    createGhostRow = createEntityRow(ghost),
    createSnailRow = createEntityRow(snail),
    createLogRow1 = createEntityRow(logRow1),
    createLogRow2 = createEntityRow(logRow2),
    createLogRow3 = createEntityRow(logRow3),
    createLogRow4 = createEntityRow(logRow4),
    createCrownRow = createEntityRow(crown);


  // Checks if the frog is colliding with given entity
  const isColliding = (frog: Entity) => (entity: Entity | Zone): Boolean => {
    const
      frogRight = frog.x + frog.width,
      frogBottom = frog.y + frog.height,
      entityRight = entity.x + entity.width,
      entityBottom = entity.y + entity.height;

    // To check if center of frog is within the entity.
    // To avoid the frog from appearing to have more than half of its body
    // floating in the water.
    if (entity !== undefined && entity.id.slice(0, 3) === 'log') {
      return !(
        frog.x + frog.width / 2 < entity.x 
        || frog.x + frog.width / 2 > entityRight
        || frogBottom < entity.y
        || frog.y > entityBottom
      );
    }
    // To simply check if any part of the entity's box is within the frog's box.
    else {
      return !(
        frogRight < entity.x ||
        frog.x > entityRight ||
        frogBottom < entity.y ||
        frog.y > entityBottom
      );
    }
  }


  const swapKey = (key: Key, isConfused: boolean): Key => {
    if (isConfused) {
      switch (key) {
        case 'w': return 's';
        case 'a': return 'd';
        case 's': return 'w';
        case 'd': return 'a';
      }
    }
    return key;
  }

  // Identity function
  const identity = <T>(x: T): T => x;

  ///////////////////////////////////////////////////////////////////////
  // Game State
  ///////////////////////////////////////////////////////////////////////

  const initialState: State = {
    time: 0,
    frog: frog,
    ufos: createUfoRow(4, 425),
    ghosts: createGhostRow(3, 485),
    snails: createSnailRow(1, 365),
    logRow1: createLogRow1(2, 65),
    logRow2: createLogRow2(2, 125),
    logRow3: createLogRow3(4, 185),
    logRow4: createLogRow4(2, 245),
    gameOver: false,
    isConfused: false,
    isConfusedTimer: CONSTANTS.DEFAULT_CONFUSED_TIMER,
    riverZone: riverZone,
    crowns: createCrownRow(5, 5),
    crownsTaken: <Entity[]>[],
    highscore: CONSTANTS.ZERO,
    lives: CONSTANTS.DEFAULT_LIVES,
    deathTimer: CONSTANTS.ZERO,
  };


  // Moves the all automated entities (Non-Frog) in the game.
  // Checks if the frog is colliding with any of the entities.
  // Then returns the new state.
  const tick = (state: State, elapsed: number): State => {
    return checkCollisions({
      ...state,
      time: elapsed,
      ufos: state.ufos.map(moveEntity),       // right
      ghosts: state.ghosts.map(moveEntity),   // left
      snails: state.snails.map(moveEntity),   // left
      logRow1: state.logRow1.map(moveEntity), // left
      logRow2: state.logRow2.map(moveEntity), // right
      logRow3: state.logRow3.map(moveEntity), // left
      logRow4: state.logRow4.map(moveEntity), // right
      crowns: state.crowns.map(identity),     // stationary
    });
  };

  // All automated movement of entities except frog is done here.
  const moveEntity = (entity: Entity): Entity => {
    const { CANVAS_WIDTH } = CONSTANTS,
      { width } = entity,
      // Wraps the right side of the canvas to the left side.
      wrapLeft = (x: number) => x < 0 
        ? x + entity.speed 
        : x > CANVAS_WIDTH 
          ? -width
          : x + entity.speed,
      
      // Wraps the left side of the canvas to the right side.
      wrapRight = (x: number) => x > 0
        ? x + entity.speed
        : x < -width
          ? CANVAS_WIDTH
          : x + entity.speed;

    return <Entity> {
      ...entity,
      x: entity.speed < 0 ? wrapRight(entity.x) : wrapLeft(entity.x),
    }
  };

  // Updates the frog's state for when it sits on a log.
  const moveFrogOnLog = (frog: Entity, log: Entity): Entity => {
    return <Entity> {
      ...frog,
      x: frog.x + log.speed,
    }
  };

  // Checks if frog fell into the river or not.
  const isFrogInRiver = (
    logsCollided: Entity[], 
    riverZoneCollided: Zone[]): Boolean => {
    return (riverZoneCollided.length > 0 && logsCollided.length === 0)
  }

  // Checks if frog got swept away by logs out of map boundaries or not.
  const isFrogOutOfBounds = (frog: Entity): Boolean => {
    return (frog.x + frog.width / 2 < 0
      || frog.x + frog.width / 2 > CONSTANTS.CANVAS_WIDTH);
  };
  
  // Increase difficulty by increasing speed of entities by 10%.
  const increaseDifficulty = (state: State): State => {
    return <State> {
      ...state,
      ufos: state.ufos.map(increaseSpeed),
      ghosts: state.ghosts.map(increaseSpeed),
      snails: state.snails.map(increaseSpeed),
      logRow1: state.logRow1.map(increaseSpeed),
      logRow2: state.logRow2.map(increaseSpeed),
      logRow3: state.logRow3.map(increaseSpeed),
      logRow4: state.logRow4.map(increaseSpeed),
    }
  };

  // Increases the speed of the entity by 10%.
  const increaseSpeed = (entity: Entity): Entity => {
    return <Entity> {
      ...entity,
      speed: entity.speed * CONSTANTS.DIFFICULTY_MULTIPLIER,
    }
  };


  // Checks state for collisions between frog and entities.
  // Returns the new state after accounting for collisions.
  const checkCollisions = (state: State): State => {
    const { 
      frog, ufos, ghosts, snails, 
      logRow1, logRow2, logRow3, logRow4,
      riverZone,
      lives, crownsTaken, crowns
    } = state,

      // Lists of entities that the frog is colliding with.
      ufosCollided = ufos.filter(isColliding(frog)),
      ghostsCollided = ghosts.filter(isColliding(frog)),
      snailsCollided = snails.filter(isColliding(frog)),
      logRow1Collided = logRow1.filter(isColliding(frog)),
      logRow2Collided = logRow2.filter(isColliding(frog)),
      logRow3Collided = logRow3.filter(isColliding(frog)),
      logRow4Collided = logRow4.filter(isColliding(frog)),
      riverZoneCollided = [riverZone].filter(isColliding(frog)),
      crownsCollided = state.crowns.filter(isColliding(frog)),
      crownsRemaining = state.crowns.filter((crown) => !isColliding(frog)(crown)),

      // List of entities that would kill frog on collision.
      enemiesCollided = [...ufosCollided, ...snailsCollided],


      // List of entities (logs) that the frog is riding on.
      logsCollided = [
        ...logRow1Collided, 
        ...logRow2Collided, 
        ...logRow3Collided, 
        ...logRow4Collided
      ],

      frogDies = (enemiesCollided.length > 0 
        || isFrogInRiver(logsCollided, riverZoneCollided)
        || isFrogOutOfBounds(frog)),
      
      frogLandsOnCrown = crownsCollided.length > 0;

      // If frog is colliding with any enemies, reset frog to starting position
      // and decrement lives. Restores all crowns to the map.
      if (frogDies) {
        return <State> {
          ...state,
          frog: <Entity> {
            ...frog,
            x: CONSTANTS.FROG_INITIAL_X,
            y: CONSTANTS.FROG_INITIAL_Y,
          },
          lives: lives - 1,
          deathTimer: CONSTANTS.DEATH_TIMER,
          crowns: [...crowns, ...crownsCollided, ...crownsTaken],
          crownsTaken: [],
        }
      }
      // If frog lands on a crown, reset frog to starting position.
      else if (frogLandsOnCrown) {
        return <State> increaseDifficulty({
          ...state,
          frog: <Entity> {
            ...frog,
            x: CONSTANTS.FROG_INITIAL_X,
            y: CONSTANTS.FROG_INITIAL_Y,
          },
          crowns: crownsRemaining,
          crownsTaken: [...crownsTaken, ...crownsCollided],
        })
      }

      
    

    return <State> {
      ...state,
      frog: logsCollided.length > 0 ? moveFrogOnLog(frog, logsCollided[0]) : frog,
      gameOver: lives === 0,
      isConfused: ghostsCollided.length > 0,
      isConfusedTimer: state.isConfused 
        ? CONSTANTS.CONFUSED_TIMER
        : Math.max(0, state.isConfusedTimer - 1), 
      isFrogOnLog: logsCollided.length > 0,
      crowns: crownsRemaining,
      crownsTaken: [...crownsTaken, ...crownsCollided],
      highscore: Math.max(state.highscore, state.crownsTaken.length * 50),
      deathTimer: state.deathTimer - 1
    }
  };

  // Observable ticks every 10ms.
  const gameClock = interval(CONSTANTS.TICK_RATE)
    .pipe(map(elapsed => new Tick(elapsed)));

  // Observable that emits key presses.
  const keyObservable = <T>(e: Event, key: Key | RKey, result: () => T) => {
    return fromEvent<KeyboardEvent>(document, e)
      .pipe(
        filter((e: KeyboardEvent) => e.key === key),
        map(result)
      );
  };
  
  // Observables for w, a, s, d keys.
  const
    moveLeftKey$ = keyObservable('keydown', 'a', () => new Movement('a')),
    moveRightKey$ = keyObservable('keydown', 'd', () => new Movement('d')),
    moveUpKey$ = keyObservable('keydown', 'w', () => new Movement('w')),
    moveDownKey$ = keyObservable('keydown', 's', () => new Movement('s')),
    // Observable to listen to restart button r.
    restartKey$ = keyObservable('keydown', 'r', () => new Restart('r'));


  // Updates the frog's position based on the key pressed.
  // Takes in the current state and key, then returns the new Entity.
  // If frog is confused, keys are swapped. (Eg. w -> s, a -> d, etc.)
  const updateFrogState = (state: State, key: Key): Entity => {
    const 
      { frog, isConfusedTimer } = state,
      { FROG_MAP_BORDER_MIN, FROG_MAP_BORDER_MAX } = CONSTANTS,

      cKey = swapKey(key, isConfusedTimer > 0),

      // A dictionary of functions that returns the new x and y coordinates of the frog
      // based on the key pressed.
      movementDict = {
        'w': () => Math.max(frog.y - frog.speed, FROG_MAP_BORDER_MIN),
        'a': () => Math.max(frog.x - frog.speed, FROG_MAP_BORDER_MIN),
        's': () => Math.min(frog.y + frog.speed, FROG_MAP_BORDER_MAX),
        'd': () => Math.min(frog.x + frog.speed, FROG_MAP_BORDER_MAX)
      };

    // Return the new state of frog with updated position of the frog.
    return <Entity> {
      ...frog,
      x: cKey === 'a' || cKey === 'd' ? movementDict[cKey]() : frog.x,
      y: cKey === 'w' || cKey === 's' ? movementDict[cKey]() : frog.y,
    }
  };

  // State transducer
  const reduceState = (state: State, event: Movement | Tick): State => {
    // Updates the game clock's state then returns the new state of the game.
    if (event instanceof Tick) {
      return tick(state, event.elapsed);
    } 
    // Updates frog state then returns new state of the game.
    else if (event instanceof Movement) {
      return <State> {
        ...state,
        frog: updateFrogState(state, event.key),
      }
    } 
    // Returns current state.
    else {
      return state;
    }
  };
    
  ///////////////////////////////////////////////////////////////////////
  // Main game stream
  ///////////////////////////////////////////////////////////////////////

  // Repeats when user clicks on the restart button (r).
  const subscription =
    merge(
      gameClock,
      moveLeftKey$, moveDownKey$, moveUpKey$, moveRightKey$,
    )
    .pipe(
      scan(reduceState, initialState),
      takeWhile(state => !state.gameOver),
      repeatWhen(() => restartKey$),
    )
    .subscribe(updateView);
  

  ///////////////////////////////////////////////////////////////////////
  // Updates the canvas
  // This is the only impure function in this game.
  ///////////////////////////////////////////////////////////////////////
  function updateView (state: State): void {
    const 
      svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement,

      // Updates the position of entities on the canvas.
      updateEntityView = (entity: Entity) => {
        function createEntityView(entity: Entity): Element {
          const entityElement = document.createElementNS(svg.namespaceURI, 'image');
          entityElement.setAttribute("id", entity.id);
          entityElement.setAttribute("x", String(entity.x));
          entityElement.setAttribute("y", String(entity.y));
          entityElement.setAttribute("width", String(entity.width));
          entityElement.setAttribute("height", String(entity.height));
          entityElement.setAttribute("href", entity.img);
          return svg.appendChild(entityElement);
        }

        // If the entity is not in the DOM, create it.
        const view = document.getElementById(entity.id);
        if (view === null) {
          createEntityView(entity);
        }
        // If the entity is in the DOM, update its position.
        else {
          view.setAttribute("x", String(entity.x));
          view.setAttribute("y", String(entity.y));
        }
      },
    
      // Removes entities from the DOM.
      removeEntityView = (entity: Entity) => {
        const view = document.getElementById(entity.id);
        if (view !== null) {
          view.remove();
        }
      },

      // Updates highscore, lives counter, and death notification.
      updateCounterViews = (value: number, type: string) => {
        const valueElement = document.getElementById(type)!;
        if (type === 'highscore') {
          valueElement.textContent = "Highscore: " + String(value);
        }
        else if (type === 'lives') {
          valueElement.textContent = "Lives: " + String(value);
        }
        else if (value > 0 && type === 'death') {
          valueElement.textContent = "You died!";
        }
        else if (value === 0 && type === 'death') {
          valueElement.textContent = "";
        }
        else if (value === 0 && type === 'gameover') {
          valueElement.textContent = "Game Over! Press R to restart!";
        }
        else if (value === 1 && type === 'gameover') {
          valueElement.textContent = "";
        }
      },

      // Restarts death notification when game over
      // Shows gameover notification when game over
      restartCounters = (gameOver: boolean) => {
        if (gameOver) {
          updateCounterViews(0, 'death');
          updateCounterViews(0, 'gameover');
        }
        else {
          updateCounterViews(1, 'gameover');
        }
      };


    // Updates the position of the entities on the canvas.
    state.ufos.map(updateEntityView);
    state.ghosts.map(updateEntityView);
    state.snails.map(updateEntityView);
    state.logRow1.map(updateEntityView);
    state.logRow2.map(updateEntityView);
    state.logRow3.map(updateEntityView);
    state.logRow4.map(updateEntityView);
    state.crowns.map(updateEntityView);
    state.crownsTaken.map(removeEntityView);
    updateCounterViews(state.highscore, 'highscore');
    updateCounterViews(state.lives, 'lives');
    updateCounterViews(state.deathTimer, 'death');
    restartCounters(state.lives === 0);
    updateEntityView(state.frog);

  }
}




// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
