import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  closeFramingSource,
  cropFramedBitmap,
  openFramingSource,
  type AvatarCropRect,
  type FramedAvatar,
  type FramingSource,
} from '../data/avatarPhoto'

const MIN_ZOOM = 1
const MAX_ZOOM = 4

function coverScale(width: number, height: number, frame: number) {
  return Math.max(frame / width, frame / height)
}

function clampOffset(
  offset: { x: number; y: number },
  width: number,
  height: number,
  frame: number,
  scale: number,
) {
  return {
    x: Math.min(0, Math.max(frame - width * scale, offset.x)),
    y: Math.min(0, Math.max(frame - height * scale, offset.y)),
  }
}

function centeredOffset(
  width: number,
  height: number,
  frame: number,
  zoom: number,
) {
  const scale = coverScale(width, height, frame) * zoom
  return clampOffset(
    { x: (frame - width * scale) / 2, y: (frame - height * scale) / 2 },
    width,
    height,
    frame,
    scale,
  )
}

function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

function placementFor(
  width: number,
  height: number,
  frame: number,
  crop: AvatarCropRect | null,
) {
  if (!crop) {
    return { zoom: 1, offset: centeredOffset(width, height, frame, 1) }
  }
  const cover = coverScale(width, height, frame)
  const zoom = clampZoom(frame / crop.size / cover)
  const scale = cover * zoom
  const centerX = crop.sx + crop.size / 2
  const centerY = crop.sy + crop.size / 2
  return {
    zoom,
    offset: clampOffset(
      {
        x: frame / 2 - centerX * scale,
        y: frame / 2 - centerY * scale,
      },
      width,
      height,
      frame,
      scale,
    ),
  }
}

interface AvatarCropProps {
  file: File
  initialCrop?: AvatarCropRect | null
  busy: boolean
  error: string
  onCancel: () => void
  onUse: (framed: FramedAvatar) => Promise<void>
}

