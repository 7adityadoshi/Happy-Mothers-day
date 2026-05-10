import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const carouselImages = ['2.jpeg', '3.jpeg', '4.jpeg', '5.jpeg', '6.jpeg', '7.jpeg', '8.jpeg', '9.jpeg']
const compliments = ['hardworking', 'loving', 'supermom', 'best chef', 'master multitasker']
const appreciationText =
  'To the prettiest woman of all. Thank you for seamlessly managing both your professional work and our home, and for keeping us all so happy. Your incredible food and endless care mean everything to me. I will miss you and your cooking terribly when I leave for FLAME University for the next two years. I value you the most.'

const gameConfig = {
  work: { title: 'Work', storageKey: 'mother-score-work' },
  subway: { title: 'subway surfers', storageKey: 'mother-score-subway' },
  angry: { title: 'angry birds', storageKey: 'mother-score-angry' },
  flappy: { title: 'Flappy bird', storageKey: 'mother-score-flappy' },
}

const laneX = [180, 360, 540]

function playTone(audioContextRef, frequency, type = 'sine', duration = 0.12) {
  if (!audioContextRef.current) {
    return
  }
  const oscillator = audioContextRef.current.createOscillator()
  const gainNode = audioContextRef.current.createGain()
  oscillator.type = type
  oscillator.frequency.value = frequency
  gainNode.gain.value = 0.08
  oscillator.connect(gainNode)
  gainNode.connect(audioContextRef.current.destination)
  oscillator.start()
  gainNode.gain.exponentialRampToValueAtTime(
    0.0001,
    audioContextRef.current.currentTime + duration,
  )
  oscillator.stop(audioContextRef.current.currentTime + duration)
}

function randomCompliment() {
  return compliments[Math.floor(Math.random() * compliments.length)]
}

function useHighScore(storageKey) {
  const [highScore, setHighScore] = useState(() => window.localStorage.getItem(storageKey) ?? '0')

  const updateHighScore = useCallback(
    (score) => {
      const safeScore = BigInt(Math.max(0, Math.floor(score)))
      const previous = BigInt(highScore)
      if (safeScore > previous) {
        const next = safeScore.toString()
        setHighScore(next)
        window.localStorage.setItem(storageKey, next)
      }
    },
    [highScore, storageKey],
  )

  return { highScore, updateHighScore }
}

function useRouteTransition() {
  const [renderedRoute, setRenderedRoute] = useState(() => {
    const path = window.location.pathname.replace('/', '')
    return gameConfig[path] ? path : 'home'
  })
  const [opacityClass, setOpacityClass] = useState('opacity-100')

  const navigate = useCallback((nextRoute) => {
    setOpacityClass('opacity-0')
    window.setTimeout(() => {
      setRenderedRoute(nextRoute)
      if (nextRoute === 'home') {
        window.history.pushState({}, '', '/')
      } else {
        window.history.pushState({}, '', `/${nextRoute}`)
      }
      setOpacityClass('opacity-100')
    }, 500)
  }, [])

  useEffect(() => {
    const handler = () => {
      const path = window.location.pathname.replace('/', '')
      const target = gameConfig[path] ? path : 'home'
      setRenderedRoute(target)
      setOpacityClass('opacity-100')
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  return { renderedRoute, opacityClass, navigate }
}

function MilestoneOverlay({ text }) {
  if (!text) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/25">
      <p className="rounded-2xl bg-white/90 px-6 py-4 text-center text-xl font-bold text-pink-700 shadow-xl">
        You are {text}!
      </p>
    </div>
  )
}

function InstructionsModal({ title, instructions, onStart }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
      <div className="max-w-lg rounded-3xl bg-white p-6 text-center shadow-2xl">
        <h3 className="mb-4 text-2xl font-bold text-pink-700">{title} Instructions</h3>
        <p className="mb-6 text-sm leading-7 text-zinc-700">{instructions}</p>
        <button
          type="button"
          onClick={onStart}
          className="rounded-full bg-pink-600 px-5 py-2 font-semibold text-white transition hover:bg-pink-500"
        >
          Start Game
        </button>
      </div>
    </div>
  )
}

function GameLayout({ children, title, score, highScore, onBack }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-pink-700 shadow transition hover:bg-white"
        >
          ← Back to celebration
        </button>
        <h2 className="text-3xl font-black text-white drop-shadow">{title}</h2>
        <div className="rounded-2xl bg-white/85 px-4 py-2 text-sm font-semibold text-pink-700 shadow">
          Score: {score} · High score: {highScore}
        </div>
      </div>
      {children}
    </div>
  )
}

