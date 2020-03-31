/* eslint-disable no-console */
'use strict'

import { editor } from './editor.js'
import { playSound } from './sounds.js'
let audioInitialized = false

const smallSprite = 8
const fontSize = 24
const tileSize = 11
let wisdom = -1

class Player {
  constructor (x, y) {
    this.pos = { x, y }
    this.vel = { x: 0, y: 0 }
    this.speed = 0
    this.rot = 0
  }
}

const ents = []
let player

class Enemy {
  constructor (x, y, parentId = -1) {
    this.pos = { x, y }
    this.vel = { x: 0, y: 0 }
  }
  move () {

  }
  draw () {
    drawSprite(this.sprite, this.pos.x, this.pos.y)
  }
}

class OhSpawner extends Enemy {
  constructor (x, y) {
    super(x, y)
  }
  spawn () {
    ents.push(new OhRing(this.pos.x, this.pos.y, this.spawnerId))
  }
  move () {
    super.move()
  }
}

const camera = {
  pos: { x: 0, y: 0 }
}

const particles = []

const scale = 4
let canvas
let ctx
let spriteImage

function start () {
  canvas = document.querySelector('canvas')
  ctx = canvas.getContext('2d', { alpha: false })
  ctx.imageSmoothingEnabled = false
  const defaultFont = fontSize + "px 'uni 05_53'"
  ctx.font = defaultFont
  ctx.fillStyle = '#140C1C'
  ctx.baseLine = 'bottom'
  spriteImage = new Image()
  spriteImage.src = 'sprites.png'
  spriteImage.addEventListener('load', loaded, false)
}

function loaded () {
  tick()
}

function tick () {
  updatePlayer(player)
  updateEnts()
  updateParticles()
  draw()
  requestAnimationFrame(tick)
}

function isTouching (ent1, ent2) {
  // Very dirty hack to handle the player being smaller than other sprites.
  const dist = ent1.radius + ent2.radius
  return distance(ent1.pos, ent2.pos) < dist
}

function distance (pos1, pos2) {
  const dX = pos1.x - pos2.x
  const dY = pos1.y - pos2.y
  return Math.sqrt(dX * dX + dY * dY)
}

function spawnExplosion (pos, type = 'expRing') {
  const p = { x: pos.x, y: pos.y, age: 0, type }
  p.xVel = 0
  p.yVel = 0
  particles.push(p)
}

function hurt (ent, amount) {
  if (ent.health <= 0) return
  if (ent.immunity > 0) return
  ent.health -= amount
  if (ent.health <= 0) {
    ent.health = 0
    ent.dead = true
    if (ent.isPlayer) {
      spawnExplosion(ent.pos, 'playerDeadRing')
      playSound('playerexp')
      ent.immunity = 15
    } else {
      spawnExplosion(ent.pos, ent.deadEffect)
      playSound('exp2')
      if (ent.isSign) {
        wisdom++
      }
    }
  }
  if (ent.isPlayer) {
    player.healthBarFlashTimer = 60
  }
}

function updateShots () {
  for (let shot of shots) {
    shot.pos.x += shot.vel.x
    shot.pos.y += shot.vel.y
    shot.age++

    if (shot.hurtsPlayer) {
      if (isTouching(shot, player)) {
        hurt(player, 10)
        playSound('playerhit')
        playSound('exp')
        spawnExplosion(shot.pos)
        shot.dead = true
        continue
      }
      if (shot.age > 120) {
        spawnExplosion(shot.pos)
        shot.dead = true
        continue
      }
    } else {
      for (const ent of ents) {
        if (isTouching(shot, ent)) {
          hurt(ent, 10)
          playSound('hit2')
          spawnExplosion(shot.pos)
          shot.dead = true
          continue
        }
      }
      if (shot.age > tileSize * 3 / Math.abs(shot.vel.x)) {
        spawnExplosion(shot.pos)
        shot.dead = true
        continue
      }
    }

    const collidingTile = getCollidingTiles(shot.pos)
    if (collidingTile) {
      shot.dead = true
      spawnExplosion(shot.pos)
      if (!shot.hurtsPlayer) {
        playSound('hitwall')
        const index = getIndexFromPixels(collidingTile.x, collidingTile.y)
        console.log(collidingTile)
        console.log(index)
        world.map[index] = 0
        ents.filter(ent => ent.belowIndex === index).forEach(ent => hurt(ent, 9999))
      }
    }
  }
  filterInPlace(shots, s => !s.dead)
}

function updateEnts () {
  for (let ent of ents) {
    ent.move()
  }
  filterInPlace(ents, e => !e.dead)
}

