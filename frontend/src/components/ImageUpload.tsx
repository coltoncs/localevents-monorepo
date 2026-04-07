import { useState } from 'react'
import { useImages, useUploadImage, useDeleteImage } from '#/lib/hooks/useImages'
import type { UserImage } from '#/lib/types'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_MB = 10

interface ImageUploadProps {
  value: string
  onChange: (url: string) => void
  label?: string
}

export function ImageUpload({ value, onChange, label = 'Event Image' }: ImageUploadProps) {
  const [showGallery, setShowGallery] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const upload = useUploadImage()
  const deleteImage = useDeleteImage()
  const { data: images, isLoading: galleryLoading } = useImages()

  function validateFile(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Only JPEG, PNG, WebP, and GIF images are supported'
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File must be under ${MAX_SIZE_MB}MB`
    }
    return null
  }

  async function handleFile(file: File) {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    try {
      const image = await upload.mutateAsync(file)
      onChange(image.Url)
    } catch {
      setError('Upload failed. Please try again.')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function handleSelectFromGallery(image: UserImage) {
    onChange(image.Url)
    setShowGallery(false)
  }

  function handleDeleteImage(e: React.MouseEvent, id: string, url: string) {
    e.stopPropagation()
    deleteImage.mutate(id)
    if (value === url) onChange('')
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--sea-ink-soft)]">
        {label}
      </label>

      {/* Preview */}
      {value && (
        <div className="relative inline-block">
          <img
            src={value}
            alt="Event preview"
            className="h-32 w-48 rounded-md border border-[var(--line)] object-cover"
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white shadow-sm hover:bg-red-700"
          >
            x
          </button>
        </div>
      )}

      {/* Upload zone */}
      {!value && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-8 text-center transition ${
            dragOver
              ? 'border-[var(--lagoon)] bg-[rgba(79,184,178,0.08)]'
              : 'border-[var(--line)] hover:border-[var(--lagoon-deep)]'
          }`}
        >
          {upload.isPending ? (
            <p className="text-sm text-[var(--sea-ink-soft)]">Uploading...</p>
          ) : (
            <>
              <p className="text-sm text-[var(--sea-ink-soft)]">
                Drag & drop an image, or{' '}
                <label className="cursor-pointer font-medium text-[var(--lagoon-deep)] hover:text-[var(--lagoon)]">
                  browse
                  <input
                    type="file"
                    accept={ACCEPTED_TYPES.join(',')}
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </label>
              </p>
              <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
                JPEG, PNG, WebP, GIF up to {MAX_SIZE_MB}MB
              </p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Gallery toggle + URL input */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowGallery(!showGallery)}
          className="text-sm font-medium text-[var(--lagoon-deep)] hover:text-[var(--lagoon)]"
        >
          {showGallery ? 'Hide gallery' : 'Choose from gallery'}
        </button>
        <span className="text-xs text-[var(--sea-ink-soft)]">or</span>
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste image URL..."
          className="flex-1 rounded-md border border-[var(--line)] px-2 py-1 text-sm shadow-sm focus:border-[var(--lagoon)] focus:ring-[var(--lagoon)] focus:outline-none"
        />
      </div>

      {/* Image gallery */}
      {showGallery && (
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
          {galleryLoading ? (
            <p className="text-sm text-[var(--sea-ink-soft)]">Loading...</p>
          ) : !images?.length ? (
            <p className="text-sm text-[var(--sea-ink-soft)]">
              No uploaded images yet. Upload one above.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {images.map((img) => (
                <div key={img.ID} className="group relative">
                  <button
                    type="button"
                    onClick={() => handleSelectFromGallery(img)}
                    className={`block w-full overflow-hidden rounded border transition ${
                      value === img.Url
                        ? 'border-[var(--lagoon-deep)] ring-2 ring-[var(--lagoon)]'
                        : 'border-[var(--line)] hover:border-[var(--lagoon-deep)]'
                    }`}
                  >
                    <img
                      src={img.Url}
                      alt={img.Filename}
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteImage(e, img.ID, img.Url)}
                    className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white shadow-sm hover:bg-red-700 group-hover:flex"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