function WorkGame({ avatar, audioContextRef, onBack }) {
  const canvasRef = useRef(null)
  const [score, setScore] = useState(0)
  const [milestoneText, setMilestoneText] = useState('')
  const [showInstructions, setShowInstructions] = useState(true)
  const { highScore, updateHighScore } = useHighScore(gameConfig.work.storageKey)
  const lastMilestone = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    let running = true
    let gameOver = false
    let frameId = 0
    let speed = 2.5
    let y = 260
    let vy = 0
    const player = { x: 120, width: 54, height: 54 }
    const obstacles = []
    const collectibles = []
    let points = 0
    let spawnTimer = 0
    let collectTimer = 0
    const startTime = performance.now()

    const jump = () => {
      if (showInstructions || gameOver) {
        return
      }
      vy = -7.2
      playTone(audioContextRef, 620, 'triangle')
    }

    const onPointer = () => jump()
    const onKey = (event) => {
      if (event.code === 'Space') {
        event.preventDefault()
        jump()
      }
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)

    const drawObstacle = (item) => {
      context.save()
      context.translate(item.x, 0)
      context.fillStyle = '#7c3aed'
      context.fillRect(0, 0, item.width, item.gapY)
      context.fillRect(0, item.gapY + item.gap, item.width, canvas.height)
      context.fillStyle = '#fce7f3'
      const capY = item.gapY - 24
      if (item.type === 'paperwork') {
        context.fillRect(6, capY, item.width - 12, 20)
      } else if (item.type === 'laptop') {
        context.fillRect(5, capY, item.width - 10, 8)
        context.fillRect(8, capY + 8, item.width - 16, 12)
      } else {
        context.beginPath()
        context.arc(item.width / 2, capY + 10, 10, 0, Math.PI * 2)
        context.fill()
      }
      context.restore()
    }

    const drawCollectible = (item) => {
      context.fillStyle = '#ec4899'
      if (item.type === 'tea') {
        context.fillRect(item.x, item.y + 8, 18, 12)
        context.strokeStyle = '#ec4899'
        context.beginPath()
        context.arc(item.x + 18, item.y + 14, 5, -Math.PI / 2, Math.PI / 2)
        context.stroke()
      } else {
        context.fillRect(item.x, item.y, 18, 24)
        context.clearRect(item.x + 4, item.y + 4, 10, 2)
      }
    }

    const checkMilestone = (currentScore) => {
      if (
        currentScore > 0 &&
        currentScore !== lastMilestone.current &&
        (currentScore % 50 === 0 || currentScore % 100 === 0)
      ) {
        lastMilestone.current = currentScore
        setMilestoneText(randomCompliment())
        window.setTimeout(() => setMilestoneText(''), 1200)
      }
    }

    const loop = (timestamp) => {
      if (!running) {
        return
      }
      if (showInstructions) {
        frameId = window.requestAnimationFrame(loop)
        return
      }
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#fdf2f8'
      context.fillRect(0, 0, canvas.width, canvas.height)

      const elapsed = (timestamp - startTime) / 1000
      speed = 2.5 + Math.floor(elapsed / 30) * 0.35
      vy += 0.35
      y += vy
      if (y < 0) {
        y = 0
        vy = 0
      }
      if (y + player.height > canvas.height) {
        y = canvas.height - player.height
        gameOver = true
      }

      spawnTimer += 1
      if (spawnTimer > 86) {
        spawnTimer = 0
        obstacles.push({
          x: canvas.width + 20,
          width: 68,
          gapY: 50 + Math.random() * 180,
          gap: 180,
          type: ['paperwork', 'laptop', 'phone'][Math.floor(Math.random() * 3)],
        })
      }

      collectTimer += 1
      if (collectTimer > 95) {
        collectTimer = 0
        collectibles.push({
          x: canvas.width + 20,
          y: 40 + Math.random() * 280,
          type: Math.random() > 0.5 ? 'tea' : 'doc',
          hit: false,
        })
      }

      for (const obstacle of obstacles) {
        obstacle.x -= speed
        drawObstacle(obstacle)
        const inX =
          player.x + player.width > obstacle.x && player.x < obstacle.x + obstacle.width
        const inGap = y > obstacle.gapY && y + player.height < obstacle.gapY + obstacle.gap
        if (inX && !inGap) {
          gameOver = true
        }
      }

      for (const item of collectibles) {
        item.x -= speed + 0.8
        drawCollectible(item)
        const overlap =
          !item.hit &&
          player.x < item.x + 18 &&
          player.x + player.width > item.x &&
          y < item.y + 24 &&
          y + player.height > item.y
        if (overlap) {
          item.hit = true
          points += 10
          setScore(points)
          updateHighScore(points)
          checkMilestone(points)
          playTone(audioContextRef, 820, 'sine')
        }
      }

      while (obstacles.length && obstacles[0].x + obstacles[0].width < 0) {
        obstacles.shift()
      }
      while (collectibles.length && collectibles[0].x < -30) {
        collectibles.shift()
      }

      context.drawImage(avatar, player.x, y, player.width, player.height)

      if (gameOver) {
        context.fillStyle = 'rgba(0,0,0,0.5)'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.fillStyle = '#fff'
        context.font = 'bold 32px sans-serif'
        context.fillText('Game Over - Tap to restart', 150, 220)
        points = 0
        setScore(0)
        playTone(audioContextRef, 200, 'square', 0.2)
        y = 260
        vy = 0
        obstacles.length = 0
        collectibles.length = 0
        gameOver = false
      }
      frameId = window.requestAnimationFrame(loop)
    }

    frameId = window.requestAnimationFrame(loop)
    return () => {
      running = false
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [audioContextRef, avatar, showInstructions, updateHighScore])

  return (
    <GameLayout title="Work" score={score} highScore={highScore} onBack={onBack}>
      <div className="relative overflow-hidden rounded-3xl bg-white/50 p-2 shadow-2xl">
        {showInstructions && (
          <InstructionsModal
            title="Work"
            instructions="Tap, click, or press space to fly upward against gravity, dodge paperwork/laptop/phone barriers, and collect tea cups or document icons for points."
            onStart={() => setShowInstructions(false)}
          />
        )}
        <MilestoneOverlay text={milestoneText} />
        <canvas
          ref={canvasRef}
          width={900}
          height={500}
          className="h-[68vh] max-h-[520px] w-full touch-none rounded-2xl border border-pink-200 bg-white"
        />
      </div>
    </GameLayout>
  )
}