function updateParticles () {
  for (let bit of particles) {
    const type = particleTypes[bit.type]
    bit.x += bit.xVel
    bit.y += bit.yVel
    bit.age++

    if (bit.age >= type.maxAge) {
      bit.dead = true
      if (type.spawns) {
        for (let spawns of type.spawns) {
          const amount = spawns.amount
          const newType = spawns.type
          const force = spawns.force
          for (let i = 0; i < amount; i++) {
            const p = { x: bit.x, y: bit.y, age: 0, type: newType }
            const angle = i / amount * Math.PI * 2
            p.xVel = force * Math.cos(angle)
            p.yVel = force * Math.sin(angle)
            particles.push(p)
          }
        }
      }
    }
  }

  filterInPlace(particles, bit => !bit.dead)
}

// https://stackoverflow.com/questions/37318808/what-is-the-in-place-alternative-to-array-prototype-filter
function filterInPlace (a, condition) {
  let i = 0
  let j = 0

  while (i < a.length) {
    const val = a[i]
    if (condition(val, i, a)) a[j++] = val
    i++
  }

  a.length = j
  return a
}

function draw () {
  ctx.fillStyle = "#4f0064"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  drawLevel()
  particles.forEach(p => drawParticle(p, false, true))
  drawPlayer(player)
  /*for (let i = 0; i < 1000; i++) {
    drawSprite(0, Math.random() * 10, Math.random() * 10)
  }*/
  for (let ent of ents) {
    ent.draw()
  }
}

function drawParticle (p) {
  const type = particleTypes[p.type]
  //if (p.type. === 'ring') drawCheckpoint(p, false, true)
  drawSprite(type.sprite, p.x, p.y)
}

function drawShot (s) {
  drawSprite(s.hurtsPlayer ? smallSprite : smallSprite + 1, s.pos.x, s.pos.y)
}

function drawPlayer (player) {
  let sprite = 0
  drawSprite(sprite, player.pos.x, player.pos.y, player.facingLeft, false, player.rot)

}

function drawSprite (index, x, y, flipped = false, hud = false, rot = 0) {
  let width = tileSize
  let height = tileSize
  if (!hud) {
    const camPos = camera.pos
    x = Math.floor((x - camPos.x) * scale)
    y = Math.floor((y - camPos.y) * scale)
    x += Math.floor(canvas.width / 2)
    y += Math.floor(canvas.height / 2)
  }
  ctx.translate(x, y)
  ctx.rotate(rot)
  if (flipped) ctx.scale(-1, 1)

  let sX = (index % 4) * width
  let sY = Math.floor(index / 4) * height

  // hack for small sprites
  if (index >= smallSprite) {
    const smolIndex = index - smallSprite
    width /= 2
    height /= 2
    sX = smolIndex * width
    sY = 16
  }

  ctx.drawImage(spriteImage,
    sX, sY,
    width, height,
    -width / 2 * scale, -height / 2 * scale,
    width * scale, height * scale)
  if (flipped) ctx.scale(-1, 1)
  ctx.rotate(-rot)
  ctx.translate(-x, -y)
}

const hiddenSprites = [15, 16, 17, 2, 8]

function drawLevel () {
}

function drawCheckpoint (pos, isVacant) {
  const isFast = player.isCharging
  let anim = Math.floor(frame / (isFast ? 6 : 12)) % 4
  if (anim === 3) anim = 1
  if (isVacant) return
  const sprite = 8 + anim
  drawSprite(sprite, pos.x, pos.y)
}

function updatePlayerAxis (player, axis, moreKey, lessKey, maxVel) {
  let vel = player.vel[axis]

  if (moreKey) {
    if (vel < maxVel) {
      vel += xAccel
    } else {
      vel -= Math.min(vel - maxVel, xDecel)
    }
  } else if (lessKey) {
    if (vel > -maxVel) {
      vel -= xAccel
    } else {
      vel += Math.min(-vel - maxVel, xDecel)
    }
  } else if (!lessKey && vel < 0) vel += Math.min(-vel, xDecel)
  else if (!moreKey && vel > 0) vel -= Math.min(vel, xDecel)

  player.vel[axis] = vel
}

function updatePlayer (player, isLocal) {
 
}

function spawnShot (ent) {
  if (!ent.fireMode) {
    const shot = {
      pos: { x: ent.pos.x, y: ent.pos.y },
      vel: { x: 0, y: 0 }
    }
    shot.vel.x = ent.facingLeft ? -3 : 3
    shot.hurtsPlayer = false
    shot.age = 0
    shots.push(shot)
  }
  if (ent.fireMode === 'star') {
    let points = 4
    const offset = (ent.fireSequence / 16) * Math.PI * 2 / points
    for (let i = 0; i < 5; i++) {
      const shot = {
        pos: { x: ent.pos.x, y: ent.pos.y },
        vel: { x: 0, y: 0 }
      }
      const angle = Math.PI * 2 / points * i + offset
      const force = 0.5
      shot.vel.x = Math.cos(angle) * force
      shot.vel.y = Math.sin(angle) * force
      shot.hurtsPlayer = true
      shot.age = 0
      shots.push(shot)
    }
    ent.fireSequence = (ent.fireSequence + 1) % 16
  }
}