export function AvatarCrop({
  file,
  initialCrop = null,
  busy,
  error,
  onCancel,
  onUse,
}: AvatarCropProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const sourceRef = useRef<FramingSource | null>(null)
  const offsetRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(1)
  const fittedSource = useRef<FramingSource | null>(null)
  const initialCropRef = useRef(initialCrop)
  initialCropRef.current = initialCrop
  const lastFrame = useRef(0)
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  )
  const pinchRef = useRef<{ dist: number; zoom: number; ox: number; oy: number } | null>(
    null,
  )
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())

  const [source, setSource] = useState<FramingSource | null>(null)
  const [loadError, setLoadError] = useState('')
  const [frame, setFrame] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [placed, setPlaced] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    offsetRef.current = offset
  }, [offset])

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  useEffect(() => {
    let cancelled = false
    openFramingSource(file)
      .then((next) => {
        if (cancelled) {
          closeFramingSource(next)
          return
        }
        sourceRef.current = next
        setSource(next)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Não consegui ler essa foto. Escolha outra.')
      })
    return () => {
      cancelled = true
      if (sourceRef.current) {
        closeFramingSource(sourceRef.current)
        sourceRef.current = null
      }
    }
  }, [file])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const measure = () => {
      const next = stage.clientWidth
      setFrame((current) => (current === next ? current : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!source || frame === 0) return
    if (fittedSource.current !== source) {
      fittedSource.current = source
      lastFrame.current = frame
      const placedNow = placementFor(
        source.width,
        source.height,
        frame,
        initialCropRef.current,
      )
      zoomRef.current = placedNow.zoom
      offsetRef.current = placedNow.offset
      setZoom(placedNow.zoom)
      setOffset(placedNow.offset)
      setPlaced(true)
      return
    }
    if (lastFrame.current === frame) return
    const ratio = frame / lastFrame.current
    lastFrame.current = frame
    const scale = coverScale(source.width, source.height, frame) * zoomRef.current
    setOffset((current) =>
      clampOffset(
        { x: current.x * ratio, y: current.y * ratio },
        source.width,
        source.height,
        frame,
        scale,
      ),
    )
  }, [source, frame])

  function scaleFor(nextZoom: number, nextFrame = frame) {
    if (!source || nextFrame === 0) return 1
    return coverScale(source.width, source.height, nextFrame) * nextZoom
  }

  function moveZoom(nextZoom: number) {
    if (!source || frame === 0 || busy) return
    const zoomNext = clampZoom(nextZoom)
    const previousScale = scaleFor(zoomRef.current)
    const nextScale = scaleFor(zoomNext)
    const cx = (frame / 2 - offsetRef.current.x) / previousScale
    const cy = (frame / 2 - offsetRef.current.y) / previousScale
    const nextOffset = clampOffset(
      { x: frame / 2 - cx * nextScale, y: frame / 2 - cy * nextScale },
      source.width,
      source.height,
      frame,
      nextScale,
    )
    zoomRef.current = zoomNext
    offsetRef.current = nextOffset
    setZoom(zoomNext)
    setOffset(nextOffset)
  }

  const moveZoomRef = useRef(moveZoom)
  moveZoomRef.current = moveZoom

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      moveZoomRef.current(zoomRef.current + (event.deltaY > 0 ? -0.12 : 0.12))
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [])

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (busy || !source) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // O arraste segue pelos eventos enquanto o ponteiro está no quadro.
    }
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointersRef.current.size === 1) {
      dragRef.current = {
        x: event.clientX,
        y: event.clientY,
        ox: offsetRef.current.x,
        oy: offsetRef.current.y,
      }
      pinchRef.current = null
      setDragging(true)
      return
    }
    const [a, b] = [...pointersRef.current.values()]
    dragRef.current = null
    pinchRef.current = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      zoom: zoomRef.current,
      ox: offsetRef.current.x,
      oy: offsetRef.current.y,
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId) || !source || frame === 0) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointersRef.current.size >= 2 && pinchRef.current && pinchRef.current.dist > 1) {
      const [a, b] = [...pointersRef.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const zoomNext = clampZoom(pinchRef.current.zoom * (dist / pinchRef.current.dist))
      const previousScale = scaleFor(pinchRef.current.zoom)
      const nextScale = scaleFor(zoomNext)
      const cx = (frame / 2 - pinchRef.current.ox) / previousScale
      const cy = (frame / 2 - pinchRef.current.oy) / previousScale
      const nextOffset = clampOffset(
        { x: frame / 2 - cx * nextScale, y: frame / 2 - cy * nextScale },
        source.width,
        source.height,
        frame,
        nextScale,
      )
      zoomRef.current = zoomNext
      offsetRef.current = nextOffset
      setZoom(zoomNext)
      setOffset(nextOffset)
      return
    }
    if (!dragRef.current) return
    const nextOffset = clampOffset(
      {
        x: dragRef.current.ox + (event.clientX - dragRef.current.x),
        y: dragRef.current.oy + (event.clientY - dragRef.current.y),
      },
      source.width,
      source.height,
      frame,
      scaleFor(zoomRef.current),
    )
    offsetRef.current = nextOffset
    setOffset(nextOffset)
  }

  function endPointer(event: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (pointersRef.current.size === 0) {
      dragRef.current = null
      setDragging(false)
      return
    }
    const remaining = [...pointersRef.current.values()][0]
    dragRef.current = {
      x: remaining.x,
      y: remaining.y,
      ox: offsetRef.current.x,
      oy: offsetRef.current.y,
    }
  }

  async function confirm() {
    if (!source || frame === 0 || busy) return
    const scale = scaleFor(zoom)
    const crop = {
      sx: -offset.x / scale,
      sy: -offset.y / scale,
      size: frame / scale,
      width: source.width,
      height: source.height,
    }
    const icon = await cropFramedBitmap(source.bitmap, crop)
    const sourceBlob = await fetch(source.previewUrl).then((response) => response.blob())
    await onUse({ icon, source: sourceBlob, crop })
  }

  const scale = source && frame ? scaleFor(zoom) : 1
  const message = loadError || error

  return createPortal(
    <div
      className="app-modal-overlay"
      role="presentation"
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="app-modal-card avatar-crop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="app-modal-head">
          <div>
            <p className="tourney-kicker">Foto de perfil</p>
            <h3 id="avatar-crop-title">Enquadrar foto</h3>
          </div>
          <button
            type="button"
            className="link-btn"
            onClick={onCancel}
            disabled={busy}
          >
            Fechar
          </button>
        </header>

        <p className="field-hint avatar-crop-hint">
          Arraste para posicionar e use o zoom. O círculo é o ícone do perfil.
        </p>

        <div
          ref={stageRef}
          className={`avatar-crop-stage${dragging ? ' is-dragging' : ''}`}
          role="application"
          aria-label="Enquadramento da foto. Arraste para posicionar."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
        >
          {source ? (
            <img
              src={source.previewUrl}
              alt=""
              draggable={false}
              style={{
                width: source.width * scale,
                height: source.height * scale,
                left: offset.x,
                top: offset.y,
                opacity: placed ? 1 : 0,
              }}
            />
          ) : (
            <p className="avatar-crop-loading">
              {loadError ? 'Foto indisponível' : 'Abrindo foto…'}
            </p>
          )}
          <span className="avatar-crop-ring" aria-hidden />
        </div>

        <label className="avatar-crop-zoom">
          <span>Zoom</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!source || busy}
            onChange={(event) => moveZoom(Number(event.target.value))}
          />
        </label>

        {message ? <p className="form-error">{message}</p> : null}

        <div className="create-actions avatar-crop-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!source || !placed || busy || Boolean(loadError)}
            onClick={() => void confirm()}
          >
            {busy ? 'Enviando…' : 'Usar esta foto'}
          </button>
          <button
            type="button"
            className="link-btn"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