function SubwayGame({ avatar, audioContextRef, onBack }) {
  const canvasRef = useRef(null)
  const [score, setScore] = useState(0)
  const [milestoneText, setMilestoneText] = useState('')
  const [showInstructions, setShowInstructions] = useState(true)
  const { highScore, updateHighScore } = useHighScore(gameConfig.subway.storageKey)
  const lastMilestone = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    let frameId = 0
    let running = true
    let lane = 1
    let speed = 7
    let scoreValue = 0
    let multiplier = 1
    let backgroundMode = 'office'
    const obstacles = []
    const pickups = []
    let spawnCounter = 0
    const startTime = performance.now()
    const swipe = { x: 0 }

    const onTouchStart = (event) => {
      swipe.x = event.touches[0].clientX
    }
    const onTouchEnd = (event) => {
      if (showInstructions) {
        return
      }
      const delta = event.changedTouches[0].clientX - swipe.x
      if (delta > 35 && lane < 2) {
        lane += 1
        playTone(audioContextRef, 480, 'triangle')
      }
      if (delta < -35 && lane > 0) {
        lane -= 1
        playTone(audioContextRef, 480, 'triangle')
      }
    }
    const onKey = (event) => {
      if (showInstructions) {
        return
      }
      if (event.code === 'ArrowLeft' && lane > 0) {
        lane -= 1
      }
      if (event.code === 'ArrowRight' && lane < 2) {
        lane += 1
      }
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('keydown', onKey)

    const checkMilestone = () => {
      if (
        scoreValue > 0 &&
        scoreValue !== lastMilestone.current &&
        (scoreValue % 50 === 0 || scoreValue % 100 === 0)
      ) {
        lastMilestone.current = scoreValue
        setMilestoneText(randomCompliment())
        window.setTimeout(() => setMilestoneText(''), 1200)
      }
    }

    const loop = (timestamp) => {
      if (!running) {
        return
      }
      if (showInstructions) {
        frameId = window.requestAnimationFrame(loop)
        return
      }
      const elapsed = (timestamp - startTime) / 1000
      speed = 7 + Math.floor(elapsed / 30)
      backgroundMode = Math.floor(elapsed / 6) % 2 === 0 ? 'office' : 'supermarket'
      context.fillStyle = backgroundMode === 'office' ? '#f0f9ff' : '#fefce8'
      context.fillRect(0, 0, canvas.width, canvas.height)

      context.fillStyle = '#e2e8f0'
      context.beginPath()
      context.moveTo(100, 500)
      context.lineTo(450, 100)
      context.lineTo(800, 500)
      context.closePath()
      context.fill()

      spawnCounter += 1
      if (spawnCounter > 35) {
        spawnCounter = 0
        obstacles.push({ lane: Math.floor(Math.random() * 3), z: 0, type: Math.random() > 0.5 ? 'phone' : 'cart' })
        if (Math.random() > 0.4) {
          pickups.push({
            lane: Math.floor(Math.random() * 3),
            z: 0,
            type: Math.random() > 0.5 ? 'grocery' : 'contract',
            used: false,
          })
        }
      }

      const drawEntity = (entity, isObstacle) => {
        entity.z += speed
        const scale = Math.min(1.2, entity.z / 260)
        const y = 80 + entity.z
        const x = laneX[entity.lane] - 30 * scale
        const w = 50 * scale
        const h = 60 * scale
        context.fillStyle = isObstacle ? '#be123c' : '#db2777'
        context.fillRect(x, y, w, h)
        if (!isObstacle) {
          context.fillStyle = '#fff'
          context.fillRect(x + 10, y + 8, w - 20, 10)
        }
        return { x, y, w, h }
      }

      const playerX = laneX[lane] - 34
      const playerY = 420
      context.drawImage(avatar, playerX, playerY, 68, 68)

      for (const obstacle of obstacles) {
        const hitBox = drawEntity(obstacle, true)
        if (
          playerX < hitBox.x + hitBox.w &&
          playerX + 68 > hitBox.x &&
          playerY < hitBox.y + hitBox.h &&
          playerY + 68 > hitBox.y
        ) {
          scoreValue = 0
          multiplier = 1
          setScore(0)
          playTone(audioContextRef, 240, 'square', 0.2)
          obstacles.length = 0
          pickups.length = 0
          break
        }
      }

      for (const pickup of pickups) {
        const hitBox = drawEntity(pickup, false)
        if (
          !pickup.used &&
          playerX < hitBox.x + hitBox.w &&
          playerX + 68 > hitBox.x &&
          playerY < hitBox.y + hitBox.h &&
          playerY + 68 > hitBox.y
        ) {
          pickup.used = true
          multiplier += 1
          scoreValue += 5 * multiplier
          setScore(scoreValue)
          updateHighScore(scoreValue)
          checkMilestone()
          playTone(audioContextRef, 760, 'sine')
        }
      }

      while (obstacles.length && obstacles[0].z > 550) {
        obstacles.shift()
      }
      while (pickups.length && pickups[0].z > 550) {
        pickups.shift()
      }
      frameId = window.requestAnimationFrame(loop)
    }

    frameId = window.requestAnimationFrame(loop)
    return () => {
      running = false
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKey)
    }
  }, [audioContextRef, avatar, showInstructions, updateHighScore])

  return (
    <GameLayout title="subway surfers" score={score} highScore={highScore} onBack={onBack}>
      <div className="relative overflow-hidden rounded-3xl bg-white/50 p-2 shadow-2xl">
        {showInstructions && (
          <InstructionsModal
            title="subway surfers"
            instructions="Swipe or use arrow keys to move across three lanes. Avoid phones and shopping carts while collecting grocery and contract icons to build your score multiplier."
            onStart={() => setShowInstructions(false)}
          />
        )}
        <MilestoneOverlay text={milestoneText} />
        <canvas
          ref={canvasRef}
          width={900}
          height={500}
          className="h-[68vh] max-h-[520px] w-full touch-none rounded-2xl border border-pink-200 bg-white"
        />
      </div>
    </GameLayout>
  )
}