function getDist (pos1, pos2) {
  const xDist = pos1.x - pos2.x
  const yDist = pos1.y - pos2.y
  const dist = Math.sqrt(xDist * xDist + yDist * yDist)
  return dist
}

function getAngle (pos1, pos2) {
  return Math.atan2(pos2.y - pos1.y, pos2.x - pos1.x)
}

function onMessage (msg) {
  if (msg.type === 'events') {
    for (let event of msg.data) {
      let id = event.id
      if (netState[id]) {
        netState[id].lostCoins = true
      }
    }
  } else if (msg.id !== undefined) {
    localId = msg.id
    console.log('got local id: ' + localId)
  } else {
    netState = msg
    for (const id in netState) {
      // netState[id] = JSON.parse(netState[id])
    }
  }
}

export const game = {
  start: start,
  onMessage: onMessage
}

/**
 * Returns true if you should preventDefault
 * @param {*} key 
 * @param {*} state 
 */
function switchKey (key, state) {
  switch (key) {
    case 'ArrowLeft':
    case 'a':
      keys.left = state
      break
    case 'ArrowRight':
    case 'd':
      keys.right = state
      break
    case 'ArrowUp':
    case 'w':
      keys.up = state
      break
    case 'ArrowDown':
    case 's':
      keys.down = state
      break
    case 'q':
      keys.cheat = state
      break
    case ' ':
    case 'x':
    case '/':
      if (!keys.shoot && state === true) keys.shootHit = true
      keys.shoot = state
      break
    case 'l':
      // hack for cheatmode
      if (state === false && keys.cheat) {
        player.cheatMode = !player.cheatMode
      }
      break
    default:
      return false
  }
  return true
}

window.addEventListener('keydown', function (e) {
  const preventDefault = switchKey(e.key, true)
  if (preventDefault) e.preventDefault()
  if (!audioInitialized) {
    playSound('silence') // Unblocks the audio API. This is silly! Why did you do this, Chrome et al?
    audioInitialized = true
  }
})

window.addEventListener('keyup', function (e) {
  switchKey(e.key, false)
})

function getIndexFromPixels (x, y) {
  if (x < 0 || y < 0 || x >= world.width * tileSize || y >= world.height * tileSize) return -1
  return Math.floor((y / tileSize)) * world.width + Math.floor((x / tileSize))
}

function getPixelsFromIndex (i) {
  return { x: (i % world.width) * tileSize, y: Math.floor(i / world.width) * tileSize }
}

function isGrounded (ent) {
  return !!getCollidingTiles({ x: ent.pos.x, y: ent.pos.y + 0.1 })
}

function getCollidingTiles (pos) {
  const { x, y } = pos
  const halfTile = tileSize / 2 * 0.8 // shrink entities!
  const tilesToCheck = [
    [ -halfTile, -halfTile, 'topLeft' ],
    [ halfTile - 0.001, -halfTile, 'topRight' ],
    [ -halfTile, halfTile - 0.001, 'bottomLeft' ],
    [ halfTile - 0.001, halfTile - 0.001, 'bottomRight' ]
  ]
  for (const [xOffset, yOffset] of tilesToCheck) {
    const tileX = Math.floor(x + xOffset)
    const tileY = Math.floor(y + yOffset)
    const tileIndex = getIndexFromPixels(tileX, tileY)
    const tile = world.map[tileIndex]
    if (tile > 0 && hiddenSprites.indexOf(tile) === -1) {
      return { x: tileX, y: tileY }
    }
  }
  return null
}

let initialSignpostCount

function restart () {
  ents.length = 0
  player = new Player(20, 20)
}

restart()

window.addEventListener('mousemove', mouseMove)

function mouseMove(e) {
  const pos = getMousePos(canvas, e)

  x = Math.floor((x - camPos.x) * scale)
  y = Math.floor((y - camPos.y) * scale)
  x += Math.floor(canvas.width / 2)
  y += Math.floor(canvas.height / 2)


  pos.x /= scale
  pos.y /= scale
  pos.x += camera.pos.x
  console.log(pos)
  console.log(player.pos)
  player.rot = getAngle(player.pos, pos)
}

function  getMousePos(canvas, evt) {
  if (!canvas) return
  var rect = canvas.getBoundingClientRect(), // abs. size of element
      scaleX = canvas.width / rect.width,    // relationship bitmap vs. element for X
      scaleY = canvas.height / rect.height;  // relationship bitmap vs. element for Y

  return {
    x: (evt.clientX - rect.left) * scaleX,   // scale mouse coordinates after they have
    y: (evt.clientY - rect.top) * scaleY     // been adjusted to be relative to element
  }
}