function AngryBirdsGame({ avatar, audioContextRef, onBack }) {
  const canvasRef = useRef(null)
  const [score, setScore] = useState(0)
  const [milestoneText, setMilestoneText] = useState('')
  const [showInstructions, setShowInstructions] = useState(true)
  const { highScore, updateHighScore } = useHighScore(gameConfig.angry.storageKey)
  const lastMilestone = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    let frameId = 0
    let running = true
    let scoreValue = 0
    let turns = 8
    const gravity = 0.22
    const projectile = { x: 110, y: 390, vx: 0, vy: 0, moving: false }
    const sling = { x: 110, y: 390 }
    const blocks = Array.from({ length: 7 }).map((_, index) => ({
      x: 620 + (index % 2) * 56,
      y: 380 - Math.floor(index / 2) * 36,
      width: 52,
      height: 30,
      type: index % 2 === 0 ? 'mail' : 'laundry',
    }))
    let dragging = false

    const checkMilestone = () => {
      if (
        scoreValue > 0 &&
        scoreValue !== lastMilestone.current &&
        (scoreValue % 50 === 0 || scoreValue % 100 === 0)
      ) {
        lastMilestone.current = scoreValue
        setMilestoneText(randomCompliment())
        window.setTimeout(() => setMilestoneText(''), 1200)
      }
    }

    const resetShot = () => {
      projectile.x = sling.x
      projectile.y = sling.y
      projectile.vx = 0
      projectile.vy = 0
      projectile.moving = false
      turns -= 1
    }

    const onPointerDown = (event) => {
      if (showInstructions || turns <= 0 || blocks.length === 0) {
        return
      }
      dragging = true
      projectile.moving = false
      projectile.x = event.offsetX
      projectile.y = event.offsetY
    }
    const onPointerMove = (event) => {
      if (!dragging) {
        return
      }
      projectile.x = Math.max(40, Math.min(200, event.offsetX))
      projectile.y = Math.max(280, Math.min(430, event.offsetY))
    }
    const onPointerUp = () => {
      if (!dragging) {
        return
      }
      dragging = false
      projectile.vx = (sling.x - projectile.x) * 0.18
      projectile.vy = (sling.y - projectile.y) * 0.18
      projectile.moving = true
      playTone(audioContextRef, 510, 'triangle')
    }
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)

    const loop = () => {
      if (!running) {
        return
      }
      if (showInstructions) {
        frameId = window.requestAnimationFrame(loop)
        return
      }
      context.fillStyle = '#fdf4ff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#a16207'
      context.fillRect(sling.x - 8, sling.y - 40, 16, 80)

      if (projectile.moving) {
        projectile.vy += gravity
        projectile.x += projectile.vx
        projectile.y += projectile.vy
      }

      for (let index = blocks.length - 1; index >= 0; index -= 1) {
        const block = blocks[index]
        context.fillStyle = block.type === 'mail' ? '#fb7185' : '#f43f5e'
        context.fillRect(block.x, block.y, block.width, block.height)
        if (
          projectile.x + 44 > block.x &&
          projectile.x < block.x + block.width &&
          projectile.y + 44 > block.y &&
          projectile.y < block.y + block.height
        ) {
          blocks.splice(index, 1)
          projectile.vx *= 0.7
          projectile.vy *= -0.2
          scoreValue += 20
          setScore(scoreValue)
          updateHighScore(scoreValue)
          checkMilestone()
          playTone(audioContextRef, 800, 'sawtooth')
        }
      }

      if (
        projectile.x > canvas.width + 80 ||
        projectile.y > canvas.height + 80 ||
        projectile.x < -80
      ) {
        if (turns > 0) {
          resetShot()
        }
      }

      if (!projectile.moving && !dragging) {
        projectile.x = sling.x
        projectile.y = sling.y
      }

      context.drawImage(avatar, projectile.x - 22, projectile.y - 22, 44, 44)
      context.fillStyle = '#831843'
      context.font = 'bold 24px sans-serif'
      context.fillText(`Turns left: ${Math.max(turns, 0)}`, 26, 40)

      if (turns <= 0 || blocks.length === 0) {
        context.fillStyle = 'rgba(0,0,0,0.55)'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.fillStyle = '#fff'
        context.font = 'bold 34px sans-serif'
        context.fillText(blocks.length === 0 ? 'All tasks cleared!' : 'Turn limit reached!', 260, 210)
        context.font = '20px sans-serif'
        context.fillText('Tap Start Game again from top to replay.', 265, 250)
      }

      frameId = window.requestAnimationFrame(loop)
    }

    frameId = window.requestAnimationFrame(loop)
    return () => {
      running = false
      window.cancelAnimationFrame(frameId)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
    }
  }, [audioContextRef, avatar, showInstructions, updateHighScore])

  return (
    <GameLayout title="angry birds" score={score} highScore={highScore} onBack={onBack}>
      <div className="relative overflow-hidden rounded-3xl bg-white/50 p-2 shadow-2xl">
        {showInstructions && (
          <InstructionsModal
            title="angry birds"
            instructions="Drag and release to launch the avatar in a parabolic arc. Knock down mail-folder and laundry-basket structures within the turn limit."
            onStart={() => setShowInstructions(false)}
          />
        )}
        <MilestoneOverlay text={milestoneText} />
        <canvas
          ref={canvasRef}
          width={900}
          height={500}
          className="h-[68vh] max-h-[520px] w-full touch-none rounded-2xl border border-pink-200 bg-white"
        />
      </div>
    </GameLayout>
  )
}

function FlappyPlatformGame({ avatar, audioContextRef, onBack }) {
  const canvasRef = useRef(null)
  const [score, setScore] = useState(0)
  const [milestoneText, setMilestoneText] = useState('')
  const [showInstructions, setShowInstructions] = useState(true)
  const { highScore, updateHighScore } = useHighScore(gameConfig.flappy.storageKey)
  const lastMilestone = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    let running = true
    let frameId = 0
    let scoreValue = 0
    let speed = 2
    let gameOver = false
    const startTime = performance.now()
    const player = { x: 420, y: 280, vy: 0, width: 56, height: 56 }
    const platforms = Array.from({ length: 8 }).map((_, index) => ({
      x: 60 + (index % 3) * 260,
      y: 80 + index * 70,
      width: 180,
      type: ['desk', 'laptop', 'table'][index % 3],
    }))
    const hazards = []
    let spawnCounter = 0

    const checkMilestone = () => {
      if (
        scoreValue > 0 &&
        scoreValue !== lastMilestone.current &&
        (scoreValue % 50 === 0 || scoreValue % 100 === 0)
      ) {
        lastMilestone.current = scoreValue
        setMilestoneText(randomCompliment())
        window.setTimeout(() => setMilestoneText(''), 1200)
      }
    }

    const loop = (timestamp) => {
      if (!running) {
        return
      }
      if (showInstructions) {
        frameId = window.requestAnimationFrame(loop)
        return
      }
      const elapsed = (timestamp - startTime) / 1000
      speed = 2 + Math.floor(elapsed / 30) * 0.3
      context.fillStyle = '#fff1f2'
      context.fillRect(0, 0, canvas.width, canvas.height)

      player.vy += 0.35
      player.y += player.vy
      if (player.y > canvas.height) {
        gameOver = true
      }

      for (const platform of platforms) {
        platform.y += speed
        if (platform.y > canvas.height + 20) {
          platform.y = -30
          platform.x = 30 + Math.random() * 680
          scoreValue += 10
          setScore(scoreValue)
          updateHighScore(scoreValue)
          checkMilestone()
        }
        context.fillStyle = '#db2777'
        context.fillRect(platform.x, platform.y, platform.width, 14)
        if (platform.type === 'laptop') {
          context.fillRect(platform.x + 30, platform.y - 12, 40, 12)
        }
        const onTop =
          player.vy > 0 &&
          player.x + player.width > platform.x &&
          player.x < platform.x + platform.width &&
          player.y + player.height > platform.y &&
          player.y + player.height < platform.y + 18
        if (onTop) {
          player.vy = -9.4
          playTone(audioContextRef, 690, 'triangle')
        }
      }

      spawnCounter += 1
      if (spawnCounter > 80) {
        spawnCounter = 0
        hazards.push({
          x: Math.random() > 0.5 ? -60 : canvas.width + 60,
          y: 100 + Math.random() * 320,
          vx: Math.random() > 0.5 ? 2.5 : -2.5,
          type: Math.random() > 0.5 ? 'alarm' : 'battery',
        })
      }

      for (const hazard of hazards) {
        hazard.x += hazard.vx
        context.fillStyle = '#9f1239'
        if (hazard.type === 'alarm') {
          context.beginPath()
          context.arc(hazard.x, hazard.y, 22, 0, Math.PI * 2)
          context.fill()
        } else {
          context.fillRect(hazard.x - 20, hazard.y - 14, 40, 28)
          context.clearRect(hazard.x + 8, hazard.y - 8, 6, 16)
        }
        if (
          player.x < hazard.x + 26 &&
          player.x + player.width > hazard.x - 26 &&
          player.y < hazard.y + 26 &&
          player.y + player.height > hazard.y - 26
        ) {
          gameOver = true
        }
      }

      while (hazards.length && (hazards[0].x < -100 || hazards[0].x > canvas.width + 100)) {
        hazards.shift()
      }

      context.drawImage(avatar, player.x, player.y, player.width, player.height)

      if (gameOver) {
        context.fillStyle = 'rgba(0,0,0,0.5)'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.fillStyle = '#fff'
        context.font = 'bold 34px sans-serif'
        context.fillText('Game Over', 350, 230)
        scoreValue = 0
        setScore(0)
        player.y = 280
        player.vy = 0
        hazards.length = 0
        gameOver = false
        playTone(audioContextRef, 220, 'square', 0.2)
      }
      frameId = window.requestAnimationFrame(loop)
    }

    frameId = window.requestAnimationFrame(loop)
    return () => {
      running = false
      window.cancelAnimationFrame(frameId)
    }
  }, [audioContextRef, avatar, showInstructions, updateHighScore])

  return (
    <GameLayout title="Flappy bird" score={score} highScore={highScore} onBack={onBack}>
      <div className="relative overflow-hidden rounded-3xl bg-white/50 p-2 shadow-2xl">
        {showInstructions && (
          <InstructionsModal
            title="Flappy bird"
            instructions="Bounce upward by landing on moving desks/laptops/tables while avoiding alarm clocks and low-battery hazards in the vertical endless climb."
            onStart={() => setShowInstructions(false)}
          />
        )}
        <MilestoneOverlay text={milestoneText} />
        <canvas
          ref={canvasRef}
          width={900}
          height={500}
          className="h-[68vh] max-h-[520px] w-full touch-none rounded-2xl border border-pink-200 bg-white"
        />
      </div>
    </GameLayout>
  )
}

function HomePage({ onNavigate }) {
  const [ready, setReady] = useState(false)
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 500)
    const carouselTimer = window.setInterval(
      () => setSlide((current) => (current + 1) % carouselImages.length),
      2000,
    )
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(carouselTimer)
    }
  }, [])

  const cards = useMemo(
    () => [
      { key: 'work', title: 'Work', text: 'Side-scrolling office-life challenge' },
      { key: 'subway', title: 'subway surfers', text: 'Three-lane runner with swipe controls' },
      { key: 'angry', title: 'angry birds', text: 'Parabolic launch with turn-limited strategy' },
      { key: 'flappy', title: 'Flappy bird', text: 'Vertical bounce platform survival' },
    ],
    [],
  )

  return (
    <>
      <div className="heart-overlay" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, index) => (
          <span
            key={`heart-${String(index)}`}
            className="heart"
            style={{
              left: `${(index / 24) * 100}%`,
              animationDelay: `${(index % 8) * 0.7}s`,
              animationDuration: `${6 + (index % 5)}s`,
            }}
          >
            ♥
          </span>
        ))}
      </div>
      <main className="relative z-10 min-h-screen">
        <section className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-8 px-4 py-12 text-white">
          <div
            className={`w-full max-w-4xl rounded-3xl bg-white/20 p-4 shadow-2xl backdrop-blur transition-all duration-700 ${
              ready ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
          >
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-black/20">
              {carouselImages.map((image, index) => (
                <img
                  key={image}
                  src={`/${image}`}
                  alt={`Family memory ${index + 1}`}
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                    slide === index ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              ))}
            </div>
          </div>
          <div
            className={`max-w-4xl rounded-3xl bg-white/85 p-6 text-center text-zinc-700 shadow-2xl transition-all delay-300 duration-700 ${
              ready ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
          >
            <h1 className="mb-4 text-3xl font-black text-pink-700 md:text-5xl">Happy Mother's Day ✨</h1>
            <p className="text-base leading-8 md:text-lg">
              {appreciationText}{' '}
              <span className="font-black text-[#C71585]">from your most loved adi</span>
            </p>
          </div>
        </section>

        <section className="mx-auto min-h-screen max-w-6xl px-4 py-16">
          <div className="rounded-3xl bg-white/80 p-6 shadow-2xl md:p-10">
            <h2 className="mb-6 text-center text-3xl font-black text-pink-700 md:text-4xl">
              Surprise Game Arcade
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {cards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => onNavigate(card.key)}
                  className="rounded-2xl bg-pink-600 p-6 text-left text-white shadow-xl transition hover:-translate-y-1 hover:bg-pink-500"
                >
                  <h3 className="text-2xl font-bold">{card.title}</h3>
                  <p className="mt-2 text-sm text-pink-100">{card.text}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  )
}

function App() {
  const avatar = useMemo(() => {
    const image = new Image()
    image.src = '/1.jpeg'
    return image
  }, [])
  const audioContextRef = useRef(null)
  const musicRef = useRef(null)
  const { renderedRoute, opacityClass, navigate } = useRouteTransition()

  useEffect(() => {
    const startAudio = () => {
      if (!musicRef.current) {
        const audio = new Audio('/10.mp3')
        audio.loop = true
        audio.volume = 0.6
        audio.play().catch(() => {})
        musicRef.current = audio
      }
      if (!audioContextRef.current) {
        audioContextRef.current = new window.AudioContext()
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {})
      }
    }

    window.addEventListener('pointerdown', startAudio, { once: true })
    window.addEventListener('keydown', startAudio, { once: true })
    return () => {
      window.removeEventListener('pointerdown', startAudio)
      window.removeEventListener('keydown', startAudio)
    }
  }, [])

  return (
    <div className={`transition-opacity duration-500 ${opacityClass}`}>
      {renderedRoute === 'home' && <HomePage onNavigate={navigate} />}
      {renderedRoute === 'work' && <WorkGame avatar={avatar} audioContextRef={audioContextRef} onBack={() => navigate('home')} />}
      {renderedRoute === 'subway' && <SubwayGame avatar={avatar} audioContextRef={audioContextRef} onBack={() => navigate('home')} />}
      {renderedRoute === 'angry' && <AngryBirdsGame avatar={avatar} audioContextRef={audioContextRef} onBack={() => navigate('home')} />}
      {renderedRoute === 'flappy' && <FlappyPlatformGame avatar={avatar} audioContextRef={audioContextRef} onBack={() => navigate('home')} />}
    </div>
  )
}

export default App
